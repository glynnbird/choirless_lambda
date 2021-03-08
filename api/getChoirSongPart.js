const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const aws = require('./lib/aws.js')

// fetch a song part knowing choirId/songId/partId
// Parameters:
// - `choirId` - the choir to fetch
// - `songId` - the song to fetch
// - `partId` - the part to fetch
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  if (!opts.choirId || !opts.songId || !opts.partId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // fetch part from database
  let statusCode = 200
  let body = null
  try {
    debug('getChoirSong', opts.choirId, opts.songId)
    const req = {
      TableName: aws.TABLE,
      Key: {
        pk: `song#${opts.songId}`,
        sk: `#part#${opts.partId}`
      }
    }
    const response = await aws.documentClient.get(req).promise()
    if (!response.Item) {
      throw new Error('songpart not found')
    }
    const songpart = response.Item
    delete songpart.pk
    delete songpart.sk
    body = { ok: true, part: songpart }
  } catch (e) {
    body = { ok: false, message: 'part not found' }
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
