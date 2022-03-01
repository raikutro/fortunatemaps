const fetch = require('node-fetch');
// const insane = require('insane');

// Mongoose Models
const MapEntry = require("../models/MapEntry");
const User = require("../models/User");

const Utils = require("../Utils");
const SETTINGS = require("../Settings");

const DEFAULT_JSONBIN_DATA = {
	"fake": null
};

module.exports = (app, loginTokens) => {
	app.get('/register', async (req, res) => {
		let profileData = loginTokens[req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME]];

		if(profileData) {
			let user = (await User.findById(profileData.profileID)).toObject();

			// Check if the user has been registered yet
			if(user.username.length === 0) {
				res.render('register', {
					...(Utils.templateEngineData(req)),
					profileID: profileData.profileID,
					tagproProfile: profileData.tagproProfile
				});
			} else {
				res.redirect("/#err=" + SETTINGS.ERROR_CODES.ALREADY_REGISTERED);
			}
		} else {
			res.redirect("/");
		}
	});

	app.get('/settings', async (req, res) => {
		let profileData = loginTokens[req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME]];
		if(profileData) {
			let user = (await User.findById(profileData.profileID)).toObject();

			res.render('settings', {
				...(Utils.templateEngineData(req)),
				profileID: profileData.profileID,
				user
			});
		} else {
			res.redirect("/");
		}
	});

	// CTFAuth Sign in
	app.get('/sign_in', (req, res) => {
		fetch(SETTINGS.CTF_AUTH_URL + "/generate_verification_link", {
			method: "POST",
			headers: {
				"Authorization": "Basic " + process.env.CTF_AUTH_API_KEY
			}
		}).then(a => a.json()).then(json => {
			res.cookie(SETTINGS.SITE.COOKIE_TOKEN_NAME, json.verificationToken, {
				path: "/",
				expires: new Date(Date.now() + SETTINGS.SITE.LOGIN_EXPIRATION_TIME_LIMIT) // cookie will be removed after 100 days
			});
			
			res.redirect(json.url);
		});
	});

	app.get('/sign_out', (req, res) => {
		res.cookie(SETTINGS.SITE.COOKIE_TOKEN_NAME, "");
		res.redirect("/");
	});

	app.get('/p/:id', (req, res) => res.redirect("/profile/" + req.params.id));
	app.get('/profile/:id', async (req, res) => {
		req.params.id = String(req.params.id);
		let user;

		if(req.params.id.length !== 24) {
			user = (await User.findOne({username: new RegExp(Utils.makeAlphanumeric(req.params.id), "i")}).catch(err => {}));
		} else {
			user = (await User.findById(req.params.id).catch(err => {}));
		}

		if(user){
			user = user.toObject();

			let maps = await MapEntry.find({ authorIDs: user._id }).limit(20).sort({ dateUploaded: -1 });
			let profileData = loginTokens[req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME]];
			let renderData = {...(Utils.templateEngineData(req)), user, maps};

			if(profileData){
				if(profileData.profileID === String(user._id)) {
					if(user.username.length === 0) {
						res.redirect("/register");
					} else {
						res.render('profile', {
							...renderData,
							isOwner: true,
							profileID: profileData.profileID
						});
					}
				} else {
					res.render('profile', {
						...renderData,
						isOwner: false,
						profileID: profileData.profileID
					});
				}
			} else {
				res.render('profile', {
					...renderData,
					isOwner: false,
					profileID: false
				});
			}
		} else {
			res.send("That account doesn't exist.");
		}
	});

	app.post("/auth_callback", async (req, res) => {
		if(req.body.verified && req.body.apiSecret === process.env.CTF_AUTH_API_SECRET) {
			let userAccount = await User.findOne({
				tagproProfile: req.body.profileID
			});

			console.log(req.body);

			// Check if the users account exists.
			if(!userAccount){
				userAccount = await User.create({
					username: "",
					bio: "",
					dateJoined: new Date(),
					certifications: [],
					favorites: [],
					tagproProfile: req.body.profileID,
					social: {
						discord: "",
						reddit: ""
					}
				});
			}

			loginTokens[req.body.verificationToken] = {
				profileID: String(userAccount._id),
				tagproProfile: req.body.profileID,
				loginDate: Date.now()
			};

			saveTokens(loginTokens);

			res.json({
				redirectURL: (SETTINGS.DEV_MODE ? (SETTINGS.NGROK_URL || "http://localhost") : "https://fortunatemaps.herokuapp.com") + "/profile/" + userAccount._id
			});
		} else {
			res.json({
				redirectURL: (SETTINGS.DEV_MODE ? (SETTINGS.NGROK_URL || "http://localhost") : "https://fortunatemaps.herokuapp.com") + "/#err=" + SETTINGS.ERROR_CODES.LOGIN_ERROR
			});
		}
	});

	app.post('/register', async (req, res) => {
		let profileID = loginTokens[req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME]].profileID;
		if(profileID && Utils.hasCorrectParameters(req.body, {
			username: "string"
		})) {
			if(!Utils.isAlphanumeric(req.body.username)) return res.json({err: "Usernames must be alphanumeric."});
			req.body.username = Utils.cleanQueryableText(req.body.username.trim());
			if(req.body.username.length >= 20) return res.json({err: "Username must be less than 21 characters."});
			if(req.body.username.length < 3) return res.json({err: "Username must be bigger than 2 characters."});

			let isUsernameUsed = await User.findOne({username: req.body.username}, "username");
			if(isUsernameUsed) return res.json({err: "That username is already in use."});

			let user = await User.findById(profileID);
			
			// Check if the user has been registered yet
			if(user.username.length === 0) {
				user.username = req.body.username;

				await user.save();

				res.json({
					success: true,
					profileID: user._id
				});
			} else {
				res.json({
					err: "Already registered"
				});
			}
		} else {
			res.json({
				err: "Invalid token"
			});
		}
	});

	app.post('/settings', async (req, res) => {
		let profileID = loginTokens[req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME]].profileID;
		if(profileID && Utils.hasCorrectParameters(req.body, {
			discord: "string",
			reddit: "string",
			bio: "string"
		})) {
			req.body.discord = req.body.discord.trim().slice(0, 30);
			req.body.reddit = req.body.reddit.trim().slice(0, 30);
			req.body.bio = req.body.bio.trim().slice(0, 500);

			let user = await User.findById(profileID);
			
			user.social.discord = req.body.discord;
			user.social.reddit = req.body.reddit;
			user.bio = req.body.bio;

			await user.save();

			res.json({
				success: true
			});
		} else {
			res.json({
				err: "Invalid token"
			});
		}
	});

	// Check expiration of tokens every 10 mins
	setInterval(function() {
		Object.keys(loginTokens).forEach(key => {
			if(key === "fake") return;

			if(Date.now() - loginTokens[key].loginDate > SETTINGS.SITE.LOGIN_EXPIRATION_TIME_LIMIT) {
				delete loginTokens[key];
			}
		});

		saveTokens(loginTokens);
	}, 10 * 60 * 1000);
}

function saveTokens(loginTokens) {
	let sendableTokens = DEFAULT_JSONBIN_DATA;
	if(Object.keys(loginTokens).length !== 0) sendableTokens = loginTokens;
	
	return fetch(`https://api.jsonbin.io/b/${process.env.JSONBIN_ID}`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			"secret-key": process.env.JSONBIN_API_KEY
		},
		body: JSON.stringify(sendableTokens)
	}).then(a => a.json()).catch(err => {
		console.log(sendableTokens);
		console.log("Error while saving tokens: ", err);
	});
}