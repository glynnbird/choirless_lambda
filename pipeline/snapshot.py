"""
snapshot.py

Lambda triggered on addition of an object into an S3 bucket. Converts the video
file into a JPG snapshot which is written to the target bucket.
"""
from pathlib import Path
import os

import boto3

import ffmpeg

def main(event, context):
    '''Converts a video file into a jpg snapshot'''
    print('Running %s' % context['function_name'])

    # extract key and source bucket from incoming event
    key = event['Records'][0]['s3']['object']['key']
    choir_id, song_id, part_id = Path(key).stem.split('.')[0].split('+')
    bucket = event['Records'][0]['s3']['bucket']['name']

    # get destination bucket from environment variable
    dst_bucket = os.environ['DEST_BUCKET']
    # geo = event['Records'][0]['awsRegion']

    if key.endswith(".jpg"):
        return {}

    # Get the service client.
    s3_client = boto3.client('s3')

    # Generate the URL to get 'key-name' from 'bucket-name'
    geturl = s3_client.generate_presigned_url(
        ClientMethod='get_object',
        Params={
            'Bucket': bucket,
            'Key': key
        }
    )

    # Generate the URL to get 'key-name' from 'bucket-name'
    keyjpg = key + '.jpg'
    puturl = s3_client.generate_presigned_url(
        ClientMethod='put_object',
        Params={
          'Bucket': dst_bucket,
          'Key': key + '.jpg'
        }
    )

    # read the source video file
    stream = ffmpeg.input(geturl,
                          seekable=0)
    # write a JPEG snapshot to the output bucket
    out = ffmpeg.output(stream,
                        puturl,
                        format='singlejpeg',
                        method='PUT',
                        seekable=0,
                        vframes=1)
    # stdout, stderr = out.run()
    out.run()

    # return status dictionary
    ret = {"snapshot_key": keyjpg,
           "choir_id": choir_id,
           "song_id": song_id,
           "part_id": part_id,
           "status": "new"}

    return ret
