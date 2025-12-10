const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ServerInfoSchema = new Schema({
	loginTokens: {},
	chunkUsage: {}
});

const ServerInfo = mongoose.model('ServerInfo', ServerInfoSchema);

module.exports = ServerInfo;
