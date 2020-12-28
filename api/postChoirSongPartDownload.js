const debug = require('debug')('choirless')
const presign = require('./lib/presign.js')
const lambda = require('./lib/lambda.js')

// generate URL to allow upload of a song part's video
// Parameters:
// - `choirId` - the id of the choir (required)
// - `songId` - the id of the song (required)
// - `partId` - the id of the part (required)
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // check for mandatory paramters
  if (!opts.choirId || !opts.songId || !opts.partId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  debug('postChoirSongPartDownload generate get url', opts.partId)

  // calculate bucket and key
  const method = 'GET'
  const key = [opts.choirId, opts.songId, opts.partId].join('+') + '.webm'

  // generate pre-signed URL
  const url = presign(method, key)
  const body = { ok: true, method: method, url: url, bucket: process.env.COS_DEFAULT_BUCKET, key: key }

  // return API response
  return {
    body: JSON.stringify(body),
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' }
  }
}

module.exports = { handler }
