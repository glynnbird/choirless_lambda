const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const dynamoDB = require('./lib/dynamodb')

// fetch the song parts of a choir's song
// Parameters:
// - `songId` - the song to fetch
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  if (!opts.songId || !opts.choirId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // fetch parts from database
  let statusCode = 200
  let body = null
  try {
    debug('getChoirSongParts', opts.songId)
    const req = {
      TableName: dynamoDB.TABLE,
      KeyConditions: {
        pk: { ComparisonOperator: 'EQ', AttributeValueList: [`song#${opts.songId}`] },
        sk: { ComparisonOperator: 'BEGINS_WITH', AttributeValueList: ['#part#'] }
      }
    }
    const response = await dynamoDB.documentClient.query(req).promise()
    body = {
      ok: true,
      parts: response.Items.map((i) => {
        delete i.pk
        delete i.sk
        return i
      })
    }
  } catch (e) {
    body = { ok: false, message: 'song parts not found' }
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
