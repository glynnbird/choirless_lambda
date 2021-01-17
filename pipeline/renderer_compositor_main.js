const AWS = require('aws-sdk')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')

const handler = async (event, context) => {
  // s3 client
  const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
  // lambda client
  const lambda = new AWS.Lambda()

  // look for a key in opts and pull songId and choirId from there
  const key = unescape(event.Records[0].s3.object.key)
  const bucket = event.Records[0].s3.bucket.name
  console.log(`Bucket/key ${bucket}/${key}`)

  // Get the definition from the bucket
  const definition_object = await s3.getObject({ Bucket: bucket, Key: key }).promise()
  const definition = JSON.parse(definition_object.Body)

  const run_id = uuidv4().slice(0, 8)

  // Get the inputs for this scene
  const input_specs = definition.inputs
  // Calculate number of rows
  let rows = new Set()
  input_specs.forEach(spec => {
    const [x, y] = spec.position || [-1, -1]
    rows.add(y)
  })
  rows = Array.from(rows)
  rows.sort((a, b) => parseInt(a) - parseInt(b))

  // Calculate the hash of our rows
  const rows_str = rows.join('-')
  const rows_hash = crypto.createHash('sha1').update(rows_str).digest('hex').slice(0, 8)

  // Invoke all the child actions
  for (const i in rows) {
    const row = rows[i]
    const payload = {
      row_num: row,
      run_id: run_id,
      rows_hash: rows_hash,
      compositor: 'combined',
      key: key,
      bucket: bucket,
      definition_key: key
    }
    console.log(`Payload is ${JSON.stringify(payload)}`)

    // call the compositor lambda
    const params = {
      FunctionName: process.env.COMPOSITOR_CHILD_LAMBDA, // the lambda function we are going to invoke
      InvocationType: 'Event',
      Payload: JSON.stringify(payload)
    }
    const ret = await lambda.invoke(params).promise()
    console.log(`Ret is ${JSON.stringify(ret)}`)
  }

  return {
    status: 'spawned children',
    run_id: run_id,
    definition_key: key
  }
}

module.exports = {
  handler
}
