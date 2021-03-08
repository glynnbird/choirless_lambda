const debug = require('debug')('choirless')
const kuuid = require('kuuid')
const lambda = require('./lib/lambda.js')
const dynamoDB = require('./lib/dynamodb')

// create/edit a choir's song
// Parameters:
// - `choirId` - the id of the choir
// - `userId` - the id of the user adding the song
// - `name` - the name of the song
// - `description` - a description of a song
// - `partNames` - an array of parts e.g. `['alto','tenor','soprano']`
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  const choirId = opts.choirId
  const now = new Date()
  let songId
  let doc = {}

  // is this a request to edit an existing choir
  if (opts.choirId && opts.songId) {
    try {
      debug('postChoirSong fetch song', choirId, opts.songId)
      const req = {
        TableName: dynamoDB.TABLE,
        Key: {
          pk: `choir#${choirId}`,
          sk: `#song#${opts.songId}`
        }
      }
      const response = await dynamoDB.documentClient.get(req).promise()
      if (!response.Item) {
        throw new Error('song not found')
      }
      doc = response.Item
      doc.name = opts.name ? opts.name : doc.name
      doc.description = opts.description ? opts.description : doc.description
      doc.partNames = opts.partNames ? opts.partNames : doc.partNames
      songId = opts.songId
    } catch (e) {
      return {
        body: JSON.stringify({ ok: false, message: 'song not found' }),
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    }
  } else {
    if (!opts.choirId || !opts.userId || !opts.name) {
      return {
        body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    }
    songId = kuuid.ids()
    doc = {
      pk: `choir#${choirId}`,
      sk: `#song#${songId}`,
      type: 'song',
      songId: songId,
      choirId: choirId,
      userId: opts.userId,
      name: opts.name,
      description: opts.description || '',
      partNames: opts.partNames || [],
      createdOn: now.toISOString()
    }
  }

  // write user to database
  let statusCode = 200
  let body = null
  try {
    debug('postChoirSong write song', doc)
    const req = {
      TableName: dynamoDB.TABLE,
      Item: doc
    }
    await dynamoDB.documentClient.put(req).promise()
    delete doc.pk
    delete doc.sk
    body = { ok: true, songId: songId, song: doc }
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
