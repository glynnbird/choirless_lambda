const AWS = require('aws-sdk')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')

const main = async (opts) => {
	// s3 client
	s3 = new AWS.S3({apiVersion: '2006-03-01'});

	// look for a key in opts and pull songId and choirId from there
	const key = opts.object_name ? opts.object_name : opts.key

	// Get the definition from the bucket
	let definition_object = await s3.getObject({ Bucket: opts.definition_bucket, Key: key }).promise()
	let definition = JSON.parse(definition_object['Body'])

	// if we have scenes then loop per scene, if not add artificial scene in
	let scenes = []
	if (definition.scenes == undefined) {
		scenes.push({
			"scene_id": 1,
			"inputs": definition.inputs
		})
	} else {
		scenes = definition.scenes
	}

	let actions = []
	// const ow = openwhisk()
	let run_id = uuidv4().slice(0, 8)

	scenes.forEach(scene => {
		// Get the inputs for this scene
		input_specs = scene.inputs
		// Calculate number of rows
		let rows = new Set()
		input_specs.forEach(spec => {
			let [x, y] = spec.position || [-1, -1]
			rows.add(y)
		})
		rows = Array.from(rows)
		rows.sort((a, b) => parseInt(a) - parseInt(b))

		let num_rows = rows.length

		// Calculate the hash of our rows
		let rows_str = rows.join("-")
		let rows_hash = crypto.createHash('sha1').update(rows_str).digest('hex').slice(0, 8)

		// Invoke all the child actions
		rows.forEach(row => {
			let params = {
				"row_num": row,
				"run_id": run_id,
				"rows_hash": rows_hash,
				"compositor": "combined",
				"key": key,
				"definition_key": key
			}

			/*let action = ow.actions.invoke({
				name: "choirless/renderer_compositor_child",
				params: params,
				blocking: false
			})
			actions.push(action)*/
		})
	})

	// Await for the child calls to all return with their activation ID
	// let res = await Promise.all(actions)
	// let activation_ids = res.map(r => { return r.activationId })

	return {
		"status": "spawned children",
		"run_id": run_id,
		"definition_key": key,
		"activation_ids": activation_ids
	}
}

module.exports = {
	main
}

