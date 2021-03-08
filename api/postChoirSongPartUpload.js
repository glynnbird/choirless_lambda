const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const AWS = require('aws-sdk')
const S3 = new AWS.S3()

// generate URL to allow upload of a song part's video
// Parameters:
// - `choirId` - the id of the choir (required)
// - `songId` - the id of the song (required)
// - `partId` - the id of the part (required)
// - `extension` - the file extension (required) e.g. webm
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // check for mandatory paramters
  if (!opts.choirId || !opts.songId || !opts.partId || !opts.extension) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  debug('postChoirSongPartUpload generate put url', opts.partId)

  // calculate key
  const key = [opts.choirId, opts.songId, opts.partId].join('+') + '.' + opts.extension

  // generate pre-signed URL
  const params = { Bucket: process.env.COS_DEFAULT_BUCKET, Key: key }
  const url = await S3.getSignedUrlPromise('putObject', params)
  const body = { ok: true, method: 'PUT', url: url, bucket: process.env.COS_DEFAULT_BUCKET, key: key }

  // return API response
  return {
    body: JSON.stringify(body),
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' }
  }
}

module.exports = { handler }
