// environment variables
const LOCAL_MODE = !!process.env.LOCAL_MODE
const DEST_BUCKET = process.env.DEST_BUCKET
const LOCAL_BUCKETS_PATH = '../buckets'

// node modules
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const aws = require('aws-sdk')
const tmpdir = require('tmpdir')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegrunner = require('ffmpegrunner')
const run = ffmpegrunner.run
const glob = require('glob')

// aws objects
const S3 = new aws.S3()

// sha1 hash
const sha1 = (str) => {
  const shasum = crypto.createHash('sha1')
  shasum.update(str)
  return shasum.digest('hex')
}

// break file name into constituent bits
const parseKey = (key) => {
  // split the incoming key into bits
  const parsed = path.parse(key).name.split('+')
  const pk = {
    choirId: parsed[0],
    songId: parsed[1],
    defId: parsed[2],
    runId: parsed[3]
  }
  const bits = parsed[4].split('@')
  pk.rowNum = bits[0]
  pk.rowsHash = bits[1]
  return pk
}

// build the filter graph for processing audio & video
const buildComplexFilter = (videos) => {
  // complex filter
  const filters = []
  const vparts = []
  const aparts = []
  let f
  for (const i in videos) {
    const video = videos[i]
    video.id = i.toString()

    // audio only videos are on row -1
    if (video.rowNum !== '-1') {
      vparts.push(video.id + ':v')
    }
    aparts.push(video.id + ':a')
  }
  // video pipeline
  f = {
    inputs: vparts,
    filter: 'vstack',
    options: {
      inputs: vparts.length
    },
    outputs: 'v'
  }
  filters.push(f)
  f = {
    inputs: aparts,
    filter: 'amix',
    options: {
      inputs: aparts.length,
      dropout_transition: 180

    },
    outputs: 'a'
  }
  filters.push(f)
  // add our filter graph to the command
  return {
    filters: filters,
    outputs: ['v', 'a']
  }
}

// main
const main = async (event, context) => {
  console.log('renderer_final')

  let key, bucket

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

  // split the incoming key into bits
  const pk = parseKey(key)

  // check to see if all the finalparts are present
  const keyPrefix = `${pk.choirId}+${pk.songId}+${pk.defId}+${pk.runId}`
  let rowKeys
  if (LOCAL_MODE) {
    const p = path.join(LOCAL_BUCKETS_PATH, bucket, keyPrefix + '*')
    rowKeys = glob.sync(p)
  } else {
    const response = S3.listObjects({ Bucket: bucket, Prefix: keyPrefix }).promise()
    rowKeys = response.Contents.map((obj) => { return obj.Key })
  }
  rowKeys.sort()

  // get list of run ids
  const videos = rowKeys.map(rk => parseKey(rk))
  const rows = videos.map((v) => { return v.rowNum })
  console.log(rowKeys, rows)
  const hash = sha1(rows.join('-')).substr(0, 8)
  console.log('incoming hash', pk.rowsHash, 'calculated hash', hash)
  if (hash !== pk.rowsHash) {
    return { ok: false, msg: 'not all rows here yet' }
  }

  // build ffmpeg command
  const command = ffmpeg()

  // add the inputs
  for (const i in rowKeys) {
    let geturl
    const rk = rowKeys[i]
    if (LOCAL_MODE) {
      geturl = rk
    } else {
      geturl = await S3.getSignedUrlPromise('getObject', { Bucket: bucket, Key: rk })
    }
    command.addInput(geturl)
      .inputOptions(['-seekable 0', '-thread_queue_size 64'])
  }

  // build the video & audio pipelines
  const complexFilter = buildComplexFilter(videos)
  command.complexFilter(complexFilter.filters, complexFilter.outputs)

  // create temporary directory
  const tmppath = tmpdir.createTmpDirectory()
  const outputKey = `${pk.choirId}+${pk.songId}+${pk.defId}-preprod.nut`
  const outpath = path.join(tmppath, outputKey)

  // set output parameters
  command
    .output(outpath)
    .outputFormat('nut') // nut container
    .outputOptions([
      '-pix_fmt yuv420p',
      '-acodec pcm_s16le', // PCM audio
      '-vcodec mpeg2video', // mpeg2video video
      //        '-preset fast', // fast
      '-r 25', // 25 fps
      //        '-qscale 1', // ?
      '-qmin 1'])
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
