require('dotenv').config();
console.log("Loading FortunateMaps Server...");

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
const rateLimit = require('express-rate-limit');
const insane = require('insane');

const app = express();
const httpServer = http.Server(app);

const PORT = process.env.PORT || 80;
const MAPTEST_URL = process.env.MAPTEST_URL || 'tagpro.koalabeast.com';
const TEMP_FILE_PATH = './temp';

// The TagProEdit.com module.
// The source code is now its own module.
const TagproEditMapEditor = require('./editor/app');
console.log("Loaded tagproedit.com editor");

const PreviewGenerator = require('./components/preview_generator');

// Routes
const AccountRoutes = require('./routes/account_routes');

// Basic Utility Functions
const Utils = require('./Utils');

// Settings
const SETTINGS = require('./Settings');

// Mongoose Models
// Models cannot be initiated until DB connection.
let MapEntry = null;
let User = null;
let ServerInfo = null;

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Express Router for API routes.
const apiRouter = express.Router();
// 200 requests per 30 seconds
const generalDBLimiter = rateLimit({
	windowMs: 30 * 1000,
	max: 200,
	standardHeaders: true,
	legacyHeaders: false,
});
// 20 requests per 5 minutes
const mapUploadLimiter = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
});
// 20 requests per 2 minutes
const mapUpdateLimiter = rateLimit({
	windowMs: 2 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
});
// 20 requests per 5 minutes
const commentLimiter = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
});

let DATABASE_STATS = {
	mapCount: Infinity,
	highestMapID: 100000,
	getMaxPage: () => Math.max(Math.round(DATABASE_STATS.mapCount / SETTINGS.SITE.MAPS_PER_PAGE) - 1, 1)
};

let sharedTokens = {
	login: {}
};

let announcementHTML = null;

// Middleware
const LoginMiddleware = require('./middleware/LoginMiddleware')(sharedTokens);

console.log(SETTINGS.DEV_MODE ? "RUNNING IN DEVELOPER MODE" : "RUNNING IN PRODUCTION MODE");

// Connect to the MongoDB Instance
mongoose.set('debug', false);
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGODB_URL, {
	
}).then(async () => {
	console.log("Connected to MongoDB");

	// Mongoose Models
	MapEntry = require('./models/MapEntry');
	User = require('./models/User');
	ServerInfo = require('./models/ServerInfo');
	
	await loadLoginTokens();
	await saveDatabaseStats();

	AccountRoutes(app, sharedTokens);

	httpServer.listen(PORT, () => {
		console.log('listening on *:' + PORT);
	});
}).catch(err => console.error(err));

if(process.env._ && process.env._.includes("heroku")) {
	console.log("HEROKU DETECTED");
	app.enable('trust proxy');
}

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/', apiRouter);

apiRouter.use(generalDBLimiter);

// Retrieve login tokens stored in jsonbin
async function loadLoginTokens() {
	const serverInfo = await ServerInfo.findOne({});

	if(!serverInfo) {
		console.log("No ServerInfo found, creating new ServerInfo.");
		await ServerInfo.create({
			loginTokens: {}
		});
		return await loadLoginTokens();
	}

	console.log(serverInfo)

	sharedTokens.login = serverInfo.loginTokens || {};
}

// Home Page
app.get('/', LoginMiddleware, async (req, res) => {
	let maps = await MapEntry.find({ unlisted: false }).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ mapID: -1 });

	maps = maps.map(d => {
		let doc = d.toObject();
		doc.png = doc.png.toString('base64');
		doc.json = doc.json.toString('base64');
		return doc;
	});

	res.render('index', {
		...(await Utils.templateEngineData(req)),
		query: "",
		page: 1,
		maps,
		announcementHTML,
		maxPage: DATABASE_STATS.getMaxPage()
	});
});

// Map Editor
app.get('/editor', LoginMiddleware, async (req, res) => {
	res.render('editor', {
		...(await Utils.templateEngineData(req))
	});
});

let generatingPreviewsTracker = {};

// Preview Image Route
app.get('/preview/:mapid.jpeg', async (req, res) => {
	const mapID = Number(req.params.mapid);
	if(!mapID) return res.send("Invalid Map ID");

	// Check if map exists in TEMP_FILE_PATH folder. if it does, send the file, if it doesn't, generate the file preview and send it.
	if(!fs.existsSync(`${TEMP_FILE_PATH}/${mapID}.jpeg`)) {
		let mapEntry = await MapEntry.findOne({
			mapID
		}, "png json");

		if(!mapEntry) return res.redirect("/");

		if(generatingPreviewsTracker[mapID] || Object.keys(generatingPreviewsTracker).length > 5) return res.redirect(`/png/${mapID}.png`);

		generatingPreviewsTracker[mapID] = true;

		const sourcePNG = (await Utils.Compression.decompressMapLayout(mapEntry.png)).toString('base64');
		const sourceJSON = JSON.stringify(await Utils.Compression.decompressMapLogic(mapEntry.json));

		let previewCanvas = await PreviewGenerator.generate(
			sourcePNG,
			sourceJSON
		).catch(err => {
			console.error("PREVIEW GENERATION ERROR:", err);
			res.json(SETTINGS.ERRORS.PREVIEW_GENERATION(err));
			return null;
		});

		await previewCanvas.image.write(`${TEMP_FILE_PATH}/${mapID}.jpeg`, {
			quality: 50
		});

		delete generatingPreviewsTracker[mapID];
	}

	res.sendFile(path.join(__dirname, `${TEMP_FILE_PATH}/${mapID}.jpeg`));
});
app.get('/preview/:mapid', (req, res) => res.redirect(`/preview/${req.params.mapid}.jpeg`));

// Thumbnail Image Route
app.get('/thumbnail/:mapid.jpeg', (req, res) => res.redirect(`/preview/${req.params.mapid}.jpeg`));
app.get('/thumbnail/:mapid', (req, res) => res.redirect(`/thumbnail/${req.params.mapid}.jpeg`));

// Search Page
apiRouter.get('/search', LoginMiddleware, async (req, res) => {
	// Sanitize queries
	req.query.q = String(req.query.q) || "";
	req.query.p = Math.max(Number(req.query.p) || 1, 1) - 1;

	let skipNum = req.query.p * SETTINGS.SITE.MAPS_PER_PAGE;
	if(skipNum > DATABASE_STATS.getMaxPage() * SETTINGS.SITE.MAPS_PER_PAGE) {
		req.query.p = DATABASE_STATS.getMaxPage();
	}

	const rawSearchQuery = req.query.q;

	// Grab "@", "@@", and "#" and the text that comes after.
	const specialQueries = req.query.q.match(/(^|)((@@|@|#)[a-z\d-]+)/gi) || [];

	// Get all the "@" queries.
	const rawQueries = {
		author: specialQueries.filter(a => a.startsWith("@") && !a.startsWith("@@")),
		tag: specialQueries.filter(a => a.startsWith("#")),
		authorText: specialQueries.filter(a => a.startsWith("@@")),
	};

	// This monster of a statement gets all "@" queries and converts them to a list of user ids.
	const authorQueries = (await Promise.all(rawQueries.author.map(a => new Promise(async (resolve) => {
		let user = (await User.findOne({username: new RegExp(Utils.makeAlphanumeric(a), "i")}, "_id")) || {_id: ""};
		resolve(user._id);
	})))).filter(a => a.length !== 0);
	
	// Get all the "#" queries and sanitize them.
	const tagQueries = rawQueries.tag.map(a => new RegExp(Utils.makeAlphanumeric(a).trim(), "i"));

	// Get all the "@@" queries and sanitize them.
	const authorTextQueries = rawQueries.authorText.map(a => new RegExp(Utils.makeAlphanumeric(a).trim(), "i"));

	// Remove all the special queries from the actual query
	specialQueries.forEach(specialQuery => {
		req.query.q = req.query.q.replace(specialQuery, "");
	});

	// Trim off the whitespace
	req.query.q = Utils.makeAlphanumeric(req.query.q.trim()).slice(0, SETTINGS.SITE.MAP_NAME_LENGTH);

	try {
		req.query.q = new RegExp(req.query.q, 'i');
	} catch(e) {
		return;
	}

	let finalQuery = {
		name: req.query.q,
		authorIDs: { $all: authorQueries },
		tags: { $all: tagQueries },
		authorName: authorTextQueries,
		unlisted: false
	};

	// Remove field queries if they don't need to be there
	if(authorQueries.length === 0) delete finalQuery.authorIDs;
	if(tagQueries.length === 0) delete finalQuery.tags;
	if(authorTextQueries.length === 0) delete finalQuery.authorName;

	let maps = await MapEntry.find(finalQuery, "name mapID authorName png json")
		.skip(skipNum)
		.limit(SETTINGS.SITE.MAPS_PER_PAGE)
		.sort({ mapID: -1 });

	maps = maps.map(d => {
		let doc = d.toObject();
		doc.png = doc.png.toString('base64');
		doc.json = doc.json.toString('base64');
		return doc;
	});

	res.render('search', {
		...(await Utils.templateEngineData(req)),
		query: rawSearchQuery,
		page: req.query.p + 1,
		parsedQuery: {
			query: req.query.q,
			...rawQueries
		},
		maps,
		maxPage: DATABASE_STATS.getMaxPage()
	});
});

// Map Page
apiRouter.get('/map/:mapid', LoginMiddleware, async (req, res) => {
	const mapID = Number(req.params.mapid);
	if(!mapID) return res.redirect("/");
	
	let mapEntry = await MapEntry.findOne({
		mapID: String(mapID)
	}).catch(err => {
		// console.log(err);
		// res.send("Invalid Map ID");
	});

	if(!mapEntry) return res.redirect("/");

	const userProfile = await req.getProfile();
	const isAdmin = userProfile ? userProfile.isAdmin : false;

	let mapVersions = await MapEntry.find({
		versionSource: mapEntry.versionSource,
		isRemix: false
	}).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ mapID: -1 });

	let mapRemixes = await MapEntry.find({
		versionSource: mapEntry.versionSource,
		isRemix: true
	}).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ mapID: -1 });

	mapEntry = mapEntry.toObject();

	mapEntry.png = mapEntry.png.toString('base64');
	mapEntry.json = mapEntry.json.toString('base64');

	res.render('map', {
		...(await Utils.templateEngineData(req)),
		map: mapEntry,
		mapVersions,
		mapRemixes,
		isAdmin
	});
});


// UM Map Page
apiRouter.get('/show/:mapid', LoginMiddleware, async (req, res) => {
	const mapID = Number(req.params.mapid);
	if(!mapID) return res.redirect("/");
	
	let mapEntry = await MapEntry.findOne({
		authorIDs: { $size: 0 },
		description: { "$regex": `-- Original U-M ID: ${String(mapID).slice(0, 8)} --` }
	}).catch(err => {
		return null;
	});

	if(!mapEntry) return res.redirect("/");

	res.redirect("/map/" + mapEntry.mapID);
});

apiRouter.get('/static/previews/:mapid.png', LoginMiddleware, async (req, res) => {
	const mapID = Number(req.params.mapid);
	if(!mapID) return res.redirect("/assets/logo.png");
	
	let mapEntry = await MapEntry.findOne({
		authorIDs: { $size: 0 },
		description: { "$regex": `-- Original U-M ID: ${String(mapID).slice(0, 8)} --` }
	}).catch(err => {
		return null;
	});

	if(!mapEntry) return res.redirect("/assets/logo.png");

	res.redirect(`/preview/${mapEntry.mapID}.jpeg`);
});

// Map Data Route, returns data about the map and if requested by the client: its other versions and/or remixes.
apiRouter.get('/map_data/:mapid', async (req, res) => {
	const mapID = Number(req.params.mapid);
	if(!mapID) return res.json(SETTINGS.ERRORS.INVALID_MAP_ID());

	let mapEntry = await MapEntry.findOne({
		mapID: mapID
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
		}).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ mapID: -1 });

		mapRemixes = await MapEntry.find({
			versionSource: mapEntry.versionSource,
			isRemix: true
		}).limit(SETTINGS.SITE.MAPS_PER_PAGE).sort({ mapID: -1 });
	}

	mapEntry = mapEntry.toObject();

	mapEntry.png = (await Utils.Compression.decompressMapLayout(Buffer.from(mapEntry.png.toString('base64'), 'base64'))).toString('base64');
	mapEntry.json = JSON.stringify(await Utils.Compression.decompressMapLogic(Buffer.from(mapEntry.json.toString('base64'), 'base64')));

	res.json({
		map: mapEntry,
		mapVersions,
		mapRemixes
	});
});

apiRouter.get('/author_id/:query', async (req, res) => {
	if(!Utils.hasCorrectParameters(req.params, {
		query: "string"
	})) return res.json({err: "Invalid Parameters"});

	if(!Utils.isAlphanumeric(req.params.query)) return res.json({ users: [] });

	let users = await User.find({username: new RegExp(req.params.query, "i")}, "username _id");

	res.json({
		users: users.map(a => { return {id: a._id, username: a.username} })
	});
});

apiRouter.get('/author_names/:authorid', async (req, res) => {
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

// Source PNG Image Route
apiRouter.get('/png/:mapid.png', async (req, res) => {
	const mapID = Number(req.params.mapid);
	if(!mapID) return res.send("Invalid Map ID");

	let mapEntry = await MapEntry.findOne({
		mapID
	}, "png");

	if(!mapEntry) return res.redirect("/");

	const sourcePNG = await Utils.Compression.decompressMapLayout(mapEntry.png);

	res.writeHead(200, {
		'Content-Type': 'image/png',
		'Content-Length': sourcePNG.length
	});
	res.end(sourcePNG);
});
app.get('/png/:mapid', (req, res) => res.redirect(`/png/${req.params.mapid}.png`));

// Source JSON Image Route
apiRouter.get('/json/:mapid.json', async (req, res) => {
	const mapID = Number(req.params.mapid);
	if(!mapID) return res.send("Invalid Map ID");

	let mapEntry = await MapEntry.findOne({
		mapID
	}, "json");

	if(!mapEntry) return res.redirect("/");

	const sourceJSON = await Utils.Compression.decompressMapLogic(mapEntry.json);

	res.json(sourceJSON);
});
app.get('/json/:mapid', (req, res) => res.redirect(`/json/${req.params.mapid}.json`));

// Map Test Route
// Generates map test links.
apiRouter.get('/test/:mapid', async (req, res) => {
	res.send(`
<script>fetch(location.href.replace('/test/', '/create_test_link/'), {
    method: 'POST'
}).then(r => r.json()).then(json => {
    if(json.err) return alert("ERROR: " + json.err);
    location.href = json.url;
});</script>
`);
});

apiRouter.post('/create_test_link/:mapid', async (req, res) => {
	const mapID = Number(req.params.mapid);
	if(!mapID) return res.json(SETTINGS.ERRORS.INVALID_MAP_ID());

	let mapEntry = await MapEntry.findOne({
		mapID: mapID
	}, "png json");

	if(!mapEntry) return res.json(SETTINGS.ERRORS.NOT_FOUND("Map Entry Not Found"));

	const layout = await Utils.Compression.decompressMapLayout(mapEntry.png);
	const logic = JSON.stringify(await Utils.Compression.decompressMapLogic(mapEntry.json));

	const form = new FormData();
	let url = `https://${MAPTEST_URL}/groups/testmap`;

	const {host, pathname} = new URL(url);

	// console.log(layout, logic);

	form.append('layout', layout, { filename: 'map.png', contentType: 'application/octet-stream' });
	form.append('logic', logic, { filename: 'map.json', contentType: 'application/octet-stream' });

	const testURL = await fetch(url, {
		method: 'POST',
		body: form,
	}).then(async (r) => {
		// console.log(r.headers, r.status, r.statusText, r.ok, r.url, await r.text());
		return r.ok ? r.url : null;
	}).catch(err => {
		console.error(err);
		res.json(SETTINGS.ERRORS.TEST_MAP_LINK_FAIL('Map Test Server Failed, ' + err));
		return null;
	});

	if(!testURL) return;

	res.json({
		url: testURL
	});
});

apiRouter.post('/testmap', async (req, res) => {
	if(!req.body.logic) return res.json(SETTINGS.ERRORS.TEST_MAP_LINK_FAIL("Missing Map Logic"));
	if(!req.body.layout) return res.json(SETTINGS.ERRORS.TEST_MAP_LINK_FAIL("Missing Map Layout"));

	let mapJSON;

	try {
		mapJSON = JSON.stringify(JSON.parse(req.body.logic));
	} catch(e) {
		return res.json(SETTINGS.ERRORS.TEST_MAP_LINK_FAIL("Invalid Map Logic"));
	}

	const layout = Buffer.from(req.body.layout, 'base64');
	const logic = Buffer.from(req.body.logic);

	const form = new FormData();
	let url = `https://${MAPTEST_URL}/groups/testmap`;

	const {host, pathname} = new URL(url);

	form.append('layout', layout, { filename: 'map.png', contentType: 'application/octet-stream' });
	form.append('logic', logic, { filename: 'map.json', contentType: 'application/octet-stream' });
	
	const testURL = await fetch(url, {
		method: 'POST',
		body: form,
	}).then(r => r.ok ? r.url : null).catch(err => {
		console.error(err);
		res.json(SETTINGS.ERRORS.TEST_MAP_LINK_FAIL('Map Test Server Failed, ' + err));
		return null;
	});

	if(!testURL) return;

	res.json({
		url: testURL
	});
});

// Upload Map Route
// Uploads a map to the server
apiRouter.post('/upload_map', 
	mapUploadLimiter,
	LoginMiddleware, async (req, res) => {
	if(Utils.hasCorrectParameters(req.body, {
		logic: "string",
		layout: "string",
		sourceMapID: "number",
		unlisted: "boolean"
	})){
		try {
			const mapLayout = req.body.layout;
			const mapLogic = req.body.logic;
			let mapJSON;

			if(mapLayout.length > SETTINGS.MAPS.MAX_PNG_LENGTH) return res.json(
				SETTINGS.ERRORS.UPLOAD_MAX_SIZE(`The PNG File in base64 form must be less than ${SETTINGS.MAPS.MAX_PNG_LENGTH} in length.`)
			);

			if(mapLogic.length > SETTINGS.MAPS.MAX_JSON_LENGTH) return res.json(
				SETTINGS.ERRORS.UPLOAD_MAX_SIZE(`The JSON must be less than ${SETTINGS.MAPS.MAX_JSON_LENGTH} in length.`)
			);

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

			// Put users authorID inside if they're logged in.
			let authorIDs = [];

			if(req.profileID) authorIDs = [req.profileID];

			// Check if this is a remix of another map.
			let versionSourceMapEntry = 0;
			if(req.body.sourceMapID !== 0) versionSourceMapEntry = await MapEntry.findOne({mapID: req.body.sourceMapID});

			// isRemix is true if a versionSource was given and the submitter is not an author of the original source
			// isRemix is false if a versionSource was given and the submitter is an author of the original source
			// isRemix is false if a versionSource was not given
			let isRemix = versionSourceMapEntry === 0 ? false : (
				!versionSourceMapEntry.authorIDs.includes(req.profileID)
			);
			// The Three Final States of isRemix and versionSource in the MapEntry:
			// 1. isRemix = true + versionSource > 0 = Map is a remix
			// 2. isRemix = false + versionSource === 0 = Map is original
			// 3. isRemix = false + versionSource > 0 = Map is a new version

			let newMapID = await getHighestMapID() + 1;
			// Set the version source to the original map
			// If it's a new map, then set its version source to it's own map ID
			let versionSource = versionSourceMapEntry ? versionSourceMapEntry.versionSource : newMapID;

			let mapName = Utils.cleanQueryableText(insane(mapJSON.info.name).slice(0, SETTINGS.SITE.MAP_NAME_LENGTH));
			let authorName = Utils.cleanQueryableText(insane(mapJSON.info.author).slice(0, SETTINGS.SITE.MAP_NAME_LENGTH))

			// Compress Map Image
			const mapLayoutCompressedBuffer = await Utils.Compression.compressMapLayout(mapLayout);

			// Compress Map Logic for Smaller Storage
			const mapLogicCompressedBuffer = await Utils.Compression.compressMapLogic(mapJSON);

			// Save the MapEntry to MongoDB
			await MapEntry.create({
				name: mapName,
				authorIDs: authorIDs,
				authorName: authorName,
				description: "No Description",
				dateUploaded: new Date(),
				tags: [],
				hiddenTags: [],
				mapID: newMapID,
				json: mapLogicCompressedBuffer,
				png: mapLayoutCompressedBuffer,
				versionSource: versionSource,
				isRemix: isRemix,
				unlisted: req.body.unlisted
			});

			// Send the new map ID to the client.
			res.json({
				id: newMapID
			});
		} catch(err) {
			console.error(err);
			res.json({ err: "An unexpected error occurred" });
		}
	} else {
		res.json({err: "Invalid Parameters"});
	}
});

// Update Map Route
apiRouter.post('/update_map', mapUpdateLimiter, LoginMiddleware, async (req, res) => {
	if(Utils.hasCorrectParameters(req.body, {
		mapID: "number",
		mapName: "string",
		mapAuthor: "string",
		description: "string",
		tags: "object",
		authors: "object",
		unlisted: "boolean"
	}) && Array.isArray(req.body.tags)) {
		let mapEntry = await MapEntry.findOne({
			mapID: req.body.mapID
		});

		const userProfile = await req.getProfile();

		if(!userProfile) return res.status(404).json({err: "User not found."});
		if(!mapEntry) return res.status(404).json({err: "Map not found."});

		if(!mapEntry.authorIDs.includes(req.profileID) && !userProfile.isAdmin) return res.status(404).json({err: "User is not an author of this map."});

		// Sanitize inputs
		let tagsArray = Array.from(new Set(req.body.tags));
		let authorsArray = Array.from(req.body.authors).map(a => String(a)).slice(0, SETTINGS.SITE.MAX_AUTHORS);

		if(authorsArray.length === 0 && !userProfile.isAdmin) return res.json({err: "Empty Author Array"});
		if(authorsArray.some(a => a.length !== 24)) return res.json({err: "Invalid Author Array"});
		if(tagsArray.length > SETTINGS.SITE.MAX_TAGS) return res.json({err: "Too many tags."});

		// Sanitize the tags
		tagsArray = tagsArray.map(t => 
			Utils.makeAlphanumeric(t)
			.slice(0, SETTINGS.SITE.TAG_NAME_MAX_LENGTH)
		);

		let description = insane(req.body.description).slice(0, 500);
		let mapName = Utils.cleanQueryableText(insane(req.body.mapName).slice(0, SETTINGS.SITE.MAP_NAME_LENGTH));
		let mapAuthor = Utils.cleanQueryableText(insane(req.body.mapAuthor).slice(0, SETTINGS.SITE.AUTHOR_LENGTH));

		mapEntry.name = mapName;
		mapEntry.authorName = mapAuthor;
		mapEntry.tags = tagsArray;
		mapEntry.description = description;
		mapEntry.authorIDs = authorsArray;
		mapEntry.unlisted = req.body.unlisted;

		// Update the map logic field
		try {
			let mapJSON = await Utils.Compression.decompressMapLogic(mapEntry.json);

			mapJSON.info.name = mapName;
			mapJSON.info.author = mapAuthor;

			mapEntry.json = await Utils.Compression.compressMapLogic(mapJSON);
		} catch {
			return res.json({
				err: "Invalid JSON"
			});
		}

		await mapEntry.save();

		res.json({
			success: true
		});
	}
});

// Post Comment Route
apiRouter.post('/comment', commentLimiter, LoginMiddleware, async (req, res) => {
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

// Like Map Route
apiRouter.post('/like', LoginMiddleware, async (req, res) => {
	if(Utils.hasCorrectParameters(req.body, {
		mapID: "number"
	}) && req.profileID){
		let mapEntry = await MapEntry.findOne({
			mapID: req.body.mapID
		});

		if(!mapEntry) return res.status(404).json({err: "Map not found."});

		let likingUser = await User.findById(req.profileID);
		if(!likingUser) return res.status(404).json({err: "User not found."}); 

		// Find the users profile ID inside the maps like list
		let profileIndex = mapEntry.likes.findIndex(pID => String(pID) === req.profileID);

		// Toggles the like status of a map
		if(profileIndex > -1) mapEntry.likes.splice(profileIndex, 1);
		else mapEntry.likes.push(mongoose.Types.ObjectId(req.profileID));

		await mapEntry.save();

		res.json({
			success: true
		});
	}
});

apiRouter.post('/send_announcement', LoginMiddleware, async (req, res) => {
	const userProfile = await req.getProfile();
	const isAdmin = userProfile ? userProfile.isAdmin : false;

	if(!isAdmin) return res.status(401);

	announcementHTML = req.body.announcement;

	res.json({
		success: true
	});
});

// Link the map editor route
app.use('/map_editor', TagproEditMapEditor(new express.Router(), httpServer));
app.use('/vendor/msgpackr', express.static(path.join(__dirname, 'node_modules/msgpackr/dist')));
app.use('/', express.static(path.join(__dirname, 'public')));

setInterval(saveDatabaseStats, 15000);

async function saveDatabaseStats() {
	DATABASE_STATS = {
		...DATABASE_STATS,
		mapCount: await MapEntry.countDocuments({}),
		highestMapID: await getHighestMapID()
	};
}

async function getHighestMapID() {
	return MapEntry.find({})
		.sort({ mapID: -1 })
		.limit(1)
		.then(maps => maps[0] ? maps[0].mapID : 1);
}