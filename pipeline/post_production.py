import json
import os
from pathlib import Path
import tempfile
import time
import re

import boto3

import ffmpeg


def main(args):
    # Get the service client.
    s3_client = boto3.client('s3')

    key = args.get('key', args.get('object_name', ''))

    # parse the key
    choir_id, song_id, def_id = Path(key).stem.split('-')[0].split('+')

    src_bucket = os.environ['SRC_BUCKET']
    dst_bucket = os.environ['DEST_BUCKET']
    misc_bucket = os.environ['MISC_BUCKET']
    definition_bucket = os.environ['DEFINITION_BUCKET']

    # Download the definition file for this job
    definition_key = f'{choir_id}+{song_id}+{def_id}.json'
    definition_object = s3_client.get_object(
        Bucket=definition_bucket,
        Key=definition_key,
    )
    definition = json.load(definition_object['Body'])
    output_spec = definition['output']

    ###
    # Combine video and audio
    ###

    # Create a temp dir for our files to use
    with tempfile.TemporaryDirectory() as tmpdir:

        print("Doing first pass")
        src_url = s3_client.generate_presigned_url(
            ClientMethod='get_object',
            Params={
                'Bucket': src_bucket,
                'Key': key
            }
        )
        stream = ffmpeg.input(src_url,
                              seekable=0)
        audio = stream.audio
        audio = audio.filter('volumedetect')
        pipeline = ffmpeg.output(audio,
                                 "-",
                                 format='null')

        cmd = pipeline.compile()
        print("ffmpeg command to run: ", cmd)

        stdout, stderr = pipeline.run(capture_stdout=True,
                                      capture_stderr=True)
        output = stdout + stderr
        output_lines = [line.strip() for line in output.decode().split('\n')]

        # mute = False

        # Volume detect
        vol_threshold = int(args.get('vol_threshold', 22))
        vol_pct = float(args.get('vol_pct', 0.05))

        total_samples = 0
        high_samples = 0
        max_volume = 0
        hist_re = re.compile(r'histogram_(\d+)db: (\d+)')
        maxvol_re = re.compile(r'max_volume: (-?\d+\.?\d*) dB')
        for line in output_lines:
            # Search for histogram
            mo = hist_re.search(line)
            if mo:
                level, samples = mo.groups()
                total_samples += int(samples)
                if int(level) < vol_threshold:
                    high_samples += int(samples)

            # Search for max volume
            mo = maxvol_re.search(line)
            if mo:
                max_volume = float(mo.groups()[0])

        if high_samples / total_samples < vol_pct:
            print(f"Input volume is so low, we are muting it "
                  f"{high_samples/total_samples:.2f} above {vol_threshold}")
            # mute = True

        target_peak = 0
        volume_gain = target_peak - max_volume
        volume_gain = f"{volume_gain:.2f} dB"

        # Second pass, apply normalisation
        print("Doing second pass loudnorm")
        stream = ffmpeg.input(src_url,
                              seekable=0)

        video = stream.video
        audio = stream.audio

        # Pad the video to final size, place video in center
        output_width, output_height = output_spec['size']
        video = video.filter('pad',
                             x=-1,
                             y=-1,
                             width=output_width,
                             height=output_height)

        # Overlay the watermark if present
        watermark_file = output_spec.get('watermark')
        if watermark_file:
            watermark_url = s3_client.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': misc_bucket,
                    'Key': watermark_file
                }
            )
            watermark = ffmpeg.input(watermark_url,
                                     seekable=0)
            video = video.overlay(watermark,
                                  x='W-w-20',
                                  y='H-h-20')

        print("Volume gain to apply:", volume_gain)
        audio = audio.filter('volume',
                             volume_gain)

        # Add in audio compression
#        audio = audio.filter('acompressor')

        # Add reverb in if present
        reverb_type = output_spec.get('reverb_type')
        if reverb_type:
            reverb_url = s3_client.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': misc_bucket,
                    'Key': f'{reverb_type}.wav'
                }
            )
            reverb_pct = float(output_spec.get('reverb', 0.1))
            if reverb_pct > 0:
                reverb_part = ffmpeg.input(reverb_url,
                                           seekable=0)
                split_audio = audio.filter_multi_output('asplit')
                reverb = ffmpeg.filter([split_audio[1], reverb_part],
                                       'afir',
                                       dry=10, wet=10)
                audio = ffmpeg.filter([split_audio[0], reverb],
                                      'amix',
                                      dropout_transition=180,
                                      weights=f'{1-reverb_pct} {reverb_pct}')

        # Output
        output_key = f'{choir_id}+{song_id}+{def_id}-final.mp4'
        output_path = str(Path(tmpdir, output_key))

        kwargs = {}
        if 'duration' in args:
            kwargs['t'] = int(args['duration'])

        if 'loglevel' in args:
            kwargs['v'] = args['loglevel']

        pipeline = ffmpeg.output(audio,
                                 video,
                                 output_path,
                                 pix_fmt='yuv420p',
                                 vcodec='libx264',
                                 preset='veryfast',
                                 movflags='+faststart',
                                 **kwargs
                                 )
        cmd = pipeline.compile()
        print("ffmpeg command to run: ", cmd)
        t1 = time.time()
        pipeline.run()
        t2 = time.time()

        # write the output file to S3
        s3_client.upload_file(output_path, dst_bucket, output_key)

        ret = {'dst_key': output_key,
               'def_id': def_id,
               'render_time': int(t2 - t1),
               'choir_id': choir_id,
               'song_id': song_id,
               'status': 'done'}

        return ret
