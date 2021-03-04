const AWS = require('aws-sdk')
const REGION = process.env.REGION || 'eu-west-1'
const TABLE = process.env.TABLE || 'choirless'
AWS.config.update({ region: REGION })
const client = new AWS.DynamoDB({apiVersion: '2012-08-10'})
const documentClient = new AWS.DynamoDB.DocumentClient()

module.exports = {
  client,
  documentClient,
  TABLE
}