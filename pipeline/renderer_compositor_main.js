// environment variables
const LOCAL_MODE = !!process.env.LOCAL_MODE
const COMPOSITOR_CHILD_LAMBDA = process.env.COMPOSITOR_CHILD_LAMBDA
const LOCAL_BUCKETS_PATH = '../buckets'

// node modules
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')

// aws objects
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
const lambda = new AWS.Lambda()

// main
const main = async (event, context) => {
  console.log('renderer_compositor_child')
  let definition

  // look for a key in opts and pull songId and choirId from there
  const key = unescape(event.Records[0].s3.object.key)
  const bucket = event.Records[0].s3.bucket.name
  console.log(`Bucket/key ${bucket}/${key}`)

  // Get the definition from the bucket
  if (LOCAL_MODE) {
    const p = path.join(LOCAL_BUCKETS_PATH, bucket, key)
    definition = fs.readFileSync(p, { encoding: 'utf8' })
  } else {
    definition = await s3.getObject({ Bucket: bucket, Key: key }).promise()
    definition = definition.Body
  }
  definition = JSON.parse(definition)

  // generate a new run id
  const runId = uuidv4().slice(0, 8)

  // Get the inputs for this scene
  const inputSpecs = definition.inputs

  // Calculate number of rows
  let rows = new Set()
  inputSpecs.forEach(spec => {
    const [x, y] = spec.position || [-1, -1]
    rows.add(y)
  })
  rows = Array.from(rows)
  rows.sort((a, b) => parseInt(a) - parseInt(b))

  // Calculate the hash of our rows
  const rowsStr = rows.join('-')
  const rowsHash = crypto.createHash('sha1').update(rowsStr).digest('hex').slice(0, 8)

  // Invoke all the child actions
  for (const i in rows) {
    const row = rows[i]
    const payload = {
      row_num: row,
      run_id: runId,
      rows_hash: rowsHash,
      compositor: 'combined',
      key: key,
      bucket: bucket,
      definition_key: key
    }
    console.log(`Payload is ${JSON.stringify(payload)}`)

    // call the compositor lambda
    if (!LOCAL_MODE) {
      const params = {
        FunctionName: COMPOSITOR_CHILD_LAMBDA, // the lambda function we are going to invoke
        InvocationType: 'Event',
        Payload: JSON.stringify(payload)
      }
      const ret = await lambda.invoke(params).promise()
      console.log(`Ret is ${JSON.stringify(ret)}`)
    }
  }

  return {
    status: 'spawned children',
    run_id: runId,
    definition_key: key
  }
}

exports.main = main
