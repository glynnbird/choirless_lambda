const AWS = require('aws-sdk')

// config from environment variables
const REGION = process.env.REGION || 'eu-west-1'
const TABLE = process.env.TABLE || 'choirless'
AWS.config.update({ region: REGION })

const dynamoDBParams = {
  apiVersion: '2012-08-10'
}

// if we're running automated tests, use dummy creds a local DynamoDB
if (process.env.TEST_MODE === 'true') {
  // when in test mode, just feed dummy creds to aws-sdk
  AWS.config.update({ accessKeyId: 'x', secretAccessKey: 'y' })
  dynamoDBParams.endpoint = 'http://localhost:8000'
}

// S3 client
const S3 = new AWS.S3()

// dynamoDB clients
const dynamoDBClient = new AWS.DynamoDB(dynamoDBParams)
const documentClient = new AWS.DynamoDB.DocumentClient(dynamoDBParams)

module.exports = {
  AWS,
  S3,
  dynamoDBClient,
  documentClient,
  TABLE
}
