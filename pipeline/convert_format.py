"""
convert_format.py

Lambda that converts an incoming video into a standard choirless format.

"""

from pathlib import Path
from shutil import copyfile
import re
import tempfile
import os
import boto3

import ffmpeg

LOCAL_BUCKETS_PATH = '../buckets'


def main(event, context):
    '''Converts incoming video into choirless format'''
    # local_mode is for writing to local files rather than S3
    print('convert_format.py')
    local_mode = bool(os.environ['LOCAL_MODE'])
    print('Local mode %s' % (local_mode))

    # extract key and source bucket from incoming event
    key = event['key']
    #choir_id = event['choir_id']
    #song_id = event['song_id']
    #part_id = event['part_id']
    bucket = event['bucket']
    print('Running on %s/%s' % (bucket, key))

    # get destination bucket from environment variable
    dst_bucket = os.environ['DEST_BUCKET']
    output_key = str(Path(key).with_suffix('.nut'))

    if local_mode:
        geturl = Path(LOCAL_BUCKETS_PATH, bucket, key)
        desturl = Path(LOCAL_BUCKETS_PATH, dst_bucket, output_key)
    else:
        # Get the service client.
        s3_client = boto3.client('s3')

        # Generate the URL to get key from bucket
        geturl = s3_client.generate_presigned_url(
            ClientMethod='get_object',
            Params={
                'Bucket': bucket,
                'Key': key
            }
        )

    kwargs = {}

    # Probe pass
    # First probe the file to see if we have audio and/or video streams
    try:
        output = ffmpeg.probe(geturl)
    except ffmpeg.Error as e:
        print("ffprobe error", e.stderr)
        return {'error': str(e)}

    stream_types = set([s['codec_type'] for s in output['streams']])
    audio_present = 'audio' in stream_types
    video_present = 'video' in stream_types

    print("Audio present:", audio_present)
    print("Video present:", video_present)

    if not (audio_present or video_present):
        return {"error": "no streams!"}

    # Two pass loudness normalisation
    # First pass, get details
    if audio_present:
        print("Doing first pass")
        stream = ffmpeg.input(geturl,
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

        mute = False

        # Volume detect
        vol_threshold = 30
        vol_pct = 0.05

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
            mute = True

        target_peak = -2
        volume_gain = target_peak - max_volume
        volume_gain = f"{volume_gain:.2f} dB"

    # Second pass, apply normalisation
    print("Doing second pass")
    stream = ffmpeg.input(geturl,
                          seekable=0)

    if video_present:
        video = stream.filter('fps', fps=25, round='up')
        video = video.filter('scale', 640, 480,
                             force_original_aspect_ratio='decrease',
                             force_divisible_by=2)
    else:
        video = ffmpeg.input('color=color=black:size=vga',
                             format='lavfi').video

    if audio_present:
        audio = stream.audio

        # If the normalisation appears to detect no sound then just mute audio
        if mute:
            volume_gain = 0

        print("Volume gain to apply:", volume_gain)
        audio = audio.filter('volume',
                             volume_gain)
        audio = audio.filter('aresample', 44100)
    else:
        audio = ffmpeg.input('anullsrc',
                             format='lavfi').audio
 
    tempfile.tempdir = os.environ.get('TMP_DIR', '/tmp')
    with tempfile.TemporaryDirectory() as tmp:
        # join temp directory with our filename
        path = os.path.join(tmp, output_key)
        print(path)
        pipeline = ffmpeg.output(audio,
                                 video,
                                 path,
                                 format='nut',
                                 acodec='pcm_f32le',
                                 vcodec='libx264',
                                 preset='slow',
                                 shortest=None,
                                 r=25,
                                 ac=1,
                                 **kwargs)

        cmd = pipeline.compile()
        print("ffmpeg command to run: ", cmd)
        pipeline.run()

        # upload temp file to S3
        if local_mode:
            copyfile(path, desturl)
        else:
            s3_client.upload_file(path, dst_bucket, output_key)

    return {'ok': True}
