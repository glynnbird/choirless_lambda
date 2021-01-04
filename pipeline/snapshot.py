from pathlib import Path
from functools import partial
import os

import boto3

import ffmpeg

def main(event, context):
    '''Converts a video file into a jpg snapshot'''

    key = event['Records'][0]['s3']['object']['key']
    choir_id, song_id, part_id = Path(key).stem.split('.')[0].split('+')
    bucket = event['Records'][0]['s3']['bucket']['name']
    dst_bucket = os.environ['DEST_BUCKET']
    # geo = event['Records'][0]['awsRegion']

    if key.endswith(".jpg"):
        return {}

    # Get the service client.
    s3 = boto3.client('s3')

    # Generate the URL to get 'key-name' from 'bucket-name'
    geturl = s3.generate_presigned_url(
      ClientMethod='get_object',
      Params={
          'Bucket': bucket,
          'Key': key
      }
    )

    # Generate the URL to get 'key-name' from 'bucket-name'
    keyjpg = key + '.jpg'
    puturl = s3.generate_presigned_url(
      ClientMethod='put_object',
        Params={
          'Bucket': dst_bucket,
          'Key': keyjpg
        }
    )

    stream = ffmpeg.input(geturl,
                          seekable=0)
    out = ffmpeg.output(stream,
                        puturl,
                        format='singlejpeg',
                        method='PUT',
                        seekable=0,
                        vframes=1)
    #stdout, stderr = out.run()
    out.run()

    ret = {"snapshot_key": keyjpg,
           "choir_id": choir_id,
           "song_id": song_id,
           "part_id": part_id,
           "status": "new"}

    return ret
