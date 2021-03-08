#!/bin/bash
echo "Running DynamoDB Docker"
docker run -d -p 8000:8000 amazon/dynamodb-local

while [ '400' != $(curl -s -o /dev/null -w %{http_code} http://localhost:8000/) ]; do
  echo waiting for dynamodb to load... ;
  sleep 1;
done
