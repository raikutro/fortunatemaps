const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MapEntrySchema = new Schema({
	// Name of the map
	name: {type: String},
	// Author Account User ID
	authorID: {type: String},
	// Author name
	authorName: {type: String},
	// Map description
	description: {type: String},
	// Map upload date
	dateUploaded: {type: Date},
	// Map tags
	tags: [{name: {type: String}}],
	// Map ID
	mapID: {type: Number},
	// Source map JSON
	json: {type: String},
	// Source map PNG
	png: {type: String},
	// The original first version of the map
	versionSource: {type: Number},
	// Map Remix Boolean
	isRemix: {type: Boolean},
	// If the map should be shown in queries.
	unlisted: {type: Boolean}
});

const MapEntry = mongoose.model('MapEntry', MapEntrySchema);

module.exports = MapEntry;