const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MapEntrySchema = new Schema({
	// Name of the map
	name: {type: String},
	// Author Account User IDs
	authorIDs: [String],
	// Author name
	authorName: {type: String},
	// Map description
	description: {type: String},
	// Map upload date
	dateUploaded: {type: Date},
	// Map comments
	comments: [{
		id: {type: String},
		parentID: {type: String, default: ""},
		date: {type: Date},
		authorID: {type: Schema.Types.ObjectId},
		body: {type: String}
	}],
	// Map tags
	tags: [{tagType: {type: Number}, name: {type: String}}],
	// Hidden map tags, for bots
	hiddenTags: [{tagType: {type: Number}, name: {type: String}}],
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
	// If the map should not be shown in queries.
	unlisted: {type: Boolean}
});

const MapEntry = mongoose.model('MapEntry', MapEntrySchema);

module.exports = MapEntry;