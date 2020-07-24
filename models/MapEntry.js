const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MapEntrySchema = new Schema({
	
});

const MapEntry = mongoose.model('MapEntry', MapEntrySchema);

module.exports = MapEntry;