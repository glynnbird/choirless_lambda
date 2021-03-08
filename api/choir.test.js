const ts = new Date().getTime()

// the code we're testing
process.env.RAW_BUCKET = 'choirless-videos-raw'
process.env.FINAL_BUCKET = 'choirless-videos-final'

// setting TEST_MODE forces us to use DynamoDB on localhost:8000
process.env.TEST_MODE = 'true'
const DYNAMODB_TABLE = `choirlesstest${ts}`
process.env.TABLE = DYNAMODB_TABLE
const dynamoDB = require('./lib/dynamodb')

// the code to test
const postChoir = require('./postChoir.js').handler
const getChoir = require('./getChoir.js').handler
const getChoirMembers = require('./getChoirMembers.js').handler
const postChoirJoin = require('./postChoirJoin.js').handler
const deleteChoirJoin = require('./deleteChoirJoin.js').handler
const postChoirSong = require('./postChoirSong.js').handler
const getChoirSong = require('./getChoirSong.js').handler
const getChoirSongs = require('./getChoirSongs.js').handler
const postChoirSongPart = require('./postChoirSongPart.js').handler
const postChoirSongPartUpload = require('./postChoirSongPartUpload.js').handler
const postChoirSongPartDownload = require('./postChoirSongPartDownload.js').handler
const getChoirSongPart = require('./getChoirSongPart.js').handler
const getChoirSongParts = require('./getChoirSongParts.js').handler
const getUserChoirs = require('./getUserChoirs.js').handler
const deleteChoirSong = require('./deleteChoirSong.js').handler
const deleteChoirSongPart = require('./deleteChoirSongPart.js').handler

// test users
let rita, sue, bob, frank
let london, bristol, manchester
let song1, song2
let part1, part2, part3

beforeAll(async () => {
  // create dynamoDB table
  const params = {
    AttributeDefinitions: [
      {
        AttributeName: 'pk',
        AttributeType: 'S'
      },
      {
        AttributeName: 'sk',
        AttributeType: 'S'
      },
      {
        AttributeName: 'GSI1PK',
        AttributeType: 'S'
      },
      {
        AttributeName: 'GSI1SK',
        AttributeType: 'S'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'pk',
        KeyType: 'HASH'
      },
      {
        AttributeName: 'sk',
        KeyType: 'RANGE'
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 50,
      WriteCapacityUnits: 50
    },
    TableName: DYNAMODB_TABLE,
    StreamSpecification: {
      StreamEnabled: false
    },
    GlobalSecondaryIndexes: [
      {
        IndexName: 'gsi1',
        Projection: {
          ProjectionType: 'ALL'
        },
        KeySchema: [
          {
            AttributeName: 'GSI1PK',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'GSI1SK',
            KeyType: 'RANGE'
          }
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: '50',
          WriteCapacityUnits: '50'
        }
      }
    ]
  }
  try {
    await dynamoDB.client.createTable(params).promise()
  } catch (e) {
  }
  // test user ids
  bob = '1'
  sue = '2'
  rita = '3'
  frank = '4'
})

test('postChoir - invalid parameters', async () => {
  let obj = {
    description: 'The singers of London',
    createdByUserId: rita,
    createdByName: 'Rita',
    choirType: 'public'
  }
  let response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  obj = {
    namee: 'London singers',
    createdByName: 'Rita',
    choirType: 'public'
  }
  response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  obj = {
    name: 'London singers',
    createdByUserId: rita,
    choirType: 'public'
  }
  response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  obj = {
    namee: 'London singers',
    createdByName: 'Rita',
    createdByUserId: rita
  }
  response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)
})

test('postChoir - create choir', async () => {
  let obj = {
    name: 'London singers',
    description: 'The singers of London',
    createdByUserId: rita,
    createdByName: 'Rita',
    choirType: 'public'
  }
  let response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  london = response.body.choirId

  obj = {
    name: 'Bristol singers',
    description: 'The singers of Bristol',
    createdByUserId: rita,
    createdByName: 'Rita',
    choirType: 'private'
  }
  response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  bristol = response.body.choirId

  obj = {
    name: 'Manchester singers',
    description: 'The singers of Manchester',
    createdByUserId: sue,
    createdByName: 'Sue',
    choirType: 'public'
  }
  response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  manchester = response.body.choirId
})

test('getChoir - fetch choir - london', async () => {
  const response = await getChoir({ choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.choir.choirId).toBe(london)
  expect(response.body.choir.name).toBe('London singers')
  expect(response.body.choir.description).toBe('The singers of London')
  expect(response.body.choir.createdByUserId).toBe(rita)
  expect(response.body.choir.createdByName).toBe('Rita')
  expect(response.body.choir.choirType).toBe('public')
  expect(response.body.choir._id).toBe(undefined)
  expect(response.body.choir._rev).toBe(undefined)
})

test('getChoir - fetch choir - bristol', async () => {
  const response = await getChoir({ choirId: bristol })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.choir.choirId).toBe(bristol)
  expect(response.body.choir.name).toBe('Bristol singers')
  expect(response.body.choir.description).toBe('The singers of Bristol')
  expect(response.body.choir.createdByUserId).toBe(rita)
  expect(response.body.choir.createdByName).toBe('Rita')
  expect(response.body.choir.choirType).toBe('private')
  expect(response.body.choir._id).toBe(undefined)
  expect(response.body.choir._rev).toBe(undefined)
})

test('getChoir - fetch choir - manchester', async () => {
  const response = await getChoir({ choirId: manchester })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.choir.choirId).toBe(manchester)
  expect(response.body.choir.name).toBe('Manchester singers')
  expect(response.body.choir.description).toBe('The singers of Manchester')
  expect(response.body.choir.createdByUserId).toBe(sue)
  expect(response.body.choir.createdByName).toBe('Sue')
  expect(response.body.choir.choirType).toBe('public')
  expect(response.body.choir._id).toBe(undefined)
  expect(response.body.choir._rev).toBe(undefined)
})

test('postChoir - edit name', async () => {
  const obj = {
    name: 'London singers!',
    choirId: london
  }
  let response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  response = await getChoir({ choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.choir.name).toBe(obj.name)
})

test('postChoir - edit description', async () => {
  const obj = {
    description: 'The amazing singers of London!',
    choirId: london
  }
  let response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  response = await getChoir({ choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.choir.description).toBe(obj.description)
})

test('postChoir - edit choirType', async () => {
  const obj = {
    choirType: 'private',
    choirId: london
  }
  let response = await postChoir(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  response = await getChoir({ choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.choir.choirType).toBe(obj.choirType)
})

test('getChoirMembers - check membership', async () => {
  let response = await getChoirMembers({ choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.members.length).toBe(1)

  response = await getChoirMembers({ choirId: bristol })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.members.length).toBe(1)

  response = await getChoirMembers({ choirId: manchester })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.members.length).toBe(1)
})

test('join choir - new members', async () => {
  let obj = {
    userId: sue,
    name: 'Sue',
    choirId: london,
    memberType: 'member'
  }
  let response = await postChoirJoin(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)

  obj = {
    userId: bob,
    name: 'Bob',
    choirId: london,
    memberType: 'member'
  }
  response = await postChoirJoin(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)

  obj = {
    userId: bob,
    name: 'Bob',
    choirId: manchester,
    memberType: 'member'
  }
  response = await postChoirJoin(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)

  // make sure Sue can't join twice
  obj = {
    userId: sue,
    name: 'Sue',
    choirId: london,
    memberType: 'member'
  }
  response = await postChoirJoin(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(409)
  expect(response.body.ok).toBe(false)

  // make sure Sue can be promoted to leader
  obj = {
    userId: sue,
    name: 'Sue',
    choirId: london,
    memberType: 'leader'
  }
  response = await postChoirJoin(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)

  obj = {
    userId: frank,
    name: 'Frank',
    choirId: london,
    memberType: 'member'
  }
  response = await postChoirJoin(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
})

test('remove from choir - delete members', async () => {
  // frank's out
  const obj = {
    userId: frank,
    choirId: london
  }
  const response = await deleteChoirJoin(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
})

test('getChoirMembers - check membership again', async () => {
  let response = await getChoirMembers({ choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.members.length).toBe(3)

  response = await getChoirMembers({ choirId: bristol })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.members.length).toBe(1)

  response = await getChoirMembers({ choirId: manchester })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.members.length).toBe(2)
})

test('postChoirSong - invalid paramters', async () => {
  let obj = {
    userId: rita,
    name: 'Waterloo Sunset',
    description: 'by The Kinks'
  }
  let response = await postChoirSong(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  obj = {
    choirId: london,
    name: 'Waterloo Sunset',
    description: 'by The Kinks'
  }
  response = await postChoirSong(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  obj = {
    userId: rita,
    choirId: london,
    description: 'by The Kinks'
  }
  response = await postChoirSong(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)
})

test('postChoirSong - create songs', async () => {
  let obj = {
    choirId: london,
    userId: rita,
    name: 'Waterloo Sunset',
    description: 'by The Kinks'
  }
  let response = await postChoirSong(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  song1 = response.body.songId

  obj = {
    choirId: london,
    userId: rita,
    name: 'Love Me Do',
    description: 'by The Beatles'
  }
  response = await postChoirSong(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  song2 = response.body.songId
})

test('getChoirSong - fetch song', async () => {
  let response = await getChoirSong({ choirId: london, songId: song1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.song.name).toBe('Waterloo Sunset')

  response = await getChoirSong({ choirId: london, songId: song2 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.song.name).toBe('Love Me Do')
})

test('postChoirSong - edit song', async () => {
  const obj = {
    choirId: london,
    songId: song1,
    name: 'Waterloo Sunset!',
    description: 'by The Kinks!'
  }
  let response = await postChoirSong(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  song1 = response.body.songId

  response = await getChoirSong({ choirId: london, songId: song1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.song.name).toBe(obj.name)
  expect(response.body.song.description).toBe(obj.description)
  expect(response.body.song.partNames).toStrictEqual([])
})

test('getChoirSongs - edit song', async () => {
  let response = await getChoirSongs({ choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.songs.length).toBe(2)

  response = await getChoirSongs({ choirId: manchester })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.songs.length).toBe(0)
})

test('postChoirSongPart - create part', async () => {
  let obj = {
    choirId: london,
    songId: song1,
    userId: rita,
    partNameId: 'abc123',
    partName: 'tenor',
    partType: 'reference',
    userName: 'Rita'
  }
  let response = await postChoirSongPart(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  part1 = response.body.partId

  obj = {
    choirId: london,
    songId: song1,
    userId: sue,
    partNameId: 'ghi789',
    partName: 'alto',
    partType: 'reference',
    userName: 'Sue'
  }
  response = await postChoirSongPart(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  part2 = response.body.partId

  obj = {
    choirId: london,
    songId: song1,
    userId: bob,
    partNameId: 'yyy',
    partName: 'Piano',
    partType: 'backing',
    userName: 'Bob',
    offset: 200,
    aspectRatio: '1024:768'
  }
  response = await postChoirSongPart(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  part3 = response.body.partId
})

test('getChoirSongPart - get part', async () => {
  let response = await getChoirSongPart({ choirId: london, songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Rita')
  expect(response.body.part.partName).toBe('tenor')
  expect(response.body.part.partType).toBe('reference')

  response = await getChoirSongPart({ choirId: london, songId: song1, partId: part2 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Sue')
  expect(response.body.part.partName).toBe('alto')
  expect(response.body.part.partType).toBe('reference')

  response = await getChoirSongPart({ choirId: london, songId: song1, partId: part3 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Bob')
  expect(response.body.part.partName).toBe('Piano')
  expect(response.body.part.partType).toBe('backing')
  expect(response.body.part.offset).toBe(200)
  expect(response.body.part.aspectRatio).toBe('1024:768')
})

test('postChoirSongPart - update part', async () => {
  let response = await getChoirSongPart({ choirId: london, songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Rita')
  expect(response.body.part.partName).toBe('tenor')
  expect(response.body.part.partType).toBe('reference')
  expect(response.body.part.offset).toBe(0)
  expect(response.body.part.frontendOffset).toBe(0)
  const doc = response.body.part
  doc.partId = part1

  // edit offset
  doc.offset = 150
  response = await postChoirSongPart(doc)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  response = await getChoirSongPart({ choirId: london, songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Rita')
  expect(response.body.part.partName).toBe('tenor')
  expect(response.body.part.partType).toBe('reference')
  expect(response.body.part.offset).toBe(150)
  expect(response.body.part.frontendOffset).toBe(0)
  expect(response.body.part.volume).toBe(1.0)

  // edit partType
  doc.partType = 'backing'
  doc.aspectRatio = '400:300'
  response = await postChoirSongPart(doc)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  response = await getChoirSongPart({ choirId: london, songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Rita')
  expect(response.body.part.partName).toBe('tenor')
  expect(response.body.part.partType).toBe('backing')
  expect(response.body.part.offset).toBe(150)
  expect(response.body.part.aspectRatio).toBe('400:300')
  expect(response.body.part.hidden).toBe(false)
  expect(response.body.part.frontendOffset).toBe(0)
  expect(response.body.part.volume).toBe(1.0)

  // edit hidden
  doc.hidden = true
  response = await postChoirSongPart(doc)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  response = await getChoirSongPart({ choirId: london, songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Rita')
  expect(response.body.part.partName).toBe('tenor')
  expect(response.body.part.partType).toBe('backing')
  expect(response.body.part.offset).toBe(150)
  expect(response.body.part.aspectRatio).toBe('400:300')
  expect(response.body.part.hidden).toBe(true)
  expect(response.body.part.frontendOffset).toBe(0)
  expect(response.body.part.audio).toBe(false)
  expect(response.body.part.volume).toBe(1.0)

  // edit hidden
  doc.frontendOffset = 200
  response = await postChoirSongPart(doc)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  response = await getChoirSongPart({ choirId: london, songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Rita')
  expect(response.body.part.partName).toBe('tenor')
  expect(response.body.part.partType).toBe('backing')
  expect(response.body.part.offset).toBe(150)
  expect(response.body.part.aspectRatio).toBe('400:300')
  expect(response.body.part.hidden).toBe(true)
  expect(response.body.part.frontendOffset).toBe(200)
  expect(response.body.part.audio).toBe(false)
  expect(response.body.part.volume).toBe(1.0)

  // edit audio
  doc.audio = true
  response = await postChoirSongPart(doc)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  response = await getChoirSongPart({ choirId: london, songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Rita')
  expect(response.body.part.partName).toBe('tenor')
  expect(response.body.part.partType).toBe('backing')
  expect(response.body.part.offset).toBe(150)
  expect(response.body.part.aspectRatio).toBe('400:300')
  expect(response.body.part.hidden).toBe(true)
  expect(response.body.part.frontendOffset).toBe(200)
  expect(response.body.part.audio).toBe(true)
  expect(response.body.part.volume).toBe(1.0)

  // edit volume
  doc.volume = 0.26
  response = await postChoirSongPart(doc)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  response = await getChoirSongPart({ choirId: london, songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.body.ok).toBe(true)
  expect(response.body.part.userName).toBe('Rita')
  expect(response.body.part.partName).toBe('tenor')
  expect(response.body.part.partType).toBe('backing')
  expect(response.body.part.offset).toBe(150)
  expect(response.body.part.aspectRatio).toBe('400:300')
  expect(response.body.part.hidden).toBe(true)
  expect(response.body.part.frontendOffset).toBe(200)
  expect(response.body.part.audio).toBe(true)
  expect(response.body.part.volume).toBe(0.26)
})

test('getChoirSongParts - get all parts', async () => {
  let response = await getChoirSongParts({ songId: song1, choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.parts.length).toBe(3)

  response = await getChoirSongParts({ songId: song2, choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.parts.length).toBe(0)
})

test('getUserChoirs - get choir memberships', async () => {
  const response = await getUserChoirs({ userId: rita })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.choirs.length).toBe(2)
})

test('getUserChoirs - get choir memberships', async () => {
  const response = await getUserChoirs({ userId: 'frank' })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.choirs.length).toBe(0)
})

test('postChoirSong - create song with parts', async () => {
  const obj = {
    choirId: london,
    userId: rita,
    name: 'One Love',
    description: 'by Bob Marley',
    partNames: ['bass', 'guitar', 'organ', 'vocal', 'backing vocal']
  }
  let response = await postChoirSong(obj)
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  const songId = response.body.songId
  expect(typeof response.body.song).toBe('object')
  expect(response.body.song.partNames.length).toBe(5)
  expect(response.body.song.partNames[0]).toBe('bass')

  response = await getChoirSong({ choirId: london, songId: songId })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.song.name).toBe('One Love')
  expect(typeof response.body.song).toBe('object')
  expect(response.body.song.partNames.length).toBe(5)
  expect(response.body.song.partNames[0]).toBe('bass')
})

test('deleteChoirSongPart - delete song part', async () => {
  let response = await deleteChoirSongPart({ songId: song1, choirId: london, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)

  // check there are now 2 parts
  response = await getChoirSongParts({ songId: song1, choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(response.body.parts.length).toBe(2)
})

test('deleteChoirSongPart - invalid partId', async () => {
  const response = await deleteChoirSongPart({ songId: song1, choirId: london, partId: 'nonsense' })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
})

test('deleteChoirSongPart - missing parameters #1', async () => {
  const response = await deleteChoirSongPart({ songId: song1, choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)
})

test('deleteChoirSongPart - missing parameters #2', async () => {
  const response = await deleteChoirSongPart({ songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)
})

test('deleteChoirSongPart - missing parameters #3', async () => {
  const response = await deleteChoirSongPart({ choirId: london, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)
})

test('deleteChoirSong - delete song', async () => {
  let response = await deleteChoirSong({ songId: song1, choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)

  // check song doesn't exist
  response = await getChoirSong({ songId: song1, choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(404)
  expect(response.body.ok).toBe(false)
})

test('postChoirSongPartUpload - upload presign', async () => {
  const response = await postChoirSongPartUpload({ songId: song1, choirId: london, partId: part1, extension: 'webm' })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(typeof response.body.url).toBe('string')
  expect(typeof response.body.key).toBe('string')
  expect(response.body.method).toBe('PUT')
})

test('postChoirSongPartUpload - upload missing params', async () => {
  let response = await postChoirSongPartUpload({ choirId: london, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  response = await postChoirSongPartUpload({ songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  response = await postChoirSongPartUpload({ songId: song1, choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  response = await postChoirSongPartUpload({ })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)
})

test('postChoirSongPartDownload - download presign', async () => {
  const response = await postChoirSongPartDownload({ songId: song1, choirId: london, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(200)
  expect(response.body.ok).toBe(true)
  expect(typeof response.body.url).toBe('string')
  expect(typeof response.body.key).toBe('string')
  expect(response.body.method).toBe('GET')
})

test('postChoirSongPartDownload - download missing params', async () => {
  let response = await postChoirSongPartDownload({ choirId: london, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  response = await postChoirSongPartDownload({ songId: song1, partId: part1 })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  response = await postChoirSongPartDownload({ songId: song1, choirId: london })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)

  response = await postChoirSongPartDownload({ })
  expect(typeof response.body).toBe('string')
  response.body = JSON.parse(response.body)
  expect(response.statusCode).toBe(400)
  expect(response.body.ok).toBe(false)
})

afterAll(async () => {
  const params = {
    TableName: DYNAMODB_TABLE
  }
  await dynamoDB.client.deleteTable(params).promise()
})
