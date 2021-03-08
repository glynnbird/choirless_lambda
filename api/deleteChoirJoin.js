const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const aws = require('./lib/aws.js')

// delete user's membership of a choir
// Parameters:
// - `choirId` - choir being joined
// - `userId` - id of user joining
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // check choirType is valid
  if (!opts.choirId || !opts.userId) {
    return {
      body: JSON.stringify({ ok: false, message: 'invalid parameterss' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  const body = { ok: true }
  let statusCode = 200
  try {
    // load and delete the membership doc
    debug('deleteChoirJoin', opts.choirId, opts.userId)
    const req = {
      TableName: aws.TABLE,
      Key: {
        pk: `choir#${opts.choirId}`,
        sk: `#user#${opts.userId}`
      }
    }
    await aws.documentClient.delete(req).promise()
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
