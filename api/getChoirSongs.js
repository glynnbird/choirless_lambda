const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const aws = require('./lib/aws.js')

// fetch the songs of a choir
// Parameters:
// - `choirId` - the choir to fetch
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  if (!opts.choirId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // fetch user from database
  let statusCode = 200
  let body = null
  try {
    debug('getChoirSongs', opts.choirId)
    const req = {
      TableName: aws.TABLE,
      KeyConditions: {
        pk: { ComparisonOperator: 'EQ', AttributeValueList: [`choir#${opts.choirId}`] },
        sk: { ComparisonOperator: 'BEGINS_WITH', AttributeValueList: ['#song#'] }
      }
    }
    const response = await aws.documentClient.query(req).promise()
    body = {
      ok: true,
      songs: response.Items.map((i) => {
        delete i.pk
        delete i.sk
        return i
      })
    }
  } catch (e) {
    body = { ok: false, message: 'songs not found' }
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
