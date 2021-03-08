const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const aws = require('./lib/aws.js')

// fetch choir members
// Parameters:
// - `choirId` - the choir to fetch
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

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
    debug('getChoirMembers', choirId)
    const req = {
      TableName: aws.TABLE,
      KeyConditions: {
        pk: { ComparisonOperator: 'EQ', AttributeValueList: [`choir#${choirId}`] },
        sk: { ComparisonOperator: 'BEGINS_WITH', AttributeValueList: ['#user#'] }
      }
    }
    const response = await aws.documentClient.query(req).promise()
    body = {
      ok: true,
      members: response.Items.map((i) => {
        delete i.GSI1PK
        delete i.GSI1SK
        delete i.pk
        delete i.sk
        return i
      })
    }
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
