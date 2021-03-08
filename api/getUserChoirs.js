
const debug = require('debug')('choirless')
const lambda = require('./lib/lambda.js')
const dynamoDB = require('./lib/dynamodb')

// get a list of choirs a user belongs to
// Parameters:
// - userId - the id of the user to fetch
const handler = async (opts) => {
  // pre-process lambda event
  opts = lambda(opts)

  // extract parameters
  const userId = opts.userId
  if (!userId) {
    return {
      body: JSON.stringify({ ok: false, message: 'missing mandatory parameter userId' }),
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  // fetch choir memberships
  let statusCode = 200
  let body = null
  try {
    debug('getUserChoirs', userId)
    const req = {
      TableName: dynamoDB.TABLE,
      IndexName: 'gsi1',
      KeyConditions: {
        GSI1PK: { ComparisonOperator: 'EQ', AttributeValueList: [`user#${opts.userId}`] },
        GSI1SK: { ComparisonOperator: 'BEGINS_WITH', AttributeValueList: ['#choir#'] }
      }
    }
    const response = await dynamoDB.documentClient.query(req).promise()
    body = {
      ok: true,
      choirs: response.Items.map((i) => {
        delete i.GSI1PK
        delete i.GSI1SK
        delete i.pk
        delete i.sk
        return i
      })
    }
  } catch (e) {
    body = { ok: false, message: 'not found' }
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
