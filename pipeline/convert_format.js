// environment variables
const LOCAL_MODE = !!process.env.LOCAL_MODE
const DEST_BUCKET = process.env.DEST_BUCKET
const TMP_DIR = process.env.TMP_DIR || '/tmp'
const LOCAL_BUCKETS_PATH = '../buckets'

// node modules
const fs = require('fs')
const path = require('path')
const aws = require('aws-sdk')
const tmp = require('tmp')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegrunner = require('ffmpegrunner')
const run = ffmpegrunner.run
const probe = ffmpegrunner.probe

// aws objects
const S3 = new aws.S3()

const main = async (event, context) => {
  let geturl, desturl
  console.log('convert_format')
  const key = event.key
  const bucket = event.bucket
  console.log(`Running on ${bucket}/${key}`)
  const outputKey = path.parse(key).name + '.nut'

  // when running locally
  if (LOCAL_MODE) {
    geturl = path.join(LOCAL_BUCKETS_PATH, bucket, key)
    desturl = path.join(LOCAL_BUCKETS_PATH, DEST_BUCKET, outputKey)
  } else {
    // Generate the URL to get key from bucket
    geturl = await S3.getSignedUrlPromise('getObject', { Bucket: bucket, Key: key })
  }

  const probeResults = await probe(geturl)
  const videoPresent = !!(probeResults.streams.filter((s) => s.codec_type === 'video').length)
  const audioPresent = !!(probeResults.streams.filter((s) => s.codec_type === 'video').length)
  console.log('videoPresent', videoPresent)
  console.log('audioPresent', audioPresent)

  // set ffmpeg inputs
  const command = ffmpeg()
    .input(geturl)
    .inputOptions('-seekable 0')
  if (videoPresent) {
    // force input video to 25 fps, 640x480
    command
      .videoFilter('fps=fps=25:round=up')
      .videoFilter('scale=640x480:force_original_aspect_ratio=decrease:force_divisible_by=2')
  } else {
    // black dummy video
    command
      .input('color=color=black:size=vga')
      .inputFormat('lavfi')
  }
  if (!audioPresent) {
    // silent dummy audio
    command
      .input('anullsrc')
      .inputFormat('lavfi')
  }

  // create temporary directory - self cleaning
  tmp.dir({ unsafeCleanup: true, tmpdir: TMP_DIR }, async (err, tmppath, done) => {
    if (err) throw err

    const outpath = path.join(tmppath, outputKey)

    // set output parameters
    command
      .output(outpath)
      .outputFormat('nut') // nut container
      .outputOptions([
        '-acodec pcm_f32le', // PCM audio
        '-vcodec libx264', // H.264 video
        '-preset fast', // fast
        '-r 25', // 25 fps
        '-ac 1']) // mono
    await run(command, true)

    // copy the temporary file to output bucket
    if (LOCAL_MODE) {
      fs.copyFileSync(outpath, desturl)
    } else {
      // upload to S3
      await S3.putObject({
        Bucket: DEST_BUCKET,
        Key: outputKey,
        Body: fs.createReadStrean(outpath)
      }).promise()
    }
    done()
  })
}
