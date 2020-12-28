const Nano = require('nano')
const debug = require('debug')('choirless')
const kuuid = require('kuuid')
const lambda = require('./lib/lambda.js')
let nano = null
let db = null
const DB_NAME = process.env.COUCH_CHOIRLESS_DATABASE

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

  // connect to db - reuse connection if present
  if (!db) {
    nano = Nano(process.env.COUCH_URL)
    db = nano.db.use(DB_NAME)
  }

  // extract parameters
  const choirId = opts.choirId
  const now = new Date()
  let songId
  let doc = {}

  // is this a request to edit an existing choir
  if (opts.choirId && opts.songId) {
    try {
      debug('postChoirSong fetch song', choirId)
      doc = await db.get(opts.choirId + ':song:' + opts.songId)
      doc.name = opts.name ? opts.name : doc.name
      doc.description = opts.description ? opts.description : doc.description
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
    songId = kuuid.id()
    let partNames = []
    if (opts.partNames) {
      partNames = opts.partNames.map((p) => { return { partNameId: kuuid.id(), name: p } })
    }
    doc = {
      _id: opts.choirId + ':song:' + songId,
      type: 'song',
      songId: songId,
      choirId: opts.choirId,
      userId: opts.userId,
      name: opts.name,
      description: opts.description || '',
      partNames: partNames,
      createdOn: now.toISOString()
    }
  }

  // write user to database
  let statusCode = 200
  let body = null
  try {
    debug('postChoirSong write song', doc)
    await db.insert(doc)
    delete doc._rev
    delete doc._id
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
