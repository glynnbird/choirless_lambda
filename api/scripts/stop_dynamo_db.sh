#!/usr/bin/env bash

if [ ! -z $TRAVIS ]; then
  echo "Stopping DynamoDB Docker"
  docker stop $(docker ps -a -q)
fi
