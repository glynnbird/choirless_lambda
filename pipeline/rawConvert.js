// will get triggered from Ra bucket. Will call AWS transcode to convert format and generate a thumbnail
// will also populate status

const AWS = require('aws-sdk')

const eltr = new AWS.ElasticTranscoder({
  apiVersion: '2012–09–25'
})

exports.handler = async function (event, context) {
  console.log('Executing Elastic Transcoder Orchestrator')
  const key = unescape(event.Records[0].s3.object.key)
  const pipelineId = process.env.PIPELINE_ID
  const presetId = process.env.PRESET_ID
  const bits = key.split('.')[0].split('+')
  const choirId = bits[0]
  const songId = bits[1]
  const partId = bits[2]

  const newKey = key.split('.')[0]

  const params = {
    PipelineId: pipelineId,
    OutputKeyPrefix: choirId + '-' + songId + '/',
    Input: {
      Key: key
      // FrameRate: ‘auto’,
      // Resolution: ‘auto’,
      // AspectRatio: ‘auto’,
      // Interlaced: ‘auto’,
      // Container: ‘auto’
    },
    Outputs: [{
      Key: partId + '.mp4',
      ThumbnailPattern: partId + '-{count}',
      PresetId: presetId
    }]
  }
  console.log('Starting Job')

  await eltr.createJob(params).promise()

  // call the status lambda
  const lambda = new AWS.Lambda()
  const payload = { ok: true, choir_id: choirId, song_id: songId, part_id: partId, status: 'new' }
  const lambdaparams = {
    FunctionName: process.env.STATUS_LAMBDA, // the lambda function we are going to invoke
    InvocationType: 'Event',
    Payload: JSON.stringify(payload)
  }
  await lambda.invoke(lambdaparams).promise()
}
