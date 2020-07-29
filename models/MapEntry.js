const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MapEntrySchema = new Schema({
	name: {type: String},
	authorID: {type: String},
	authorName: {type: String},
	description: {type: String},
	dateUploaded: {type: Date},
	tags: [{name: {type: String}}],
	mapID: {type: Number},
	json: {type: String},
	png: {type: String},
	previewPng: {type: String},
	thumbnailPng: {type: String},
	versionSource: {type: Number},
	isRemix: {type: Boolean},
	unlisted: {type: Boolean}
});

const MapEntry = mongoose.model('MapEntry', MapEntrySchema);

module.exports = MapEntry;