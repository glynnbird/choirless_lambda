const Nano = require('nano')
const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
let nano = null
let db = null

// get a list of live invitations
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // connect to db - reuse connection if present
  if (!db) {
    nano = Nano(process.env.COUCH_URL)
    db = nano.db.use(process.env.COUCH_INVITATION_DATABASE)
  }

  // get invitations doc
  let statusCode = 200
  let body
  try {
    const query = {
      selector: {
        expires: {
          $gt: Date.now()
        }
      }
    }
    debug('getInvitationList', query)
    const response = await db.find(query)
    body = {
      ok: true,
      invitations: response.docs.map((m) => {
        m.inviteId = m._id
        delete m._id
        delete m._rev
        return m
      })
    }
  } catch (e) {
    body = { ok: false, err: 'Failed to fetch invitations' }
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
