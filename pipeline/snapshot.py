"""
snapshot.py

Lambda triggered on addition of an object into an S3 bucket. Converts the video
file into a JPG snapshot which is written to the target bucket.
"""
from pathlib import Path
from urllib.parse import unquote

import os
import tempfile

import boto3

import ffmpeg


def main(event, context):
    '''Converts a video file into a jpg snapshot'''

    # extract key and source bucket from incoming event
    key = unquote(event['Records'][0]['s3']['object']['key'])
    choir_id, song_id, part_id = Path(key).stem.split('.')[0].split('+')
    bucket = event['Records'][0]['s3']['bucket']['name']
    fname = context.get('function_name','')
    print('Running %s on %s/%s' % (fname, bucket, key))

    # get destination bucket from environment variable
    dst_bucket = os.environ['DEST_BUCKET']
    # geo = event['Records'][0]['awsRegion']

    if key.endswith(".jpg"):
        return {}

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
        out.run()

        # upload temp file to S3
        s3_client.upload_file(path, dst_bucket, keyjpg)

    # return status dictionary
    ret = {"snapshot_key": keyjpg,
           "choir_id": choir_id,
           "song_id": song_id,
           "part_id": part_id,
           "status": "new"}
    return ret
