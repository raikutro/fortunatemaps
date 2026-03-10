const fetch = require('node-fetch');

// Mongoose Models
const MapEntry = require('../models/MapEntry');
const User = require('../models/User');
const ServerInfo = require('../models/ServerInfo');

const Utils = require('../Utils');
const SETTINGS = require('../Settings');

module.exports = (app, sharedTokens, requireCsrf) => {
	const LoginMiddleware = require('../middleware/LoginMiddleware')(sharedTokens);

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
				...(await Utils.templateEngineData(req)),
				announcementHTML: global.announcementHTML || ""
			});
		} else {
			res.redirect("/");
		}
	});

	// Local Login
	app.get('/login', async (req, res) => {
		if (req.profileID) return res.redirect('/profile/' + req.profileID);
		res.render('login', {
			...(await Utils.templateEngineData(req)),
			error: req.query.error
		});
	});

	app.post('/login', async (req, res) => {
		const { username, password } = req.body;
		if (!username || !password) return res.redirect('/login?error=Missing+credentials');

		const user = await User.findOne({ username: new RegExp(`^${Utils.makeAlphanumeric(username)}$`, "i") });
		
		if (!user) return res.redirect('/login?error=Invalid+username+or+password');
		
		if (!user.passwordHash) {
			return res.redirect('/login?error=No+password+set+for+this+account.+Sign+in+with+CTFAuth+to+verify+your+TagPro+account.');
		}

		const bcrypt = require('bcrypt');
		const isMatch = await bcrypt.compare(password, user.passwordHash);
		if (!isMatch) return res.redirect('/login?error=Invalid+username+or+password');

		const crypto = require('crypto');
		const token = crypto.randomBytes(32).toString('hex');

		sharedTokens.login[token] = {
			profileID: String(user._id),
			tagproProfile: user.tagproProfile,
			loginDate: Date.now()
		};
		saveTokens(sharedTokens.login);

		res.cookie(SETTINGS.SITE.COOKIE_TOKEN_NAME, token, {
			path: "/",
			expires: new Date(Date.now() + SETTINGS.SITE.LOGIN_EXPIRATION_TIME_LIMIT), // cookie will be removed after 100 days
			httpOnly: true,
			sameSite: 'lax',
			secure: !SETTINGS.DEV_MODE
		});

		res.redirect('/profile/' + user._id);
	});

	app.get('/reset_password', async (req, res) => {
		res.render('reset_password', {
			...(await Utils.templateEngineData(req))
		});
	});

	// CTFAuth Sign in
	app.get('/sign_in', (req, res) => {
		fetch(SETTINGS.CTF_AUTH_URL + "/generate_verification_link", {
			method: "POST",
			headers: {
				"Authorization": "Basic " + process.env.CTF_AUTH_API_KEY
			}
		}).then(a => a.json()).then(json => {
			if (req.query.redirect === '/reset_password') {
				sharedTokens.redirects = sharedTokens.redirects || {};
				sharedTokens.redirects[json.verificationToken] = '/reset_password';
			}

			res.cookie(SETTINGS.SITE.COOKIE_TOKEN_NAME, json.verificationToken, {
				path: "/",
				expires: new Date(Date.now() + SETTINGS.SITE.LOGIN_EXPIRATION_TIME_LIMIT), // cookie will be removed after 100 days
				httpOnly: true,
				sameSite: 'lax',
				secure: !SETTINGS.DEV_MODE
			});
			
			res.redirect(json.url);
		});
	});

	app.get('/sign_out', (req, res) => {
		res.cookie(SETTINGS.SITE.COOKIE_TOKEN_NAME, "", {
			path: "/",
			expires: new Date(0),
			httpOnly: true,
			sameSite: 'lax',
			secure: !SETTINGS.DEV_MODE
		});
		res.redirect("/");
	});

	app.get('/p/:id', (req, res) => res.redirect("/profile/" + req.params.id));
	app.get('/profile', (req, res) => {
		res.send("That account doesn't exist.");
	});
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

			maps = maps.map(d => {
				let doc = d.toObject();
				doc.png = doc.png.toString('base64');
				doc.json = doc.json.toString('base64');
				return doc;
			});

			let bannerMap = null;
			if (user.profileBanner) {
				const bMap = await MapEntry.findOne({ mapID: user.profileBanner });
				if (bMap) {
					bannerMap = bMap.toObject();
					bannerMap.png = bannerMap.png.toString('base64');
					bannerMap.json = bannerMap.json.toString('base64');
				}
			}

			let profileID = req.profileID;
			let renderData = {...(await Utils.templateEngineData(req)), user, maps, bannerMap};

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

			const baseURL = (SETTINGS.DEV_MODE ? (SETTINGS.NGROK_URL || "http://localhost") : "https://fortunatemaps.herokuapp.com");
			let redirectURL = baseURL + "/profile/" + userAccount._id;

			if (sharedTokens.redirects && sharedTokens.redirects[req.body.verificationToken]) {
				redirectURL = baseURL + sharedTokens.redirects[req.body.verificationToken];
				delete sharedTokens.redirects[req.body.verificationToken];
			}

			saveTokens(sharedTokens.redirects);

			res.json({
				redirectURL: redirectURL
			});
		} else {
			res.json({
				redirectURL: (SETTINGS.DEV_MODE ? (SETTINGS.NGROK_URL || "http://localhost") : "https://fortunatemaps.herokuapp.com") + "/#err=" + SETTINGS.ERRORS.LOGIN_ERROR().code
			});
		}
	});

	app.post('/register', LoginMiddleware, requireCsrf, async (req, res) => {
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

	app.post('/settings', LoginMiddleware, requireCsrf, async (req, res) => {
		const user = await req.getProfile(true);

		if(user && Utils.hasCorrectParameters(req.body, {
			discord: "string",
			reddit: "string",
			bio: "string",
			autoChunkable: "boolean",
			profileBanner: "number"
		})) {
			req.body.discord = req.body.discord.trim().slice(0, 37);
			req.body.reddit = req.body.reddit.replace('/u/', '').trim().slice(0, 30);
			req.body.bio = req.body.bio.trim().slice(0, 500);
			
			user.social.discord = req.body.discord;
			user.social.reddit = req.body.reddit;
			user.bio = req.body.bio;
			user.autoChunkable = req.body.autoChunkable;
			user.profileBanner = req.body.profileBanner === 0 ? null : req.body.profileBanner;
			await user.save();

			const CERT_ID = 4;
			if (req.body.autoChunkable) {
				await User.addCertification(user, CERT_ID);
			} else {
				await User.removeCertification(user, CERT_ID);
			}

			res.json({
				success: true
			});
		} else {
			res.json(SETTINGS.ERRORS.INVALID_LOGIN_TOKEN());
		}
	});

	app.post('/settings/password', LoginMiddleware, requireCsrf, async (req, res) => {
		const user = await req.getProfile(true);

		if (user && req.body.newPassword) {
			const newPass = String(req.body.newPassword);
			if (newPass.length < 8) return res.json({ err: "Password must be at least 8 characters long." });
			if (newPass.length > 20) return res.json({ err: "Password must be under 20 characters long." });

			const bcrypt = require('bcrypt');
			user.passwordHash = await bcrypt.hash(newPass, 10);
			await user.save();

			res.json({ success: true });
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
	let serverInfo = await ServerInfo.findOne({});

	serverInfo.loginTokens = loginTokens;

	await serverInfo.save();
	
	return serverInfo.loginTokens;
}
