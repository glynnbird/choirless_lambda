import boto3

def lambda_handler(event, context):

    # get the CSV from S3 and into a frame
    s3 = boto3.client('s3')
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    print(f"bucket is , {bucket} ")
    print(f"key is {key}")

