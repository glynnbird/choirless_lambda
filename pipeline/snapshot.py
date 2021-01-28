"""
snapshot.py

Lambda triggered on addition of an object into an S3 bucket. Converts the video
file into a JPG snapshot which is written to the target bucket.
"""
from pathlib import Path
from urllib.parse import unquote
from shutil import copyfile

import os
import json
import tempfile

import boto3

import ffmpeg

LOCAL_BUCKETS_PATH = '../buckets'


def main(event, context):
    '''Converts a video file into a jpg snapshot'''
    # local_mode is for writing to local files rather than S3
    print('snapshot.py')
    local_mode = bool(os.environ.get('LOCAL_MODE', False))
    print('Local mode %s' % (local_mode))

    # Get the service client.
    s3_client = boto3.client('s3')

    # get destination bucket from environment variable
    dst_bucket = os.environ['DEST_BUCKET']

    # extract key and source bucket from incoming event
    if local_mode:
        key = event['key']
        bucket = event['bucket']
        geturl = Path(LOCAL_BUCKETS_PATH, bucket, key)
        desturl = Path(LOCAL_BUCKETS_PATH, dst_bucket, key + '.jpg')
    else:
        # when called from AWS S3 Event, the key/bucket are buried in the event
        key = unquote(event['Records'][0]['s3']['object']['key'])
        bucket = event['Records'][0]['s3']['bucket']['name']

        # Generate the URL to get key from bucket
        geturl = s3_client.generate_presigned_url(
            ClientMethod='get_object',
            Params={
                'Bucket': bucket,
                'Key': key
            }
        )

    choir_id, song_id, part_id = Path(key).stem.split('.')[0].split('+')
    print('Running on %s/%s' % (bucket, key))

    if key.endswith(".jpg"):
        return {}

    # Generate a temporary filename for the destination file
    keyjpg = key + '.jpg'
    with tempfile.TemporaryDirectory() as tmp:
        # join temp directory with our filename
        path = os.path.join(tmp, keyjpg)

        # read the source video file
        stream = ffmpeg.input(geturl,
                              seekable=0)

        # write a JPEG snapshot to temp file
        out = ffmpeg.output(stream,
                            path,
                            format='singlejpeg',
                            vframes=1)

        # output the  ffmpeg command
        print(out.compile())

        # run ffmpeg
        try:
            out.run()

            if local_mode:
                # copy temp file to buckets path
                copyfile(path, desturl)
            else:
                # upload temp file to S3
                s3_client.upload_file(path, dst_bucket, keyjpg)

        except ffmpeg.Error as e:
            print("ffmpeg error. Trying to continue anyway...")
            print(e)

    # when running on Lambda, invoke the next Lambda
    if not local_mode:
        lambda_client = boto3.client('lambda')

        ret = {"key": key,
            "bucket": bucket,
            "choir_id": choir_id,
            "song_id": song_id,
            "part_id": part_id}

        lambda_client.invoke(
            FunctionName=os.environ['CONVERT_LAMBDA'],
            Payload=json.dumps(ret),
            InvocationType='Event'
        )

