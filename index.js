require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const FormData = require('form-data');
const insane = require('insane');
const { createCanvas, Image } = require('canvas');

const app = express();
const httpServer = http.Server(app);

const PORT = process.env.PORT || 80;

// The TagProEdit.com module.
// I compartimentalized the source code to its own module.
const TagproEditMapEditor = require("./editor/app");

const PreviewGenerator = require("./components/preview_generator");
const AWSController = require("./components/aws_controller");

// Routes
const AccountRoutes = require("./routes/account_routes");

// Basic Utility Functions
const Utils = require("./Utils");

// Settings
const SETTINGS = require("./Settings");

// Mongoose Models
const MapEntry = require("./models/MapEntry");
const User = require("./models/User");

// Expres Router for API routes. Doesn't have any routes right now.
const apiRouter = express.Router();

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Preview quality of preview & thumbnail images.
let loginTokens = {};

// Connect to the MongoDB Instance
mongoose.connect(process.env.MONGODB_URL, {
	useNewUrlParser: true,
	useFindAndModify: false,
	useCreateIndex: true,
	useUnifiedTopology: true,
}).then(() => {
	console.log("Connected to MongoDB");
}).catch(err => console.log);
mongoose.set('debug', false);

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

console.log(SETTINGS.DEV_MODE ? "Running in Local Mode" : "Running in Production Mode");

// Retrieve login tokens stored in jsonbin
fetch(`https://jsonbin.org/${process.env.JSONBIN_USERNAME}/fmtokens`, {
	headers: {
		"Authorization": "Token " + process.env.JSONBIN_API_KEY
	}
}).then(a => a.json()).then(json => {
	loginTokens = json;

	AccountRoutes(app, loginTokens);
}).catch(err => {
	console.log("Error while saving tokens: ", err);
});

let loginMiddleware = (req, res, next) => {
	if(loginTokens[req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME]]){
		req.profileID = loginTokens[req.cookies[SETTINGS.SITE.COOKIE_TOKEN_NAME]].profileID;
	} else req.profileID = false;

	next();
};

// Home Page
app.get('/', loginMiddleware, async (req, res) => {
	let maps = await MapEntry.find({ unlisted: false }).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ dateUploaded: -1 });

	res.render('index', {
		...(Utils.templateEngineData(req)),
		maps
	});
});

// Map Editor
app.get('/editor', loginMiddleware, (req, res) => {
	res.render('editor', {
		...(Utils.templateEngineData(req))
	});
});

// Search Page
app.get('/search', loginMiddleware, async (req, res) => {
	req.query.q = String(req.query.q) || "";
	req.query.p = Math.max(Number(req.query.p) || 1, 1) - 1;
	let maps = await MapEntry.find({name: new RegExp(req.query.q, 'i'), unlisted: false}, "name mapID authorName")
		.skip((req.query.p * SETTINGS.SITE.MAPS_PER_PAGE))
		.limit(SETTINGS.SITE.MAPS_PER_PAGE)
		.sort({ dateUploaded: -1 });

	// console.log(req.query);

	res.render('search', {
		...(Utils.templateEngineData(req)),
		maps
	});
});

// Map Page
app.get('/map/:mapid', loginMiddleware, async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: String(req.params.mapid)
	}).catch(err => {
		// console.log(err);
		// res.send("Invalid Map ID");
	});

	if(!mapEntry) return res.redirect("/");

	let isAdmin = req.profileID ? (await User.findById(req.profileID, "isAdmin").catch(err => {
		// console.log(err);
		res.send("Invalid User ID");
		return {isAdmin: false};
	})).isAdmin : false;

	let mapVersions = await MapEntry.find({
		versionSource: mapEntry.versionSource,
		isRemix: false
	}).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ dateUploaded: -1 });

	let mapRemixes = await MapEntry.find({
		versionSource: mapEntry.versionSource,
		isRemix: true
	}).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ dateUploaded: -1 });

	res.render('map', {
		...(Utils.templateEngineData(req)),
		map: mapEntry,
		mapVersions,
		mapRemixes,
		isAdmin
	});
});

// Map Data Route, returns data about the map and if requested by the client: its other versions and/or remixes.
app.get('/map_data/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	});

	if(!mapEntry) return res.json({
		err: "Couldn't find that map."
	});

	let mapVersions = null;
	let mapRemixes = null;

	if(req.query.v === "1") {
		mapVersions = await MapEntry.find({
			versionSource: mapEntry.versionSource,
			isRemix: false
		}).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ dateUploaded: -1 });

		mapRemixes = await MapEntry.find({
			versionSource: mapEntry.versionSource,
			isRemix: true
		}).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ dateUploaded: -1 });
	}

	res.json({
		map: mapEntry,
		mapVersions,
		mapRemixes
	});
});

app.get('/author_id/:query', async (req, res) => {
	if(!Utils.hasCorrectParameters(req.params, {
		query: "string"
	})) return res.json({err: "Invalid Parameters"});

	if(!Utils.isAlphanumeric(req.params.query)) return res.json({ users: [] });

	let users = await User.find({username: new RegExp(req.params.query, "i")}, "username _id");

	res.json({
		users: users.map(a => { return {id: a._id, username: a.username} })
	});
});

app.get('/author_names/:authorid', async (req, res) => {
	if(!Utils.hasCorrectParameters(req.params, {
		authorid: "string"
	})) return res.json({err: "Invalid Parameters"});

	let authorIDs = req.params.authorid.split(",");
	if(authorIDs.some(a => a.length !== 24)) return res.json({ usernames: [] });

	authorIDs = authorIDs.map(a => mongoose.Types.ObjectId(a));

	let users = await User.find({ 
		_id: {
			$in: authorIDs
		}
	}, "username");

	res.json({
		usernames: users.reduce((acc, val) => {
			acc[val._id] = val.username;
			return acc;
		}, {})
	});
});

// Preview Image Route
app.get('/preview/:mapid.jpeg', async (req, res) => {
	let previewBuffer = await AWSController.getPreviewMapImage(String(req.params.mapid).slice(0, 10)).catch(err => {
		return {err};
	});

	if(previewBuffer.err) return res.status(404).send(previewBuffer.err);

	res.writeHead(200, {
		'Content-Type': 'image/jpeg',
		'Content-Length': previewBuffer.length
	});
	res.end(previewBuffer);
});
app.get('/preview/:mapid', (req, res) => res.redirect(`/preview/${req.params.mapid}.jpeg`));

// Thumbnail Image Route
app.get('/thumbnail/:mapid.jpeg', async (req, res) => {
	let thumbnailBuffer = await AWSController.getThumbnailMapImage(String(req.params.mapid).slice(0, 10)).catch(err => {
		return {err};
	});

	if(thumbnailBuffer.err) return res.status(404).send(thumbnailBuffer.err);

	res.writeHead(200, {
		'Content-Type': 'image/jpeg',
		'Content-Length': thumbnailBuffer.length
	});
	res.end(thumbnailBuffer);
});
app.get('/thumbnail/:mapid', (req, res) => res.redirect(`/thumbnail/${req.params.mapid}.jpeg`));

// Source PNG Image Route
app.get('/png/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	}, "png");

	if(!mapEntry) return res.redirect("/");

	sourcePNGBase64 = mapEntry.png;

	let img = Buffer.from(sourcePNGBase64, 'base64');

	res.writeHead(200, {
		'Content-Type': 'image/png',
		'Content-Length': img.length
	});
	res.end(img);
});

// Source JSON Image Route
app.get('/json/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	}, "json");

	if(!mapEntry) return res.redirect("/");

	res.json(JSON.parse(mapEntry.json));
});


// Map Test Route
// Generates map test links.
app.get('/test/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	}, "png json");

	if(!mapEntry) return res.end();

	let logic = JSON.parse(mapEntry.json);
	let layout = Buffer.from(mapEntry.png, 'base64');
	let url;

	if(req.body.eu == 'true') {
		url = 'http://maptest.newcompte.fr/testmap';
	} else {
		url = 'http://tagpro-maptest.koalabeast.com/testmap';
	}
	
	let form = new FormData();
	
	fs.writeFileSync('./temp/temp.json', Buffer.from(JSON.stringify(logic)));
	fs.writeFileSync('./temp/temp.png', layout);
	form.append('logic', fs.createReadStream('./temp/temp.json'));
	form.append('layout', fs.createReadStream('./temp/temp.png'));
	
	form.submit(url, function(err, testRes) {
		if (err) {
			res.send('Sorry, we could not start up a test map. ' + err.toString());
		} else {
			testRes.resume();
			res.redirect(testRes.headers.location);
		}
	});
});

// Upload Map Route
// Uploads a map to the server
app.post('/upload_map', loginMiddleware, async (req, res) => {
	if(Utils.hasCorrectParameters(req.body, {
		logic: "string",
		layout: "string",
		sourceMapID: "number",
		unlisted: "boolean"
	})){
		const mapLayout = req.body.layout;
		const mapLogic = req.body.logic;
		let mapJSON;

		// Validate & parse the JSON file.
		try {
			mapJSON = JSON.parse(mapLogic);
		} catch {
			return res.json({
				err: "Invalid JSON"
			});
		}

		// Clean body parameters
		req.body.unlisted = req.body.unlisted;
		req.body.sourceMapID = req.body.sourceMapID ? req.body.sourceMapID : 0;

		// Generate the preview canvas.
		let previewCanvas = await PreviewGenerator(
			req.body.layout,
			req.body.logic
		).catch(err => {
			console.log(err);
			return null;
		});

		if(!previewCanvas) return res.json({
			err: "There was an error generating the preview."
		});

		// Generate a Base64 JPEG Data URL from the preview canvas.
		previewCanvas.toDataURL('image/jpeg', SETTINGS.MAPS.PREVIEW_QUALITY, async (err, previewJPEG) => {
			if(err) {
				console.log(err);
				res.json({
					err: "There was an error generating the preview."
				});
				return;
			}

			// Put users authorID inside if they're logged in.
			let authorIDs = [];

			if(req.profileID) authorIDs = [req.profileID];

			// Check if this is a remix of another map.
			let versionSourceMapEntry = 0;
			if(req.body.sourceMapID !== 0) versionSourceMapEntry = await MapEntry.findOne({mapID: req.body.sourceMapID});

			// The map entry gets counted as a remix if there is no author account and the map has a different version source.
			let isRemix = authorIDs.length === 0 ? versionSourceMapEntry === 0 : !versionSourceMapEntry.authorIDs.includes(req.profileID);

			// Find the best way to scale the preview image to turn it into a thumbnail
			let newWidth;
			let newHeight;
			if(previewCanvas.width > previewCanvas.height) {
				let ratio = previewCanvas.width / previewCanvas.height;
				newWidth = 300 * ratio;
				newHeight = 300;
			} else {
				let ratio = previewCanvas.height / previewCanvas.width;
				newWidth = 300;
				newHeight = 300 * ratio;
			}
			let biggerDimension = Math.max(newWidth, newHeight);

			// Create the thumbnail canvas
			let thumbnailCanvas = createCanvas(biggerDimension, biggerDimension);
			const ctx = thumbnailCanvas.getContext('2d');
			let sourceImg = new Image();

			sourceImg.onload = async () => {
				ctx.drawImage(
					sourceImg,
					(biggerDimension / 2) - (newWidth / 2), (biggerDimension / 2) - (newHeight / 2),
					newWidth, newHeight
				);

				let thumbnailJPEG = thumbnailCanvas.toDataURL('image/jpeg', SETTINGS.MAPS.PREVIEW_QUALITY);

				let newMapID = (await MapEntry.countDocuments({})) + 1;
				// Set the version source to the original map
				// If it's a new map, then set its version source to it's own map ID
				let versionSource = versionSourceMapEntry ? versionSourceMapEntry.versionSource : newMapID;

				let mapName = Utils.cleanQueryableText(mapJSON.info.name.slice(0, 150));
				let authorName = Utils.cleanQueryableText(mapJSON.info.author.slice(0, 150));

				// Upload the preview & thumbnail images to the AWS S3 Bucket
				await AWSController.uploadMapImages({
					id: newMapID,
					previewJPEGBase64: previewJPEG,
					thumbnailJPEGBase64: thumbnailJPEG
				});

				// Save the MapEntry to MongoDB
				await MapEntry.create({
					name: insane(mapName),
					authorIDs: authorIDs,
					authorName: insane(authorName),
					description: "No Description",
					dateUploaded: new Date(),
					tags: [],
					hiddenTags: [],
					mapID: newMapID,
					json: mapLogic,
					png: mapLayout,
					versionSource: versionSource,
					isRemix: isRemix,
					unlisted: req.body.unlisted
				});

				// Send the new map ID to the client.
				res.json({
					id: newMapID
				});
			};

			sourceImg.src = previewJPEG;
		});
	} else {
		res.json({err: "Invalid Parameters"});
	}
});

// Update Map Route
app.post('/update_map', loginMiddleware, async (req, res) => {
	if(Utils.hasCorrectParameters(req.body, {
		mapID: "number",
		description: "string",
		tags: "object",
		authors: "object",
		unlisted: "boolean"
	}) && typeof req.body.tags.length !== "undefined"){
		let mapEntry = await MapEntry.findOne({
			mapID: req.body.mapID
		});

		if(!mapEntry) return res.status(404).json({err: "Map not found."});

		if(!mapEntry.authorIDs.includes(req.profileID))  return res.status(404).json({err: "User is not an author of this map."});

		// Sanitize inputs
		let tagsArray = Array.from(req.body.tags);
		let authorsArray = Array.from(req.body.authors).map(a => String(a)).slice(0, SETTINGS.SITE.MAX_AUTHORS);

		if(authorsArray.length === 0) return res.json({err: "Empty Author Array"});

		let description = insane(req.body.description);

		if(tagsArray.length > 0) {
			tagsArray = tagsArray.map(a => ({tagType: a.tagType, name: (a.name || "").slice(0, SETTINGS.SITE.TAG_NAME_LENGTH)}))
				.slice(0, SETTINGS.SITE.MAX_TAGS);
		}
		if(authorsArray.some(a => a.length !== 24)) return res.json({err: "Invalid Author Array"});

		mapEntry.tags = tagsArray;
		mapEntry.description = description;
		mapEntry.authorIDs = authorsArray;
		mapEntry.unlisted = req.body.unlisted;

		await mapEntry.save();

		res.json({
			success: true
		});
	}
});

// Post Comment Route
app.post('/comment', loginMiddleware, async (req, res) => {
	if(Utils.hasCorrectParameters(req.body, {
		mapID: "number",
		body: "string"
	}) && req.profileID){
		let mapEntry = await MapEntry.findOne({
			mapID: req.body.mapID
		});

		if(!mapEntry) return res.status(404).json({err: "Map not found."});

		let commentingUser = await User.findById(req.profileID);
		if(!commentingUser) return res.status(404).json({err: "User not found."}); 

		mapEntry.comments.push({
			id: Utils.makeID(),
			parentID: "",
			date: new Date(),
			authorID: req.profileID,
			body: req.body.body
		});

		await mapEntry.save();

		res.json({
			success: true
		});
	}
});

// Link the map editor route
app.use('/map_editor', TagproEditMapEditor(new express.Router(), httpServer));
app.use('/', express.static(path.join(__dirname, 'public')));

// Pings the heroku app every 10 mins
setInterval(function() {
	fetch("http://fortunatemaps.herokuapp.com");
	console.log("Pinged!");
}, 10 * 60 * 1000);

httpServer.listen(PORT, () => {
	console.log('listening on *:' + PORT);
});