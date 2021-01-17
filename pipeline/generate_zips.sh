#!/bin/bash
for filename in *.py; do
  # if this is not a .test.js files
  STUB=`echo $filename | sed 's/.py//g'`
  echo "$STUB"
  rm "${STUB}.zip"
  zip -r "${STUB}.zip" "${STUB}.py"  
done
rm renderer.zip
zip -r renderer.zip renderer.js
rm renderer_compositor_main.zip
zip -r renderer_compositor_main.zip renderer_compositor_main.js
rm rawConvert.zip
zip -r rawConvert.zip rawConvert.js
