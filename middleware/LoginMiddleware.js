const User = require('../models/User');
const SETTINGS = require('../Settings');

module.exports = (sharedTokens) => {
	return async (req, res, next) => {
		// console.log(process.env.PROFILE_ID_OVERRIDE, sharedTokens);

		req.getProfile = async (useDocument) => {
			if(!req.profileID) req.profileID = process.env.PROFILE_ID_OVERRIDE;
			if(!req.profileID) {
				req.profileData = null;
				return null;
			}

			// Always retrieve a fresh Mongoose document from the database when specifically requested
			if (useDocument) {
				return await User.findById(req.profileID).catch(err => {
					console.error(err);
					return null;
				});
			}

			if(!req.profileData) {
				// Check shared tokens for cached profile data if not using document (since document can't be serialized easily or might be stale? no, memory is fine)
				// But user asked for persistence.
				// Let's check if we have it in sharedTokens
				const token = req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME];
				if (sharedTokens.login[token] && sharedTokens.login[token].profileData) {
					req.profileData = sharedTokens.login[token].profileData;
				} else {
					req.profileData = await User.findById(req.profileID)
					.then(doc => {
						if (!doc) return null;
						// cache the object version
						const obj = doc.toObject();
						if (sharedTokens.login[token]) {
							sharedTokens.login[token].profileData = obj;
						}
						return obj;
					})
					.catch(err => {
						console.error(err);
						return null;
					});
				}
			}

			return req.profileData;
		};

		if(process.env.PROFILE_ID_OVERRIDE) {
			req.profileID = process.env.PROFILE_ID_OVERRIDE;
			await req.getProfile();
		} else if(sharedTokens.login[req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME]]){
			const tokenData = sharedTokens.login[req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME]];
			req.loginToken = tokenData;
			req.profileID = tokenData.profileID;
			
			// If cached data exists, pre-populate
			if (tokenData.profileData) {
				req.profileData = tokenData.profileData;
			} else {
				await req.getProfile();
			}
		}

		if (req.profileData) {
			req.isAdmin = req.profileData.isAdmin;
		}

		next();
	};
};
