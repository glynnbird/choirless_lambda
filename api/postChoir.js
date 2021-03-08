const debug = require('debug')('choirless')
const kuuid = require('kuuid')
const lambda = require('./lib/lambda.js')
const aws = require('./lib/aws.js')

// create/edit a choir
// Parameters:
// - `choirId` - if omitted a new choir is generated.
// - `name` - name of choir.
// - `description` - description of choir.
// - `createdByUserId` - id of user creating the choir. (required for new choirs)
// - `createdByName` - name of user creating the choir. (required for new choirs)
// - `choirType` - one of `private`/`public`. (required for new choirs)
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  let choirId = opts.choirId
  const now = new Date()
  let doc = {}
  let creationMode = false

  // check choirType is valid
  if (opts.choirType && !['private', 'public'].includes(opts.choirType)) {
    return {
      body: JSON.stringify({ ok: false, message: 'invalid choirType' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // is this a request to edit an existing choir
  if (choirId) {
    try {
      debug('postChoir fetch choir', choirId)
      const req = {
        TableName: aws.TABLE,
        Key: {
          pk: `choir#${choirId}`,
          sk: '#profile'
        }
      }
      const response = await aws.documentClient.get(req).promise()
      if (!response.Item) {
        throw new Error('choir not found')
      }
      doc = response.Item
      doc.name = opts.name ? opts.name : doc.name
      doc.description = opts.description ? opts.description : doc.description
      doc.choirType = opts.choirType ? opts.choirType : doc.choirType
    } catch (e) {
      return {
        body: JSON.stringify({ ok: false, message: 'choir not found' }),
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    }
  } else {
    if (!opts.name || !opts.createdByUserId || !opts.createdByName || !opts.choirType) {
      return {
        body: JSON.stringify({ ok: false, message: 'missing mandatory parameters name/createdByUserId/createdByName/choirType' }),
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    }
    choirId = kuuid.ids()
    creationMode = true
    doc = {
      type: 'choir',
      choirId: choirId,
      name: opts.name,
      description: opts.description,
      choirType: opts.choirType,
      createdOn: now.toISOString(),
      createdByUserId: opts.createdByUserId,
      createdByName: opts.createdByName
    }
  }

  // write choir to database
  let statusCode = 200
  let body = null
  try {
    debug('postChoir write choir', doc)
    doc.pk = `choir#${doc.choirId}`
    doc.sk = '#profile'
    const req = {
      TableName: aws.TABLE,
      Item: doc
    }
    await aws.documentClient.put(req).promise()

    // if this is the creation of a new choir
    if (creationMode) {
      // add the choir creator as a member
      const member = {
        pk: doc.pk,
        sk: `#user#${opts.createdByUserId}`,
        GSI1PK: `user#${opts.createdByUserId}`,
        GSI1SK: `#${doc.pk}`,
        type: 'choirmember',
        choirId: choirId,
        userId: opts.createdByUserId,
        joined: now.toISOString(),
        name: opts.createdByName,
        memberType: 'leader'
      }
      const req2 = {
        TableName: aws.TABLE,
        Item: member
      }
      await aws.documentClient.put(req2).promise()
    }
    body = { ok: true, choirId: choirId }
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
