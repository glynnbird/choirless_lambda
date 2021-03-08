const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const dynamoDB = require('./lib/dynamodb.js')
const AWS = dynamoDB.AWS
const S3 = new AWS.S3()

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

  // calculate key
  const key = [opts.choirId, opts.songId, opts.partId].join('+') + '.webm'

  // generate pre-signed URL
  const params = { Bucket: process.env.RAW_BUCKET, Key: key }
  const url = await S3.getSignedUrlPromise('getObject', params)
  const body = { ok: true, method: 'GET', url: url, bucket: process.env.RAW_BUCKET, key: key }

  // return API response
  return {
    body: JSON.stringify(body),
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' }
  }
}

module.exports = { handler }
