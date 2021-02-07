// environment variables
const LOCAL_MODE = !!process.env.LOCAL_MODE
const MISC_BUCKET = process.env.MISC_BUCKET
const DEST_BUCKET = process.env.DEST_BUCKET
const DEFINITION_BUCKET = process.env.DEFINITION_BUCKET
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

// break file name into constituent bits
const parseKey = (key) => {
  // split the incoming key into bits
  const parsed = path.parse(key).name.split('+')
  const pk = {
    choirId: parsed[0],
    songId: parsed[1]
  }
  const bits = parsed[2].split('-')
  pk.defId = bits[0]
  return pk
}

// build the filter graph for processing audio & video
const buildComplexFilter = (outputWidth, outputHeight, reverbLevel) => {
  // there are three inputs
  // 0 - the input video & audio
  // 1 - the watermark
  // 2 - the reverb impulse response wav
  // complex filter
  const filters = []
  let f

  // video pipeline
  f = {
    inputs: '0:v',
    filter: 'pad',
    options: {
      x: -1,
      y: -1,
      width: outputWidth,
      height: outputHeight
    },
    outputs: 'v1'
  }
  filters.push(f)
  f = {
    inputs: ['v1', '1'],
    filter: 'overlay',
    options: {
      x: 'W-w-20',
      y: 'H-h-20'
    },
    outputs: 'video'
  }
  filters.push(f)

  // audio pipeline
  f = {
    inputs: '0:a', // audio on the main video
    filter: 'asplit',
    options: { },
    outputs: ['a1', 'a2']
  }
  filters.push(f)
  f = {
    inputs: ['a1', '2'], // audio+ reverb impulse response
    filter: 'afir',
    options: {
      dry: 10,
      wet: 10
    },
    outputs: ['reverb']
  }
  filters.push(f)
  f = {
    inputs: ['a2', 'reverb'], // reverb + original audio split
    filter: 'amix',
    options: {
      inputs: 2,
      dropout_transition: 180,
      weights: `${1 - reverbLevel} ${reverbLevel}`
    },
    outputs: ['audiomix']
  }
  filters.push(f)

  // return the list of filters and the main audio & video outputs
  return {
    filters: filters,
    outputs: ['video', 'audiomix']
  }
}

// main
const main = async (event, context) => {
  console.log('post_production')

  let key, bucket, geturl, definition, watermarkurl, reverburl

  // when running locally
  if (LOCAL_MODE) {
    // expect 'event' to be a flat object
    key = event.key
    bucket = event.bucket
  } else {
    // event is an AWS event
    key = unescape(event.Records[0].s3.object.key)
    bucket = event.Records[0].s3.bucket.name
  }

  // parse the key
  const pk = parseKey(key)

  // load the definition file
  const definitionKey = `${pk.choirId}+${pk.songId}+${pk.defId}.json`
  if (LOCAL_MODE) {
    const p = path.join(LOCAL_BUCKETS_PATH, DEFINITION_BUCKET, definitionKey)
    definition = fs.readFileSync(p, { encoding: 'utf8' })
  } else {
    definition = await S3.getObject({ Bucket: DEFINITION_BUCKET, Key: definitionKey }).promise()
    definition = definition.Body
  }
  definition = JSON.parse(definition)

  // calculate input urls for video file and watermark image
  const reverbFile = `${definition.output.reverb_type}.wav`
  if (LOCAL_MODE) {
    geturl = path.join(LOCAL_BUCKETS_PATH, bucket, key)
    watermarkurl = path.join(LOCAL_BUCKETS_PATH, MISC_BUCKET, definition.output.watermark)
    reverburl = path.join(LOCAL_BUCKETS_PATH, MISC_BUCKET, reverbFile)
  } else {
    geturl = await S3.getSignedUrlPromise('getObject', { Bucket: bucket, Key: key })
    watermarkurl = await S3.getSignedUrlPromise('getObject', { Bucket: MISC_BUCKET, Key: definition.output.watermark })
    reverburl = await S3.getSignedUrlPromise('getObject', { Bucket: MISC_BUCKET, Key: reverbFile })
  }
  console.log(geturl, watermarkurl, reverburl)

  // build ffmpeg command
  const command = ffmpeg()
    .addInput(geturl)
    .inputOptions(['-seekable 0'])
    .addInput(watermarkurl)
    .inputOptions(['-seekable 0'])
    .addInput(reverburl)
    .inputOptions(['-seekable 0'])

  // build the video & audio pipelines
  const complexFilter = buildComplexFilter(
    definition.output.size[0], // width of output video
    definition.output.size[1], // height of output video
    definition.output.reverb)
  command.complexFilter(complexFilter.filters, complexFilter.outputs)

  // create temporary directory
  const tmppath = tmpdir.createTmpDirectory()
  const outputKey = `${pk.choirId}+${pk.songId}+${pk.defId}-final.mp4`
  const outpath = path.join(tmppath, outputKey)

  // set output parameters
  command
    .output(outpath)
    .outputFormat('mp4') // mp4 container
    .outputOptions([
      '-pix_fmt yuv420p',
      '-vcodec libx264', // h.264 video
      '-preset veryfast', // fast encoding
      '-movflags +faststart']) // put meta data at the start of the file

  await run(command, true)

  // copy the temporary file to output bucket
  if (LOCAL_MODE) {
    const desturl = path.join(LOCAL_BUCKETS_PATH, DEST_BUCKET, outputKey)
    fs.copyFileSync(outpath, desturl)
  } else {
    // upload to S3
    await S3.putObject({
      Bucket: DEST_BUCKET,
      Key: outputKey,
      Body: fs.createReadStream(outpath)
    }).promise()
  }
  tmpdir.removeTmpDirectory(tmppath)
  return { ok: true }
}

exports.main = main
