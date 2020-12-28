const Nano = require('nano')
const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
let nano = null
let db = null
const DB_NAME = process.env.COUCH_CHOIRLESS_DATABASE

// delete user's membership of a choir
// Parameters:
// - `choirId` - choir being joined
// - `userId` - id of user joining
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // connect to db - reuse connection if present
  if (!db) {
    nano = Nano(process.env.COUCH_URL)
    db = nano.db.use(DB_NAME)
  }

  // check choirType is valid
  if (!opts.choirId || !opts.userId) {
    return {
      body: JSON.stringify({ ok: false, message: 'invalid parameterss' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  const id = opts.choirId + ':member:' + opts.userId
  const body = { ok: true }
  let statusCode = 200
  try {
    // load and delete the membership doc
    debug('deleteChoirJoin', id)
    const doc = await db.get(id)
    await db.destroy(doc._id, doc._rev)
  } catch (e) {
    // if we got here, we weren't a member anyway!
    body.ok = false
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
