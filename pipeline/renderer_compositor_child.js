// environment variables
const LOCAL_MODE = !!process.env.LOCAL_MODE
const SRC_BUCKET = process.env.SRC_BUCKET
const DEST_BUCKET = process.env.DEST_BUCKET
const DEFINITION_BUCKET = process.env.DEFINITION_BUCKET
const TMP_DIR = process.env.TMP_DIR || '/tmp'
const LOCAL_BUCKETS_PATH = '../buckets'

// node modules
const fs = require('fs')
const path = require('path')
const aws = require('aws-sdk')
const tmp = require('tmp')
const ffmpeg = require('fluent-ffmpeg')
const run = require('ffmpegrunner').run

// aws objects
const S3 = new aws.S3()

// find top and bottom limits from a list of videos
const calcBoundingBox = (specs) => {
  let top = 1000000.0
  let bottom = -1000000.0
  for (const i in specs) {
    const spec = specs[i]
    if (!spec.position) continue
    const y = spec.position[1]
    const height = Math.floor(spec.size[1] / 2) * 2
    if (y < top) {
      top = y
    }
    if (y + height > bottom) {
      bottom = y + height
    }
  }
  return { top, bottom }
}

// calculate
const calcLayout = (specs) => {
  let layout = ''
  for (const i in specs) {
    const spec = specs[i]
    if (layout) {
      layout += '|'
    }
    layout += `${spec.position[0]}_0`
  }
  return layout
}

// build the filter graph for processing audio & video
const buildComplexFilter = (videos, outputWidth, outputHeight) => {
  // complex filter
  const filters = []
  let f
  for (const i in videos) {
    const video = videos[i]
    video.id = i.toString()

    // video pipeline
    const offset = parseInt(video.offset || '0') / 1000
    f = {
      inputs: video.id + ':v',
      filter: 'trim',
      options: {
        start: offset
      },
      outputs: 'a' + video.id
    }
    filters.push(f)
    f = {
      inputs: 'a' + video.id,
      filter: 'setpts',
      options: 'PTS-STARTPTS',
      outputs: 'b' + video.id
    }
    filters.push(f)
    f = {
      inputs: 'b' + video.id,
      filter: 'scale',
      options: {
        width: video.size[0],
        height: video.size[1],
        force_original_aspect_ratio: 'decrease',
        force_divisible_by: 2
      },
      outputs: 'c' + video.id
    }
    filters.push(f)

    // audio pipeline
    f = {
      inputs: video.id + ':a',
      filter: 'atrim',
      options: {
        start: offset
      },
      outputs: 'm' + video.id
    }
    filters.push(f)
    f = {
      inputs: 'm' + video.id,
      filter: 'asetpts',
      options: 'PTS-STARTPTS',
      outputs: 'n' + video.id
    }
    filters.push(f)
    f = {
      inputs: 'n' + video.id,
      filter: 'volume',
      options: video.volume,
      outputs: 'o' + video.id
    }
    filters.push(f)
    f = {
      inputs: 'o' + video.id,
      filter: 'stereotools',
      options: {
        mpan: video.pan
      },
      outputs: 'p' + video.id
    }
    filters.push(f)
  }

  // if we only have one video
  if (videos.length === 1) {
    // pad the video
    f = {
      inputs: 'c0',
      filter: 'pad',
      options: {
        width: outputWidth,
        height: outputHeight,
        x: videos[0].position[0],
        y: videos[0].position[1]
      },
      outputs: 'e0'
    }
    filters.push(f)

    // do nothing to the audio - just map p0->q0
    f = {
      inputs: 'p0',
      filter: 'volume',
      options: '1',
      outputs: 'q0'
    }
    filters.push(f)
  } else {
    const inputs = []

    // stack the videos into one
    // construct an array of inputs
    for (const i in videos) {
      inputs.push('c' + i)
    }
    f = {
      inputs: inputs,
      filter: 'xstack',
      options: {
        inputs: videos.length,
        fill: 'black',
        layout: calcLayout(videos)
      },
      outputs: 'd0'
    }
    filters.push(f)
    f = {
      inputs: 'd0',
      filter: 'pad',
      options: {
        width: outputWidth,
        height: outputHeight
      },
      outputs: 'e0'
    }
    filters.push(f)

    // mix the audio into one
    const ainputs = []
    for (const i in videos) {
      ainputs.push('p' + i)
    }
    f = {
      inputs: ainputs,
      filter: 'amix',
      options: {
        inputs: ainputs.length
      },
      outputs: 'q0'
    }
    filters.push(f)
  }

  // add our filter graph to the command
  return {
    filters: filters,
    outputs: ['e0', 'q0']
  }
}

const main = async (event, context) => {
  console.log('renderer_compositor_child')

  // data from the incoming event
  const definitionKey = event.definition_key
  const bits = path.parse(definitionKey).name.split('+')
  const choirId = bits[0]
  const songId = bits[1]
  const defId = bits[2]
  // const compositor = event.compositor
  const rowNum = parseInt(event.row_num)
  const rowsHash = event.rows_hash
  const runId = event.run_id
  let definition

  // The output key
  const outputKey = `${choirId}+${songId}+${defId}+${runId}+${rowNum}@${rowsHash}.nut`

  // load the definition file
  if (LOCAL_MODE) {
    const p = path.join(LOCAL_BUCKETS_PATH, DEFINITION_BUCKET, definitionKey)
    definition = fs.readFileSync(p, { encoding: 'utf8' })
  } else {
    definition = await S3.getObject({ Bucket: DEFINITION_BUCKET, Key: definitionKey }).promise()
  }
  definition = JSON.parse(definition)
  console.log(definition)

  // find the inputs we need to process
  const videos = definition.inputs.filter((i) => {
    const pos = i.position ? i.position[1] : -1
    return (pos === rowNum)
  })

  // calculate the size of this stripe of videos
  const boundingBox = calcBoundingBox(videos)
  console.log(boundingBox)
  const outputWidth = definition.output.size[0]
  const outputHeight = boundingBox.bottom - boundingBox.top + 10 // margin of 10 between rows

  // calculate S3 urls for each video
  const command = ffmpeg()
  for (const i in videos) {
    // calculate path/url of video
    const video = videos[i]
    const partId = video.part_id
    const partKey = `${choirId}+${songId}+${partId}.nut`
    let partURL
    if (LOCAL_MODE) {
      partURL = path.join(LOCAL_BUCKETS_PATH, SRC_BUCKET, partKey)
    } else {
      partURL = await S3.getSignedUrlPromise('getObject', { Bucket: SRC_BUCKET, Key: partKey })
    }
    video.url = partURL

    // add video to ffmpeg command
    command.addInput(video.url)
      .inputOptions(['-seekable 0', '-r 25', '-thread_queue_size 64'])
  }

  // build the video & audio pipelines
  const complexFilter = buildComplexFilter(videos, outputWidth, outputHeight)
  command.complexFilter(complexFilter.filters, complexFilter.outputs)

  // create temporary directory - self cleaning
  tmp.dir({ unsafeCleanup: true, tmpdir: TMP_DIR }, async (err, tmppath, done) => {
    if (err) throw err

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
        Body: fs.createReadStrean(outpath)
      }).promise()
    }
    done()
  })

  return { ok: true }
}

exports.main = main
