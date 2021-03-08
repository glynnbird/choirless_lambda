const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const dynamoDB = require('./lib/dynamodb')

// delete a song and its parts
// choirdId - the choir whose song is being changed
// songId - the id of the song being altered
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // is this a request to edit an existing queue item
  if (!opts.choirId || !opts.songId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // get invitation doc
  let statusCode = 200
  let body = { ok: true }
  try {
    // delete song
    debug('deleteSong', opts.choirId, opts.songId)
    const req = {
      TableName: dynamoDB.TABLE,
      Key: {
        pk: `choir#${opts.choirId}`,
        sk: `#song#${opts.songId}`
      }
    }
    await dynamoDB.documentClient.delete(req).promise()

    // delete song parts
    // first fetch them
    const req2 = {
      TableName: dynamoDB.TABLE,
      KeyConditions: {
        pk: { ComparisonOperator: 'EQ', AttributeValueList: [`song#${opts.songId}`] },
        sk: { ComparisonOperator: 'BEGINS_WITH', AttributeValueList: ['#part#'] }
      }
    }
    const response = await dynamoDB.documentClient.query(req2).promise()

    // if there are song parts to delete
    if (response.Items.length > 0) {
      // build an array of DeleteRequests
      const operations = response.Items.map((i) => {
        return { DeleteRequest: { Key: { pk: i.pk, sk: i.sk } } }
      })

      // batch them in 25s - maximum batch size for DynamoDB
      do {
        const ops = operations.splice(0, 25)
        const r = {
          RequestItems: { }
        }
        r.RequestItems[dynamoDB.TABLE] = ops
        await dynamoDB.documentClient.batchWrite(r).promise()
      } while (operations.length > 0)
    }
  } catch (e) {
    body = { ok: false, err: 'Failed to delete song' }
    statusCode = 404
  }

  // return API response
  return {
    body: JSON.stringify(body),
    statusCode: statusCode,
    headers: { 'Content-Type': 'application/json' }
  }
}

module.exports = { handler }
