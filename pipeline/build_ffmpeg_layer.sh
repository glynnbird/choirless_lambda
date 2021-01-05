#!/bin/bash
rm ffmpeg.zip
rm ffprobe.zip
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar xvf ffmpeg-release-amd64-static.tar.xz
mkdir -p ffmpeg/bin
mkdir -p ffprobe/bin
cp ffmpeg-4.3.1-amd64-static/ffmpeg ffmpeg/bin/
cp ffmpeg-4.3.1-amd64-static/ffprobe ffprobe/bin/
#cp ffmpeg-4.3.1-amd64-static/ffprobe ffmpeg/bin/
cd ffmpeg
zip -r ../ffmpeg.zip .
cd ..
cd ffprobe
zip -r ../ffprobe.zip .
cd ..
rm ffmpeg-release-amd64-static.tar.xz
rm -rf ffmpeg-4.3.1-amd64-static
rm -rf ffmpeg
rm -rf ffprobe

