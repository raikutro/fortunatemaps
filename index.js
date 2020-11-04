require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const FormData = require('form-data');
const { createCanvas, Image } = require('canvas');

const app = express();
const httpServer = http.Server(app);

const DEV_MODE = !process.env.PORT;
const PORT = process.env.PORT || 80;

// The TagProEdit.com module.
// I compartimentalized the source code to its own module.
const TagproEditMapEditor = require("./editor/app");
const PreviewGenerator = require("./components/preview_generator");
const AWSController = require("./components/aws_controller");

// Basic Utility Functions
const Utils = require("./Utils");

// Mongoose Models
const MapEntry = require("./models/MapEntry");

// Expres Router for API routes. Doesn't have any routes right now.
const apiRouter = express.Router();

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const SETTINGS = {
	MAPS_PER_PAGE: 20
};

// Preview quality of preview & thumbnail images.
const PREVIEW_QUALITY = 0.7;

// Connect to the MongoDB Instance
mongoose.connect(process.env.MONGODB_URL, {
	useNewUrlParser: true,
	useFindAndModify: false,
	useCreateIndex: true,
	useUnifiedTopology: true,
});
mongoose.set('debug', false);

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

console.log(DEV_MODE ? "Running in Local Mode" : "Running in Production Mode");

// Home Page
app.get('/', async (req, res) => {
	let maps = await MapEntry.find({unlisted: false}).limit(SETTINGS.MAPS_PER_PAGE).sort({ dateUploaded: -1 });

	res.render('index', {
		maps
	});
});

// Map Editor
app.get('/editor', (req, res) => {
	res.render('editor', {});
});

// Search Page
app.get('/search', async (req, res) => {
	req.query.q = String(req.query.q) || "";
	req.query.p = Math.max(Number(req.query.p) || 1, 1) - 1;
	let maps = await MapEntry.find({name: new RegExp(req.query.q, 'i'), unlisted: false}, "name mapID authorName")
		.skip((req.query.p * SETTINGS.MAPS_PER_PAGE))
		.limit(SETTINGS.MAPS_PER_PAGE)
		.sort({ dateUploaded: -1 });

	// console.log(req.query);

	res.render('search', {
		maps
	});
});

// Map Page
app.get('/map/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	});

	if(!mapEntry) return res.redirect("/");

	let mapVersions = await MapEntry.find({
		versionSource: mapEntry.versionSource,
		isRemix: false
	}).limit(SETTINGS.MAPS_PER_PAGE).sort({ dateUploaded: -1 });

	let mapRemixes = await MapEntry.find({
		versionSource: mapEntry.versionSource,
		isRemix: true
	}).limit(SETTINGS.MAPS_PER_PAGE).sort({ dateUploaded: -1 });

	res.render('map', {
		map: mapEntry,
		mapVersions,
		mapRemixes
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
		}).limit(SETTINGS.MAPS_PER_PAGE).sort({ dateUploaded: -1 });

		mapRemixes = await MapEntry.find({
			versionSource: mapEntry.versionSource,
			isRemix: true
		}).limit(SETTINGS.MAPS_PER_PAGE).sort({ dateUploaded: -1 });
	}

	res.json({
		map: mapEntry,
		mapVersions,
		mapRemixes
	});
});

// Preview Image Route
app.get('/preview/:mapid.jpeg', (req, res) => res.redirect(`/preview/${req.params.mapid}`));
app.get('/preview/:mapid', async (req, res) => {
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

// Thumbnail Image Route
app.get('/thumbnail/:mapid.jpeg', (req, res) => res.redirect(`/thumbnail/${req.params.mapid}`));
app.get('/thumbnail/:mapid', async (req, res) => {
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
app.post('/upload_map', async (req, res) => {
	if(req.body.layout && req.body.logic) {
		const mapLayout = String(req.body.layout);
		const mapLogic = String(req.body.logic);
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
		req.body.unlisted = Boolean(req.body.unlisted);
		req.body.sourceMapID = req.body.sourceMapID ? Number(req.body.sourceMapID) : 0;

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
		previewCanvas.toDataURL('image/jpeg', PREVIEW_QUALITY, async (err, previewJPEG) => {
			if(err) {
				console.log(err);
				res.json({
					err: "There was an error generating the preview."
				});
				return;
			}

			// Accounts haven't been created yet so the authorID stays empty.
			let authorID = "";
			// The map entry gets counted as a remix automatically if there is no author.
			let isRemix = authorID === "" ? true : false;

			// Check if this is a remix of another map.
			let versionSourceMapEntry = 0;
			if(req.body.sourceMapID !== 0) versionSourceMapEntry = await MapEntry.findOne({mapID: req.body.sourceMapID});

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

				let thumbnailJPEG = thumbnailCanvas.toDataURL('image/jpeg', PREVIEW_QUALITY);

				let newMapID = (await MapEntry.countDocuments({})) + 1;
				// Set the version source to the original map
				// If it's a new map, then set its version source to it's own map ID
				let versionSource = versionSourceMapEntry ? versionSourceMapEntry.versionSource : newMapID;

				// Upload the preview & thumbnail images to the AWS S3 Bucket
				await AWSController.uploadMapImages({
					id: newMapID,
					previewJPEGBase64: previewJPEG,
					thumbnailJPEGBase64: thumbnailJPEG
				});

				// Save the MapEntry to MongoDB
				await MapEntry.create({
					name: mapJSON.info.name.slice(0, 150),
					authorID: authorID,
					authorName: mapJSON.info.author.slice(0, 150),
					description: "No Description",
					dateUploaded: new Date(),
					tags: [],
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