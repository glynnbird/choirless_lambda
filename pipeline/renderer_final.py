import os
from pathlib import Path
import tempfile
import time
import hashlib

import boto3

import ffmpeg

# first step to ensure we have all parts
# then call process()


def main(args):

    # Get the service client.
    s3_client = boto3.client('s3')

    key = args.get('key', args.get('object_name', ''))

    # parse the key
    choir_id, song_id, def_id, run_id, _, rows_hash = parse_key(key)

    src_bucket = os.environ['SRC_BUCKET']

    # Check all parts present if, not abort
    key_prefix = f'{choir_id}+{song_id}+{def_id}+{run_id}'
    contents = s3_client.list_objects(
        Bucket=src_bucket,
        Prefix=key_prefix
    )
    row_keys = [x['Key'] for x in contents.get('Contents', [])
                if x['Size'] > 0]

    # Sort to make sure we are in correct order
    row_keys.sort(key=lambda x: int(parse_key(x)[4]))

    # Calc hash of found parts to make sure we have all, if not abort
    if calc_hash_of_keys(row_keys) != rows_hash:
        # add choir_id/song_id/status for render status updates
        # if we arrive here, not all parts are rendered yet, so status =
        # 'rendered'
        ret = {
            'status': 'missing rows',
            'choir_id': choir_id,
            'song_id': song_id}
        return ret

    args['row_keys'] = row_keys
    r = process(args)
    # render status data
    # if we arrive here, all parts are rendered, so status = 'composited'
    r['choir_id'] = choir_id
    r['song_id'] = song_id
    r['status'] = 'composited'
    return r


def process(args):
    # Get the service client.
    s3_client = boto3.client('s3')

    key = args.get('key', args.get('object_name', ''))

    # parse the key
    choir_id, song_id, def_id, run_id, row_num, _ = parse_key(key)

    src_bucket = os.environ['SRC_BUCKET']
    dst_bucket = os.environ['DST_BUCKET']
    # misc_bucket = os.environ['MISC_BUCKET']

    # Download the definition file for this job
    #definition_bucket = os.environ['DEFINITION_BUCKET']
    #definition_key = f'{choir_id}+{song_id}+{def_id}.json'
    #definition_object = s3_client.get_object(
    #    Bucket=definition_bucket,
    #    Key=definition_key,
    #)
    #definition = json.load(definition_object['Body'])
    # output_spec = definition['output']

    row_keys = args['row_keys']

    ###
    # Combine video and audio
    ###

    # video
    if len(row_keys) > 1:
        # Multiple video parts
        video_parts = []
        audio_parts = []
        for row_key in row_keys:
            _, _, _, _, row_num, _ = parse_key(row_key)
            row_url = s3_client.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': src_bucket,
                    'Key': row_key
                }
            )
            row_part = ffmpeg.input(row_url,
                                    seekable=0,
                                    thread_queue_size=64)
            if row_num != -1:
                video_parts.append(row_part.video)
            audio_parts.append(row_part.audio)

        video = ffmpeg.filter(video_parts, 'vstack',
                              inputs=len(video_parts))
        audio = ffmpeg.filter(audio_parts,
                              'amix',
                              dropout_transition=180,
                              inputs=len(audio_parts))
    else:
        # Just a single video part
        row_key = row_keys[0]
        _, _, _, _, row_num, _ = parse_key(row_key)
        row_url = s3_client.generate_presigned_url(
            ClientMethod='get_object',
            Params={
                'Bucket': src_bucket,
                'Key': row_key
            }
        )
        row_part = ffmpeg.input(row_url,
                                seekable=0,
                                thread_queue_size=64)
        if row_num != -1:
            video = row_part.video
        else:
            video = None
        audio = row_part.audio

    # Output
    output_key = f'{choir_id}+{song_id}+{def_id}-preprod.nut'
    # output_url = get_output_url(output_key)

    kwargs = {}
    if 'duration' in args:
        kwargs['t'] = int(args['duration'])

    if 'loglevel' in args:
        kwargs['v'] = args['loglevel']

    with tempfile.TemporaryDirectory() as tmp:
        # join temp directory with our filename
        path = os.path.join(tmp, output_key)
        pipeline = ffmpeg.output(audio,
                                 video,
                                 output_key,
                                 format='nut',
                                 pix_fmt='yuv420p',
                                 acodec='pcm_s16le',
                                 vcodec='mpeg2video',
                                 method='PUT',
                                 r=25,
                                 seekable=0,
                                 qscale=1,
                                 qmin=1,
                                 **kwargs
                                 )

        cmd = pipeline.compile()
        print("ffmpeg command to run: ", cmd)
        t1 = time.time()
        pipeline.run()
        t2 = time.time()

        # upload temp file to S3
        s3_client.upload_file(path, dst_bucket, output_key)

    ret = {'dst_key': output_key,
           'run_id': run_id,
           'def_id': def_id,
           'render_time': int(t2 - t1),
           'status': 'merged'}

    return ret


def parse_key(key):
    choir_id, song_id, def_id, run_id, section_id = Path(key).stem.split('+')
    row_num, rows_hash = section_id.split('@')
    return choir_id, song_id, def_id, run_id, int(row_num), rows_hash


def calc_hash_of_keys(keys):
    rows = [int(parse_key(x)[4]) for x in keys]
    return calc_hash_rows(rows)


def calc_hash_rows(rows):
    val = '-'.join([str(x) for x in sorted(rows)])
    h = hashlib.sha1(val.encode('utf-8')).hexdigest()
    return h[:8]
