import json
import os
from pathlib import Path
from shutil import copyfile
import tempfile

import boto3

import ffmpeg

#import numpy as np
LOCAL_BUCKETS_PATH = '../buckets'

def helper(x):
    return {'tag': f"{x['compositor']}-{x['row_num']}"}


def main(args, context):

    # local_mode is for writing to local files rather than S3
    print('renderer_child.py')
    local_mode = bool(os.environ['LOCAL_MODE'])
    print('Local mode %s' % (local_mode))

    # Get the service client.
    s3_client = boto3.client('s3')
    definition_key = args.get('definition_key', '')

    # infer choir, song, and definition id from filename
    choir_id, song_id, def_id = Path(definition_key).stem.split('+', 3)

    definition_bucket = args.get('bucket')
    src_bucket = os.environ['SRC_BUCKET']
    dst_bucket = os.environ['DEST_BUCKET']

    # the compositor to run (audio / video)
    compositor = args['compositor']

    # the row number we are processing
    row_num = int(args['row_num'])
    rows_hash = args['rows_hash']

    # run id used to group all our files together
    run_id = args['run_id']

    print(
        f"We are the child {compositor} process, run id: {run_id} row: {row_num}")

    # Download the definition file for this job
    if local_mode:
        file = open(Path(LOCAL_BUCKETS_PATH, definition_bucket, definition_key), 'r')
        definition = json.loads(file.read())
    else:
        # read definition from S3
        definition_object = s3_client.get_object(
            Bucket=definition_bucket,
            Key=definition_key,
        )
        definition = json.load(definition_object['Body'])

    output_spec = definition['output']
    input_specs = definition['inputs']

    # Calculate number of rows
    rows = set()
    for spec in input_specs:
        x, y = spec.get('position', [-1, -1])
        rows.add(y)
    rows = sorted(rows)

    # The output key
    output_key = f"{choir_id}+{song_id}+{def_id}+{run_id}+{row_num}@{rows_hash}.nut"

    # Calculate the max row length, needed for volume compensation
    # on uneven rows
    max_row_len = 0
    for r in rows:
        l = len(tuple(specs_for_row(input_specs, r)))
        if l > max_row_len:
            max_row_len = l

    # Get the row input specs
    row_input_specs = tuple(specs_for_row(input_specs, row_num))

    # Calculate bounding boxes and padding
    top, bottom = calc_bounding_box(row_input_specs)
    margin = 10

    total_output_width, _ = output_spec['size']
    output_width = total_output_width
    output_height = bottom - top + margin

    # by default rows are at top
    row_y = 0

    # Main combination process
    audio_inputs = []
    video_inputs = []
    coords = []
    streams_and_filename = []

    for spec in row_input_specs:
        # Get the part spec and input
        part_id = spec['part_id']
        part_key = f"{choir_id}+{song_id}+{part_id}.nut"
        if local_mode:
            part_url = Path(LOCAL_BUCKETS_PATH, src_bucket, part_key)
        else:
            part_url = s3_client.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': src_bucket,
                    'Key': part_key
                }
            )

        # process the spec
        video, audio = process_spec(part_url, spec)

        audio_inputs.append(audio)
        # Get co-ords for video
        if video is not None:
            video_inputs.append(video)
            x, _ = spec['position']
            coords.append((x, row_y))

    # Combine the audio parts if there are any
    if len(audio_inputs) > 0:
        if len(audio_inputs) == 1:
            audio_pipeline = audio_inputs[0]
        else:
            audio_pipeline = ffmpeg.filter(
                audio_inputs, 'amix', inputs=len(audio_inputs))

        # Adjust the volume in proportion to total number of parts
        volume = len(row_input_specs) / float(max_row_len)
        if volume != 1.0:
            audio_pipeline = audio_pipeline.filter('volume',
                                                   volume=volume)

        streams_and_filename.append(audio_pipeline)

    # Combine the video parts if there are any
    if len(video_inputs) > 0:
        if len(video_inputs) == 1:
            x, y = coords[0]
            video_pipeline = video_inputs[0]
            video_pipeline = video_pipeline.filter('pad',
                                                   output_width,
                                                   output_height,
                                                   x,
                                                   y)
        else:
            layout = '|'.join([f"{x}_{row_y}" for x, row_y in coords])
            video_pipeline = ffmpeg.filter(video_inputs,
                                           'xstack',
                                           inputs=len(video_inputs),
                                           fill='black',
                                           layout=layout)
            video_pipeline = video_pipeline.filter('pad',
                                                   output_width,
                                                   output_height)
        streams_and_filename.append(video_pipeline)

    if len(streams_and_filename) == 0:
        return {'error': 'no parts to process'}

    kwargs = {}
    if 'duration' in args:
        kwargs['t'] = int(args['duration'])

    tempfile.tempdir = os.environ.get('TMP_DIR', '/tmp')
    with tempfile.TemporaryDirectory() as tmp:
        # join temp directory with our filename
        path = os.path.join(tmp, output_key)

        streams_and_filename.append(path)

        pipeline = ffmpeg.output(*streams_and_filename,
                                 format='nut',
                                 pix_fmt='yuv420p',
                                 acodec='pcm_s16le',
                                 vcodec='mpeg2video',
                                 r=25,
                                 qscale=1,
                                 qmin=1,
                                 **kwargs
                                 )

        cmd = pipeline.compile()
        print("ffmpeg command to run: ", cmd)
        pipeline.run()

        # write the output file to S3
        if local_mode:
            copyfile(path, Path(LOCAL_BUCKETS_PATH, dst_bucket, output_key))
        else:
            s3_client.upload_file(path, dst_bucket, output_key)

    return { 'ok': True }


def specs_for_row(specs, row):
    for spec in specs:
        _, y = spec.get('position', [-1, -1])
        if y == row:
            yield spec


def calc_bounding_box(specs):
    top = 1000000.0
    bottom = -1000000.0
    for spec in specs:
        if 'position' not in spec:
            continue
        _, y = spec['position']
        _, height = spec['size']
        # round height down to next even number as that is what the scaler will
        # so
        height = height // 2 * 2
        if y < top:
            top = y
        if (y + height) > bottom:
            bottom = y + height

    return top, bottom


def process_spec(part_url, spec):
    # main stream input
    stream = ffmpeg.input(part_url,
                          seekable=0,
                          r=25,
                          thread_queue_size=64)

    # Calc the offset in seconds
    offset = spec.get('offset', 0)
    offset = float(offset) / 1000

    # Get the part spec and input
    # video
    if 'position' in spec:
        width, height = spec['size']

        video = stream.video
        if offset > 0:
            video = video.filter('trim',
                                 start=offset)
        video = video.filter('setpts', 'PTS-STARTPTS')
        video = video.filter('scale', width, height,
                             force_original_aspect_ratio='decrease',
                             force_divisible_by=2)

    else:
        video = None

    # audio
    audio = stream.audio
    if offset > 0:
        audio = audio.filter('atrim',
                             start=offset)
    audio = audio.filter('asetpts', 'PTS-STARTPTS')
    pan = float(spec.get('pan', 0))
    volume = float(spec.get('volume', 1))
    audio = audio.filter('volume',
                         volume=volume)
    audio = audio.filter('stereotools',
                         mpan=pan)

    return video, audio
