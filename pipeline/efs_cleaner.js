const fs = require('fs')
const path = require('path')

const main = async (event) => {
  console.log('starting...')
  // directory path
  const dir = process.env.TMP_DIR
  const today = new Date().getTime() // today's date in ms
  const oneDay = 1000 * 60 * 60 * 24 // milliseconds in a day
  let files

  // list all files in the directory
  try {
    files = fs.readdirSync(dir)
    console.log('Found files ', files)
  } catch (e) {
    console.log('Error reading files: ', e)
    throw e
  }

  // now run through the files and see when they were created
  // If more than a week ago, then delete it
  for (const i in files) {
    const file = files[i]
    const filename = path.join(dir, file)

    console.log('file is ', filename)
    try {
      const stats = fs.statSync(filename)
      const creationdate = stats.atimeMs
      console.log('creation date is', creationdate)
      const fileage = today - creationdate // in ms
      if (fileage >= oneDay) {
        console.log('file needs to be deleted')
        try {
          fs.rmdirSync(filename, { recursive: true })
        } catch (e) {
          console.log('Error deleting file.. trying to carry on: ', e)
        }
      } else {
        console.log('file is ok to stay')
      }
    } catch (e) {
      console.log('Error reading file stats... will try to carry on: ', e)
    }
  }

  console.log('finishing')
}

exports.main = main
