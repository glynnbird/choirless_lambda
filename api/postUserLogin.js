const Nano = require('nano')
const debug = require('debug')('choirless')
const sha256 = require('./lib/sha256.js')
const lambda = require('./lib/lambda.js')
let nano = null
let db = null

// fetch a user with username & password
// Parameters:
// - email - the email address of the user
// - password - the password
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // connect to db - reuse connection if present
  if (!db) {
    nano = Nano(process.env.COUCH_URL)
    db = nano.db.use(process.env.COUCH_USERS_DATABASE)
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

    // if there is a doc for this email address and the password is correct
    if (doc && sha256(doc.salt + opts.password) === doc.password) {
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
      statusCode = 403
    }
  } catch (e) {
    body = { ok: false }
    statusCode = 403
  }

  // return API response
  return {
    body: JSON.stringify(body),
    statusCode: statusCode,
    headers: { 'Content-Type': 'application/json' }
  }
}

module.exports = { handler }
