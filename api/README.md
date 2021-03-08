# Choirless API

The Choirless API allows easy manipulation of data stored in the Choirless music collabortion platform.

This API can be deployed to Lambda or run locally in Node.js. Application data is stored in Cloudant/CouchDB databases.

## Configuration

The following environment variables configure how the API accesses the database

- `REGION` - the AWS region to use e.g 'eu-west-1'
- `TABLE` - the DynamoDB table to use e.g. 'choirless'
- `TEST_MODE` - when set to `true` uses DynamoDB on localhost:8000 for test purposes
- `RAW_BUCKET` - the name of the raw S3 bucket e.g. `raw`
- `FINAL_BUCKET` - the name of the final S3 bucket e.g. `final`

## Testing

Start DynamoDB locally:

```sh
docker run -p 8000:8000 amazon/dynamodb-local
```

Execute the tests

```sh
npm run test
```
Tests are configured to run automatically in Travis.

## API Reference

Read the [API Reference](API.md).

## Objects

The following objects are stored:

```
                         +--------------+             +---------------+
                         |              |            /|               |
                         |    choir     +-------------+     song      |
                         |              |            \|               |
                         +------+-------+             +-------+-------+
                                |                             |
                                |                             |
+-------------+       +--------/-\-----------+         +-----/-\------+
|             |       |                      |         |              |
|    user     +-------+     choirmember      |         |  songpart    |
|  (cognito)  |       |                      |         |              |
+-------------+       +----------------------+         +--------------+
```

### Choirs

```js
{
  _id: "<choirid>:0",
  type: "choir",
  choirId: "<choirid>",
  name: "IBM Bristol Choir",
  description: "IBM Bristol office choir.",
  createdByUserId: "<userid>",
  createdByName: "Bob",
  createdOn: "2020-05-01",
  choirType: "private"
}
```

choirType:

- `private` - invite only
- `public` - anyone can join

### Choir Members

```js
{
  _id: "<choirid>:member:<userId>",
  type: "choirmember",
  choirId: "<choirid>",
  userId: "<userid>",
  joined: "2020-05-02",
  name: "Glynn Bird",
  choirName: "Barber Shop Choir",
  memberType: "leader"
}
```

memberType:

- `leader` - can create songs, and reference parts
- `member` - can create renditions of parts

### Songs

```js
{
  _id: "<choirid>:song:<soingid>"
  type: "song",
  name: "The Lorem Ipum Song",
  description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  choirId: "<choirid>",
  songId: "<songid>",
  userId: "<userid>",
  createdOn: "2020-05-01",
  partNames: [ "backing", "soprano", "alto", "tenor", "bass" ]
}
```

### Song parts

```js
{
  _id: "<choirid>:song:<songid>:part:<partid>"
  type: "songpart",
  choirId: "<choirid>",
  songId: "<songid>",
  partId: "<partid>",
  partName: "alto",
  partType: "rendition",
  createdBy: "<userid>",
  name: "Glynn Bird",
  createdOn: "2020-05-01",
  offset: 200,
  frontendOffset: 150,
  aspectRatio: "4:3",
  hidden: false,
  audio: false,
  volume: 1.0
}
```

partType:

- `backing` - backing track
- `reference` - exemplar rendition of part
- `rendition` - choir members rendition of a reference part
