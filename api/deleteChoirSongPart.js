const Nano = require('nano')
const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
let nano = null
let db = null

// delete an invitation
// choirdId - the choir whose song is being changed
// songId - the id of the song being altered
// partId - the id of the song part being removed
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // connect to db - reuse connection if present
  if (!db) {
    nano = Nano(process.env.COUCH_URL)
    db = nano.db.use(process.env.COUCH_CHOIRLESS_DATABASE)
  }

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
  const id = opts.choirId + ':song:' + opts.songId + ':part:' + opts.partId
  try {
    debug('deleteSongPart', id)
    const doc = await db.get(id)
    await db.destroy(id, doc._rev)
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
