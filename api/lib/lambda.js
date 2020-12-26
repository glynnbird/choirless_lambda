
// see https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
const processEvent = (e) => {
  if (!e) {
    return {}
  }
  // if this is a Lambda event, extract the POST/GET parameters
  if (e.httpMethod) {
    let retval
    // GET call's parameters are on the querystring
    if (e.httpMethod === 'GET') {
      retval = e.queryStringParameters
    } else {
      // POST/PUT/DELETE call's parameters are JSON-encoded in the body
      retval = JSON.parse(e.body)
    }
    return retval
  } else {
    // this isn't a Lambda event so just return what we had
    return e
  }
}

module.exports = processEvent
