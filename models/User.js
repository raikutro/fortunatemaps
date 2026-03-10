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
	},
	// Auto-Tag maps as CHUNKable
	autoChunkable: {type: Boolean, default: false},
	// Profile Banner Map ID
	profileBanner: {type: Number},
	// Password Hash (Bcrypt)
	passwordHash: {type: String}
});

const SETTINGS = require('../Settings');

const User = mongoose.model('User', UserSchema);

User.addCertification = async function(profile, certId) {
	if (!profile.certifications) profile.certifications = [];
	
	const hasCert = profile.certifications.some(c => c.certificationType === certId);
	if (!hasCert && SETTINGS.SITE.CERTIFICATIONS[certId]) {
		profile.certifications.push({
			certificationType: certId,
			name: SETTINGS.SITE.CERTIFICATIONS[certId].name
		});
		await profile.save();
		return true;
	}
	return false;
};

User.removeCertification = async function(profile, certId) {
	if (!profile.certifications) return false;

	const initialLength = profile.certifications.length;
	profile.certifications = profile.certifications.filter(c => c.certificationType !== certId);
	
	if (profile.certifications.length !== initialLength) {
		await profile.save();
		return true;
	}
	return false;
};

module.exports = User;