const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const dynamoDB = require('./lib/dynamodb')

// let a user join a choir
// Parameters:
// - `choirId` - choir being joined
// - `userId` - id of user joining
// - `name` - name of user joining.
// - `memberType` - role in choir
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  const now = new Date()

  // check choirType is valid
  if (!opts.choirId || !opts.userId || !opts.name || !opts.memberType || !['leader', 'member'].includes(opts.memberType)) {
    return {
      body: JSON.stringify({ ok: false, message: 'invalid parameterss' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  let doc
  try {
    debug('postChoirJoin', opts.choirId, opts.userId)
    const req = {
      TableName: dynamoDB.TABLE,
      Key: {
        pk: `choir#${opts.choirId}`,
        sk: `#user#${opts.userId}`
      }
    }
    const response = await dynamoDB.documentClient.get(req).promise()
    if (!response.Item) {
      throw new Error('choir membership not found')
    }
    doc = response.Item
    // If we got this far, the user is already a member of the choir.
    // If they are of the same member type, we needn't do anything else
    if (doc.memberType === opts.memberType) {
      return {
        body: JSON.stringify({ ok: false, reason: 'already a member' }),
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' }
      }
    } else {
      // overwrite the member type
      doc.memberType = opts.memberType
    }
  } catch (e) {
    // new membership of choir
    doc = {
      pk: `choir#${opts.choirId}`,
      sk: `#user#${opts.userId}`,
      GSI1PK: `user#${opts.userId}`,
      GSI1SK: `#choir#${opts.choirId}`,
      type: 'choirmember',
      userId: opts.userId,
      choirId: opts.choirId,
      name: opts.name,
      joined: now.toISOString(),
      memberType: opts.memberType
    }
  }

  // write user to database
  let statusCode = 200
  let body = null
  try {
    debug('postChoirJoin write ', doc)
    const req2 = {
      TableName: dynamoDB.TABLE,
      Item: doc
    }
    await dynamoDB.documentClient.put(req2).promise()
    body = { ok: true, choirId: opts.choirId }
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
