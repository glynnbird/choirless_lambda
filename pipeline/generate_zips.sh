#!/bin/bash
for filename in *.py; do
  # if this is not a .test.js files
  STUB=`echo $filename | sed 's/.py//g'`
  echo "$STUB"
  rm "${STUB}.zip"
  zip -r "${STUB}.zip" "${STUB}.py"  
done
