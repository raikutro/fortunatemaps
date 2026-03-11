const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ActionLogSchema = new Schema({
	// The user who performed the action (or the user created)
	userId: {type: Schema.Types.ObjectId},
	// Cached username of the initiator for easy display
	username: {type: String},
	// Description of the action taken
	action: {type: String},
	// Time the action occurred
	timestamp: {type: Date, default: Date.now}
});

// Index to quickly sort by recent actions
ActionLogSchema.index({ timestamp: -1 });

const ActionLog = mongoose.model('ActionLog', ActionLogSchema);

module.exports = ActionLog;
