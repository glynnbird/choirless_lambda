const AWS = require('aws-sdk')
const REGION = process.env.REGION || 'eu-west-1'
const TABLE = process.env.TABLE || 'choirless'
AWS.config.update({ region: REGION })
const dynamoDBParams = {
  apiVersion: '2012-08-10'
}
if (process.env.TEST_MODE === 'true') {
  dynamoDBParams.endpoint = 'http://localhost:8000'
}
const client = new AWS.DynamoDB(dynamoDBParams)
const documentClient = new AWS.DynamoDB.DocumentClient(dynamoDBParams)

module.exports = {
  AWS,
  client,
  documentClient,
  TABLE
}
