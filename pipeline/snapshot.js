// environment variables
const LOCAL_MODE = !!process.env.LOCAL_MODE
const DEST_BUCKET = process.env.DEST_BUCKET
const CONVERT_LAMBDA = process.env.CONVERT_LAMBDA
const LOCAL_BUCKETS_PATH = '../buckets'

// node modules
const fs = require('fs')
const path = require('path')
const aws = require('aws-sdk')
const tmpdir = require('tmpdir')
const ffmpeg = require('fluent-ffmpeg')
const run = require('ffmpegrunner').run

// aws objects
const S3 = new aws.S3()
const Lambda = new aws.Lambda()

// main
const main = async (event, context) => {
  let key, bucket, geturl, desturl
  console.log('snapshot')

  // when running locally
  if (LOCAL_MODE) {
    // expect 'event' to be a flat object
    key = event.key
    bucket = event.bucket
    geturl = path.join(LOCAL_BUCKETS_PATH, bucket, key)
    desturl = path.join(LOCAL_BUCKETS_PATH, DEST_BUCKET, key + '.jpg')
  } else {
    // event is an AWS event
    key = unescape(event.Records[0].s3.object.key)
    bucket = event.Records[0].s3.bucket.name

    // Generate the URL to get key from bucket
    geturl = await S3.getSignedUrlPromise('getObject', { Bucket: bucket, Key: key })
  }
  console.log(`Running on ${bucket}/${key}`)

  // create temporary directory
  const tmppath = tmpdir.createTmpDirectory()

  // run ffmpeg to take a snapshot
  const keyjpg = key + '.jpg'
  const outpath = path.join(tmppath, keyjpg)
  const command = ffmpeg()
    .input(geturl)
    .inputOptions('-seekable 0')
    .output(outpath)
    .outputOptions(['-format singlejpeg', '-vframes 1'])
  await run(command, true)

  // copy the temporary file to output bucket
  if (LOCAL_MODE) {
    fs.copyFileSync(outpath, desturl)
  } else {
    // upload to S3
    await S3.putObject({
      Bucket: DEST_BUCKET,
      Key: keyjpg,
      Body: fs.createReadStream(outpath)
    }).promise()

    // invoke next Lambda
    const payload = {
      key: key,
      bucket: bucket
    }
    const params = {
      FunctionName: CONVERT_LAMBDA,
      InvocationType: 'Event',
      Payload: JSON.stringify(payload)
    }
    await Lambda.invoke(params).promise()
  }
  tmpdir.removeTmpDirectory(tmppath)
}

exports.main = main
