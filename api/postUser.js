const Nano = require('nano')
const debug = require('debug')('choirless')
const kuuid = require('kuuid')
const sha256 = require('./lib/sha256.js')
const lambda = require('./lib/lambda.js')
let nano = null
let db = null

const userExists = async (email) => {
  const query = {
    selector: {
      email: email
    }
  }
  const result = await db.find(query)
  return (result.docs && result.docs.length > 0)
}

// create/edit a user
// Parameters:
// - userId - the id of the user to edit (or blank to create new one)
// - name - name of user
// - password - password of user
// - email - email of user
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // connect to db - reuse connection if present
  if (!db) {
    nano = Nano(process.env.COUCH_URL)
    db = nano.db.use(process.env.COUCH_USERS_DATABASE)
  }

  // extract parameters
  const userId = opts.userId
  let doc = {}

  // check userType is valid
  if (opts.userType && !['regular', 'admin'].includes(opts.userType)) {
    return {
      body: JSON.stringify({ ok: false, message: 'invalid userType' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // is this a request to edit an existing user
  if (userId) {
    try {
      debug('postUser fetch user', userId)
      doc = await db.get(userId)
      // infer userType if missing
      doc.userType = doc.userType ? doc.userType : 'regular'
      doc.name = opts.name ? opts.name : doc.name
      doc.userType = opts.userType ? opts.userType : doc.userType

      // if the email address is being changed, make sure it's not already taken
      if (opts.email && opts.email !== doc.email) {
        if (await userExists(opts.email)) {
          return {
            body: JSON.stringify({ ok: false, message: 'duplicate user' }),
            statusCode: 409,
            headers: { 'Content-Type': 'application/json' }
          }
        }
      }
      doc.email = opts.email ? opts.email : doc.email
      if (opts.password) {
        doc.salt = kuuid.id()
        doc.password = sha256(doc.salt + opts.password)
      }
      doc.verified = !!opts.verified
    } catch (e) {
      return {
        body: JSON.stringify({ ok: false, message: 'user not found' }),
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    }
  } else {
    // new user creation
    if (!opts.name || !opts.password || !opts.email) {
      return {
        body: JSON.stringify({ ok: false, message: 'missing mandatory parameters name/password/email' }),
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    }

    // first check that user with this email doesn't already exist
    if (await userExists(opts.email)) {
      return {
        body: JSON.stringify({ ok: false, message: 'duplicate user' }),
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' }
      }
    }

    // create user
    const id = kuuid.id()
    const salt = kuuid.id()
    const now = new Date()
    doc = {
      _id: id,
      type: 'user',
      userId: id,
      userType: opts.userType ? opts.userType : 'regular',
      name: opts.name,
      email: opts.email,
      salt: salt,
      password: sha256(salt + opts.password),
      verified: false,
      createdOn: now.toISOString()
    }
  }

  // write user to database
  let statusCode = 200
  let body = null
  try {
    debug('postUser write user', doc)
    const response = await db.insert(doc)
    body = { ok: true, userId: response.id }
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
