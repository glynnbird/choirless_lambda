# Choirless API

### POST /getUserChoirs

Get a list of the choirs that a user is a member of

Parameters:

- `userId` - user id

Returns:

```js
{
  ok: true,
  choirs: [ { choir1 }. { choir 2 } ]
}
```

## Choir

### POST /getChoir

Fetch a choir by known choirId.

Parameters:

- `choirId` - the choir to fetch

Returns

```js
{
  ok: true,
  choir: { ... choir doc ... }
}
```

### POST /postChoir

Create a new choir or edits an existing one.

Parameters:

- `choirId` - if omitted a new choir is generated.
- `name` - name of choir. (required for new choirs)
- `description` - description of choir.
- `createdByUserId` - id of user creating the choir. (required for new choirs)
- `createdByName` - name of user creating the choir. (required for new choirs)
- `choirType` - one of `private`/`public`. (required for new choirs)

Returns:

```js
{
  ok: true
}
```

### POST /getChoirMembers

Fetch a list of the members of a choir.

Parameters:

- `choirId` - the choir to fetch

Returns

```js
{
  ok: true,
  members: [ { ... choir member doc ... } ]
}
```

### POST /postChoirJoin

Add a user to a choir, or call again to edit the `memberType` e.g. promote member to leader

Parameters:

- `choirId` - the choir to join
- `userId` - the user joining the choir
- `name` - the name of the user joining the choir
- `memberType` - one of `leader`/`member`

Returns

```js
{
  ok: true
}
```

### POST /deleteChoirJoin

Remove a user from a choir

Parameters:

- `choirId` - the choir to join
- `userId` - the user joining the choir

Returns

```js
{
  ok: true
}
```

### POST /postChoirSong

Add/Edit a choir's song

Parameters:

- `choirId` - the id of the choir (required)
- `userId` - the id of the user adding the song (required)
- `name` - the name of the song (required)
- `description` - a description of a song
- `partNames` - an array of song partNames (add only) - if supplied during creation of a new song, the `partNames` array is converted into `partNames: [ { partNameId: '<uuid>', name: '<name>'}]` format. Editing of this array is achieved using `POST /choir/songPartName` & `DELETE /choir/songPartName`.

Returns

```js
{
  ok: true,
  songId: '<id of song>'
}
```

### POST /getChoirSong

Get a choir's song by id

Parameters:

- `choirId` - the id of the choir (required)
- `songId` - the id of the song (required)

Returns

```js
{
  ok: true,
  song: { ... song document ... }
}
```

### POST /deleteChoirSong

Delete a choir's song and all its song parts

Parameters:

- `choirId` - the id of the choir (required)
- `songId` - the id of the song (required)

Returns

```js
{
  ok: true
}
```

### POST /getChoirSongs

Get a list of a choir's songs in newest first order.

Parameters:

- `choirId` - the id of the choir (required)

Returns

```js
{
  ok: true,
  songs: [{ ... song document ... }, { ... song document ... }]
}
```

### POST /postChoirSongPart

Insert/update a song part

Parameters:

- `choirId` - the id of the choir (required)
- `songId` - the id of the song (required)
- `partId` - the id of the part (required for updates, if omitted a new song part is created)
- `partNameId` - the id of the part name
- `partName` - name of the part e.g. drums, alto
- `partType` - one of `backing`/`reference`/`rendition`
- `userId` - the id of the user (required for new parts)
- `userName` - the name of the user (required for new parts)
- `offset` - the number of milliseconds after the reference part that this recording started (default 0)
- `frontendOffset` - the number of milliseconds after the reference part that this recording started according to the user (default 0)
- `aspectRadio` - the aspect ratio of the video e.g. `4:3`
- `hidden` - boolean indicating whether this part is to be hidden in the final mix e.g. `false`
- `audio` - boolean, if true indicates this song part is audio only. default `false`
- `volume` - number representing the volume of the song part default `1.0`

Returns

```js
{
  ok: true,
  partId: '<songpart id>'
}
```

### POST /postChoirSongPartUpload

Allows the upload of a song part's video file by creating a presigned URL that can be used by the front-end to upload the song part without having access to COS.

Parameters:

- `choirId` - the id of the choir (required)
- `songId` - the id of the song (required)
- `partId` - the id of the part (required)
- `extension` - the file extension (required) e.g. 'webm'

Returns:

```js
{
  ok: true,
  method: 'PUT',
  url: 'https://some.url.com/path/key',
  bucket: 'mybucket',
  key: 'x+y+z.webm'
}
```

### POST /postChoirSongPartDownload

Allows the download of a song part's video file by creating a presigned URL that can be used by the front-end to fetch the song part without having access to COS.

Parameters:

- `choirId` - the id of the choir (required)
- `songId` - the id of the song (required)
- `partId` - the id of the part (required)

Returns:

```js
{
  ok: true,
  method: 'GET',
  url: 'https://some.url.com/path/key',
  bucket: 'mybucket',
  key: 'x+y+z.webm'
}
```

### POST /getChoirSongPart

Get a single songpart

Parameters:

- `choirId` - the id of the choir (required)
- `songId` - the id of the song (required)
- `partId` - the id of the part (required)

Returns

```js
{
  ok: true,
  part: { ... part doc ... }'
}
```


### POST /deleteChoirSongPart

Delete a song part

Parameters:

- `choirId` - the id of the choir (required)
- `songId` - the id of the song (required)
- `partId` - the id of the part (required)

Returns

```js
{
  ok: true
}
```

### POST /choirSongPart

Get all parts of a song

Parameters:

- `choirId` - the id of the choir (required)
- `songId` - the id of the song (required)
- `partNameId` - if supplied, only parts with matching `partNameId`s will be returned

Returns

```js
{
  ok: true,
  parts: [{ ... part doc ... }, { ... part doc ... }]
}
```
