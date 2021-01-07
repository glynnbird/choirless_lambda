# Choirless Rendering Pipeline

## The rendering pipeline

The rendering pipeline is triggered by dropping files into S3 buckets. The Lambdas will typically call another Lambda, write a file to another bucket and/or call the `status` Lambda which writes a status document to the database (so that the front-end can track how a rendering job is going).

### raw bucket

A `.webm` file of the form `<choirid>+<songid>+<partid>.webm` is uploaded into the `raw` bucket from the Choirless front end after a choir member has made a recording. Each song part will have a matching document in the database with and id of `<choirid>:song:<songid>:part:<partid>`.

If the song's `partType` is `backing`, then it is the backing track (there's only one backing track per song). All other song parts will have a `partType` of `reference` or `rendition`.

Uploading to the `raw` bucket triggers the `snapshot` Lambda which turns the video into a jpg in the `snapshots` bucket. This Lambda, in turn, calls the `status` Lambda and the `convert_format` Lambda to convert the file into a common file format in the `converted` bucket, and the `status` Lambda is called again.

### converted bucket

Once the video file is converted into the right format `calculate_alignment` calculates how many milliseconds "off" the part is from the backing part (if this _is_ the backing part then the offset is 0). The offset calculation is written back to the database as the `offset` field and the `renderer` Lambda is called which fetches all the song parts for this song from the database and writes a rendering "plan" to the `definition` bucket (and calls the `status` Lambda). The definition JSON file contains all the details needed to render the final video:

- how big each video should be
- where on the canvas it should be placed
- how loud it should be
- what time offset should be applied
- where in the stereo mix it should be
- which reverb effect and how much to apply

### definition bucket

When the definition JSON arrives it triggers the `renderer_compositor_main` function which spawns one `renderer_compositor_child` process per horizontal stripe of the output video, each stripe being written to the `final-parts` bucket. Each "child" function calls the `status` Lambda when it's finished. 

### final-parts bucket

Each stripe of the final video arrives in the `final-parts` bucket, if they are not all there yet the Lambda dies. If they are all there, the stripes are combined together into a single video which is placed into the `preview` bucket (and the `status` Lambda is called).

### preview bucket

The preview video triggers the `post_production` lambda which normalises the audio and adds reverb. The resultant video is written to the `final` bucket (and the `status` Lambda is called).

###  final bucket

This is the finished video but there's one more task: to take a jpeg snapshot of the finished video. (and the `status` Lambda is called)

## Python Linter

```sh
pylint snapshot.py
```

## Indendation fix

```sh
autopep8 --in-place --aggressive --aggressive snapshot.py
```
