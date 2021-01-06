#!/bin/bash
rm python.zip
rm -rf python/
mkdir python
python -m venv choirless
source choirless/bin/activate
# install choirless_lib from git (and its dependencies) into the python directory
# pip3 install "git+https://github.com/Choirless/renderer@e0f2c46d5e4b2a34fa67b034f141fb286cffab2a#egg=choirless_lib&subdirectory=python/choirless_lib" -t python

# https://github.com/kkroening/ffmpeg-python
pip3 install ffmpeg-python -t ./python

# https://requests.readthedocs.io/en/master/
pip3 install requests -t ./python

# https://matplotlib.org/index.html
pip3 install matplotlib -t ./python

# https://github.com/librosa/librosa
pip3 install librosa -t ./python

# https://numpy.org/
pip3 install numpy -t ./python

# https://www.scipy.org/index.html
pip3 install scipy -t ./python

# https://github.com/novoic/surfboard
pip3 install surfboard -t ./python

# https://github.com/pykalman/pykalman
pip3 install pykalman -t ./python

deactivate
zip -r python.zip python/
