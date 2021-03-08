const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const aws = require('./lib/aws.js')

// fetch a song knowing choirId/songId
// Parameters:
// - `choirId` - the choir to fetch
// - `songId` - the song to fetch
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  if (!opts.choirId || !opts.songId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // fetch song from database
  let statusCode = 200
  let body = null
  try {
    debug('getChoirSong', opts.choirId, opts.songId)
    const req = {
      TableName: aws.TABLE,
      Key: {
        pk: `choir#${opts.choirId}`,
        sk: `#song#${opts.songId}`
      }
    }
    const response = await aws.documentClient.get(req).promise()
    if (!response.Item) {
      throw new Error('song not found')
    }
    const song = response.Item
    delete song.pk
    delete song.sk
    body = { ok: true, song: song }
  } catch (e) {
    body = { ok: false, message: 'song not found' }
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
