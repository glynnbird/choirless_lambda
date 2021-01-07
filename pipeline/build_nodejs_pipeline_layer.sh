#!/bin/bash
rm -rf nodejs
rm -rf node_modules
rm nodejs_pipeline_layer.zip
npm ci
mkdir nodejs
cp -r lib nodejs
cp -ir node_modules nodejs
zip -r nodejs_pipeline_layer.zip nodejs/

