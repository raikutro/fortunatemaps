const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
	// Username
	username: {type: String},
	// User's biography
	bio: {type: String},
	// User join date
	dateJoined: {type: Date},
	// Certifications of the user. E.g. MTC, Has gotten a map into rotation, won a contest, etc..
	certifications: [{certificationType: Number, name: String}],
	// Favorite maps
	favorites: [Number],
	// TagPro Profile
	tagproProfile: {type: String},
	// Administrator
	isAdmin: {type: Boolean, default: false},
	// Social Media Handles
	social: {
		discord: {type: String},
		reddit: {type: String}
	}
});

const User = mongoose.model('User', UserSchema);

module.exports = User;