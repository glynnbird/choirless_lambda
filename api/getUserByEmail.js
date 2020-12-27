const Nano = require('nano')
const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
let nano = null
let db = null

// fetch a user with email
// Parameters:
// - email - the email address of the user
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // connect to db - reuse connection if present
  if (!db) {
    nano = Nano(process.env.COUCH_URL)
    db = nano.db.use(process.env.COUCH_USERS_DATABASE)
  }

  // check for mandatory parameters
  if (!opts.email) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameters' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // fetch user from database
  let statusCode = 200
  let body = null
  try {
    const query = {
      selector: {
        email: opts.email
      }
    }
    debug('postUserLogin', query)
    const result = await db.find(query)
    const doc = result.docs ? result.docs[0] : null

    // if there is a doc for this email address
    if (doc) {
      // form the response
      body = {
        ok: true,
        user: doc
      }
      // don't show stored password & salt
      delete body.user.password
      delete body.user.salt
      delete body.user._id
      delete body.user._rev

      // infer userType if missing
      body.user.userType = body.user.userType ? body.user.userType : 'regular'
    } else {
      body = { ok: false }
      statusCode = 404
    }
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
