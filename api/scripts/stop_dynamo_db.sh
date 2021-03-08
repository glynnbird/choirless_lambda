#!/usr/bin/env bash
echo "Stopping DynamoDB Docker"
docker stop $(docker ps -a -q)
