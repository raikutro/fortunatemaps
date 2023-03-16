const fetch = require('node-fetch');
// const insane = require('insane');

// Mongoose Models
const MapEntry = require('../models/MapEntry');
const User = require('../models/User');
const ServerInfo = require('../models/ServerInfo');

const Utils = require('../Utils');
const SETTINGS = require('../Settings');

module.exports = (app, sharedTokens) => {
	const LoginMiddleware = require('../middleware/LoginMiddleware')(sharedTokens.login);

	app.get('/register', LoginMiddleware, async (req, res) => {
		const user = await req.getProfile();

		if(user) {
			// Check if the user has been registered yet
			if(user.username.length === 0) {
				res.render('register', {
					...(await Utils.templateEngineData(req)),
					profileID: user._id,
					tagproProfile: user.tagproProfile
				});
			} else {
				res.redirect("/#err=" + SETTINGS.ERRORS.ALREADY_REGISTERED().code);
			}
		} else {
			res.redirect("/");
		}
	});

	app.get('/settings', LoginMiddleware, async (req, res) => {
		if(req.profileID) {
			res.render('settings', {
				...(await Utils.templateEngineData(req))
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
	app.get('/profile/:id', LoginMiddleware, async (req, res) => {
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
			let profileID = req.profileID;
			let renderData = {...(await Utils.templateEngineData(req)), user, maps};

			if(profileID){
				if(profileID === String(user._id)) {
					if(user.username.length === 0) {
						res.redirect("/register");
					} else {
						res.render('profile', {
							...renderData,
							isOwner: true
						});
					}
				} else {
					res.render('profile', {
						...renderData,
						isOwner: false
					});
				}
			} else {
				res.render('profile', {
					...renderData,
					isOwner: false
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

			sharedTokens.login[req.body.verificationToken] = {
				profileID: String(userAccount._id),
				tagproProfile: req.body.profileID,
				loginDate: Date.now()
			};

			saveTokens(sharedTokens.login);

			res.json({
				redirectURL: (SETTINGS.DEV_MODE ? (SETTINGS.NGROK_URL || "http://localhost") : "https://fortunatemaps.herokuapp.com") + "/profile/" + userAccount._id
			});
		} else {
			res.json({
				redirectURL: (SETTINGS.DEV_MODE ? (SETTINGS.NGROK_URL || "http://localhost") : "https://fortunatemaps.herokuapp.com") + "/#err=" + SETTINGS.ERRORS.LOGIN_ERROR().code
			});
		}
	});

	app.post('/register', LoginMiddleware, async (req, res) => {
		const user = await req.getProfile(true);

		if(user && Utils.hasCorrectParameters(req.body, {
			username: "string"
		})) {
			if(!Utils.isAlphanumeric(req.body.username)) return res.json({err: "Usernames must be alphanumeric."});
			req.body.username = Utils.cleanQueryableText(req.body.username.trim());
			if(req.body.username.length >= 20) return res.json({err: "Username must be less than 21 characters."});
			if(req.body.username.length < 3) return res.json({err: "Username must be bigger than 2 characters."});

			let isUsernameUsed = await User.findOne({username: req.body.username}, "username");
			if(isUsernameUsed) return res.json({err: "That username is already in use."});
			
			// Check if the user has been registered yet
			if(user.username.length === 0) {
				user.username = req.body.username;

				await user.save();

				res.json({
					success: true,
					profileID: user._id
				});
			} else {
				res.json(SETTINGS.ERRORS.ALREADY_REGISTERED());
			}
		} else {
			res.json({
				err: "Invalid token"
			});
		}
	});

	app.post('/settings', LoginMiddleware, async (req, res) => {
		const user = await req.getProfile(true);

		if(user && Utils.hasCorrectParameters(req.body, {
			discord: "string",
			reddit: "string",
			bio: "string"
		})) {
			req.body.discord = req.body.discord.trim().slice(0, 37);
			req.body.reddit = req.body.reddit.replace('/u/', '').trim().slice(0, 30);
			req.body.bio = req.body.bio.trim().slice(0, 500);
			
			user.social.discord = req.body.discord;
			user.social.reddit = req.body.reddit;
			user.bio = req.body.bio;

			await user.save();

			res.json({
				success: true
			});
		} else {
			res.json(SETTINGS.ERRORS.INVALID_LOGIN_TOKEN());
		}
	});

	// Check expiration of tokens every 10 mins
	setInterval(function() {
		Object.keys(sharedTokens.login).forEach(key => {
			if(key === "fake") return;

			if(Date.now() - sharedTokens.login[key].loginDate > SETTINGS.SITE.LOGIN_EXPIRATION_TIME_LIMIT) {
				delete sharedTokens.login[key];
			}
		});

		saveTokens(sharedTokens.login);
	}, 10 * 60 * 1000);
}

async function saveTokens(loginTokens) {
	let serverInfo = await MapEntry.findOne({});

	serverInfo.loginTokens = loginTokens;

	await serverInfo.save();
	
	return serverInfo.loginTokens;
}
