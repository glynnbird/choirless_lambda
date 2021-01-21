"""
calculate_alignment.py

Does nothing and then calls  renderer Lambda
"""
from pathlib import Path
from urllib.parse import unquote

import os
import json

import boto3

def main(event, context):
    '''Does nothing'''

    # extract key and source bucket from incoming event
    key = unquote(event['Records'][0]['s3']['object']['key'])
    choir_id, song_id,part_id  = Path(key).stem.split('.')[0].split('+')
    bucket = event['Records'][0]['s3']['bucket']['name']
    print('Running on %s/%s' % (bucket, key))

    lambda_client = boto3.client('lambda')

    ret = {"key": key,
           "bucket": bucket,
           "choir_id": choir_id,
           "song_id": song_id,
           "part_id": part_id}

    lambda_client.invoke(
	FunctionName= os.environ['RENDERER_LAMBDA'],
	Payload = json.dumps(ret),
	InvocationType = 'Event'
    )
    return ret
