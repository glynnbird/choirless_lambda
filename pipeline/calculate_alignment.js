// environment variables
const RENDERER_LAMBDA = process.env.RENDERER_LAMBDA

// node modules
const path = require('path')
const aws = require('aws-sdk')

// aws objects
const Lambda = new aws.Lambda()

const main = async (event, context) => {
  console.log('calculate_alignment')

  // event is an AWS event
  const key = unescape(event.Records[0].s3.object.key)
  const bucket = event.Records[0].s3.bucket.name
  console.log(`Running on ${bucket}/${key}`)

  // invoke next Lambda
  const bits = path.parse(key).name.split('+')
  const payload = {
    key: key,
    bucket: bucket,
    choir_id: bits[0],
    song_id: bits[1],
    part_id: bits[2]
  }
  const params = {
    FunctionName: RENDERER_LAMBDA,
    InvocationType: 'Event',
    Payload: JSON.stringify(payload)
  }
  await Lambda.invoke(params).promise()
}

exports.main = main
