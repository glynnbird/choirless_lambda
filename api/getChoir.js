const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const aws = require('./lib/aws.js')

// fetch a choir by known id
// Parameters:
// - `choirId` - the choir to fetch
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  const choirId = opts.choirId
  if (!choirId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameter choirId' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // fetch user from database
  let statusCode = 200
  let body = null
  try {
    debug('getChoir', choirId)
    const req = {
      TableName: aws.TABLE,
      Key: {
        pk: `choir#${choirId}`,
        sk: '#profile'
      }
    }
    const response = await aws.documentClient.get(req).promise()
    if (!response.Item) {
      throw new Error('choir not found')
    }
    const choir = response.Item
    delete choir.pk
    delete choir.sk
    body = { ok: true, choir: choir }
  } catch (e) {
    body = { ok: false, message: 'choir not found' }
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
