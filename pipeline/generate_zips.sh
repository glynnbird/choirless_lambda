#!/bin/bash
for filename in *.js; do
  # if this is not a .test.js files
  STUB=`echo $filename | sed 's/.js//g'`
  echo "$STUB"
  rm "${STUB}.zip"
  zip -r "${STUB}.zip" "${STUB}.js"  
done
