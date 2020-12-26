#!/bin/bash
rm -rf nodejs
rm -rf node_modules
rm choirless_layer.zip
npm ci
mkdir nodejs
cp -r lib nodejs
cp -ir node_modules nodejs
zip -r choirless_layer.zip nodejs/
