const Nano = require('nano')
const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
let nano = null
let db = null

// get an invitation
// inviteId - the id of the invitation.
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // connect to db - reuse connection if present
  if (!db) {
    nano = Nano(process.env.COUCH_URL)
    db = nano.db.use(process.env.COUCH_INVITATION_DATABASE)
  }

  // is this a request to edit an existing queue item
  if (!opts.inviteId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // get invitation doc
  let statusCode = 200
  let body = {}
  try {
    debug('getInvitation', opts.inviteId)
    const doc = await db.get(opts.inviteId)
    const now = Number(Date.now())
    if (now > doc.expires) {
      statusCode = 498
      body = { ok: false }
    } else {
      delete doc._rev
      doc.id = doc._id
      delete doc._id
      body = { ok: true, invitation: doc }
    }
  } catch (e) {
    body = { ok: false, err: 'Failed to fetch invitation' }
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
