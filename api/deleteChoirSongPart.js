const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const dynamoDB = require('./lib/dynamodb')

// delete an invitation
// choirdId - the choir whose song is being changed
// songId - the id of the song being altered
// partId - the id of the song part being removed
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // check mandatory parameters
  if (!opts.choirId || !opts.songId || !opts.partId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // delete song part
  let statusCode = 200
  let body = { ok: true }
  try {
    debug('deleteSongPart', opts.songId, opts.partId)
    const req = {
      TableName: dynamoDB.TABLE,
      Key: {
        pk: `song#${opts.songId}`,
        sk: `#part#${opts.partId}`
      }
    }
    await dynamoDB.documentClient.delete(req).promise()
  } catch (e) {
    body = { ok: false, err: 'Failed to delete song part' }
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
