const Nano = require('nano')
const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
let nano = null
let db = null
const DB_NAME = process.env.COUCH_CHOIRLESS_DATABASE

// fetch a choir by known id
// Parameters:
// - `choirId` - the choir to fetch
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
  if (!choirId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameter choirId' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // fetch user from database
  let statusCode = 200
  let body = null
  try {
    debug('getChoir', choirId)
    const choir = await db.get(choirId + ':0')
    delete choir._id
    delete choir._rev
    body = { ok: true, choir: choir }
  } catch (e) {
    body = { ok: false, message: 'choir not found' }
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
