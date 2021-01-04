#!/bin/bash
rm -rf python/
mkdir python
python -m venv choirless
source choirless/bin/activate
# install choirless_lib from git (and its dependencies) into the python directory
pip3 install "git+https://github.com/Choirless/renderer@e0f2c46d5e4b2a34fa67b034f141fb286cffab2a#egg=choirless_lib&subdirectory=python/choirless_lib" -t python
# https://github.com/kkroening/ffmpeg-python
pip3 install ffmpeg-python -t ./python
#pip install pandas -t ./python
deactivate
zip -r python.zip python/
