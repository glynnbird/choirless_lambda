const debug = require('debug')('choirless')
const kuuid = require('kuuid')
const lambda = require('./lib/lambda.js')
const aws = require('./lib/aws.js')

// create/edit a choir's song part
// Parameters:
// - `choirId` - the id of the choir (required)
// - `songId` - the id of the song (required)
// - `partId` - the id of the part (required for updates, if omitted a new song part is created)
// - `partName` - name of the part e.g. drums, alto
// - `partType` - one of `backing`/`reference`/`rendition`
// - `userId` - the id of the user (required for new parts)
// - `userName` - the name of the user (required for new parts)
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  const now = new Date()
  let partId
  let doc = {}

  // is this a request to edit an existing song part
  if (opts.choirId && opts.songId && opts.partId) {
    try {
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
      doc = response.Item
      doc.partType = opts.partType ? opts.partType : doc.partType
      doc.offset = typeof opts.offset === 'number' ? opts.offset : doc.offset
      doc.frontendOffset = typeof opts.frontendOffset === 'number' ? opts.frontendOffset : doc.frontendOffset || 0
      doc.aspectRatio = opts.aspectRatio ? opts.aspectRatio : doc.aspectRatio
      doc.hidden = typeof opts.hidden === 'boolean' ? opts.hidden : doc.hidden || false
      doc.audio = typeof opts.audio === 'boolean' ? opts.audio : doc.audio || false
      doc.volume = opts.volume ? opts.volume : doc.volume
      partId = opts.partId
    } catch (e) {
      return {
        body: JSON.stringify({ ok: false, message: 'song part not found' }),
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    }
  } else {
    if (!opts.choirId || !opts.songId || !opts.userId || !opts.userName) {
      return {
        body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    }
    partId = kuuid.ids()
    doc = {
      pk: `song#${opts.songId}`,
      sk: `#part#${partId}`,
      type: 'songpart',
      partId: partId,
      songId: opts.songId,
      choirId: opts.choirId,
      userId: opts.userId,
      userName: opts.userName,
      createdOn: now.toISOString(),
      partName: opts.partName || '',
      partType: opts.partType || 'backing',
      offset: opts.offset || 0,
      frontendOffset: opts.frontendOffset || 0,
      aspectRatio: opts.aspectRatio || '640:480',
      volume: opts.volume || 1.0,
      hidden: false,
      audio: typeof opts.audio === 'boolean' ? opts.audio : false
    }
  }

  // write songpart to database
  let statusCode = 200
  let body = null
  try {
    debug('postChoirSongPart write data', doc)
    const req = {
      TableName: aws.TABLE,
      Item: doc
    }
    await aws.documentClient.put(req).promise()
    body = { ok: true, partId: partId }
  } catch (e) {
    body = { ok: false }
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
