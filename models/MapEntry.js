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
	// Map Likes
	likes: [Schema.Types.ObjectId],
	// Map tags
	tags: [String],
	// Hidden map tags, for bots
	hiddenTags: [{tagType: {type: Number}, name: {type: String}}],
	// Map ID
	mapID: {type: Number},
	// Source map JSON
	json: {type: Buffer},
	// Source map PNG
	png: {type: Buffer},
	// The original first version of the map
	versionSource: {type: Number},
	// Map Remix Boolean
	isRemix: {type: Boolean},
	// If the map should not be shown in queries.
	unlisted: {type: Boolean}
});

MapEntrySchema.index({ mapID: -1, dateUploaded: -1 });

const MapEntry = mongoose.model('MapEntry', MapEntrySchema);

module.exports = MapEntry;