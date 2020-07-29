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

const TagproEditMapEditor = require("./editor/app");
const PreviewGenerator = require("./components/preview_generator");
const Utils = require("./Utils");

const MapEntry = require("./models/MapEntry");

const apiRouter = express.Router();

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

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

const SETTINGS = {
	MAPS_PER_PAGE: 20
};

app.get('/', async (req, res) => {
	let maps = await MapEntry.find({unlisted: false}).limit(SETTINGS.MAPS_PER_PAGE).sort({ dateUploaded: -1 });

	res.render('index', {
		maps
	});
});

app.get('/editor', (req, res) => {
	res.render('editor', {});
});

app.get('/search', async (req, res) => {
	req.query.q = String(req.query.q) || "";
	req.query.p = Math.max(Number(req.query.p) || 1, 1) - 1;
	let maps = await MapEntry.find({name: new RegExp(req.query.q, 'i'), unlisted: false})
		.skip((req.query.p * SETTINGS.MAPS_PER_PAGE))
		.limit(SETTINGS.MAPS_PER_PAGE)
		.sort({ dateUploaded: -1 });

	// console.log(req.query);

	res.render('search', {
		maps
	});
});

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

app.get('/preview/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	});

	if(!mapEntry) return res.redirect("/");

	previewPNGBase64 = mapEntry.previewPng;

	let img = Buffer.from(previewPNGBase64.slice(previewPNGBase64.indexOf(",")), 'base64');

	res.writeHead(200, {
		'Content-Type': 'image/png',
		'Content-Length': img.length
	});
	res.end(img);
});

app.get('/thumbnail/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	});

	if(!mapEntry) return res.redirect("/");

	thumbnailPNGBase64 = mapEntry.thumbnailPng;

	let img = Buffer.from(thumbnailPNGBase64.slice(thumbnailPNGBase64.indexOf(",")), 'base64');

	res.writeHead(200, {
		'Content-Type': 'image/png',
		'Content-Length': img.length
	});
	res.end(img);
});

app.get('/png/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	});

	if(!mapEntry) return res.redirect("/");

	sourcePNGBase64 = mapEntry.png;

	let img = Buffer.from(sourcePNGBase64, 'base64');

	res.writeHead(200, {
		'Content-Type': 'image/png',
		'Content-Length': img.length
	});
	res.end(img);
});

app.get('/json/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	});

	if(!mapEntry) return res.redirect("/");

	res.json(JSON.parse(mapEntry.json));
});

app.get('/test/:mapid', async (req, res) => {
	let mapEntry = await MapEntry.findOne({
		mapID: req.params.mapid
	});

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

app.post('/upload_map', async (req, res) => {
	if(req.body.layout && req.body.logic) {
		const mapLayout = String(req.body.layout);
		const mapLogic = String(req.body.logic);
		let mapJSON;

		try {
			mapJSON = JSON.parse(mapLogic);
		} catch {
			return res.json({
				err: "Invalid JSON"
			});
		}

		req.body.unlisted = Boolean(req.body.unlisted);
		req.body.sourceMapID = req.body.sourceMapID ? Number(req.body.sourceMapID) : 0;

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

		previewCanvas.toDataURL(async (err, png) => {
			if(err) {
				console.log(err);
				res.json({
					err: "There was an error generating the preview."
				});
				return;
			}

			let authorID = "";

			let isRemix = authorID === "" ? true : false;

			let newMapID = (await MapEntry.countDocuments({})) + 1;
			let versionSourceMapEntry = await MapEntry.findOne({mapID: req.body.sourceMapID});

			// console.log(versionSourceMapEntry);

			let versionSource = versionSourceMapEntry ? versionSourceMapEntry.versionSource : newMapID;

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

			let thumbnailCanvas = createCanvas(newWidth, newHeight);
			const ctx = thumbnailCanvas.getContext('2d');
			let sourceImg = new Image();

			sourceImg.onload = async () => {
				ctx.drawImage(
					sourceImg,
					0, 0,
					newWidth, newHeight
				);

				let thumbnailPNG = thumbnailCanvas.toDataURL();

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
					previewPng: png,
					thumbnailPng: thumbnailPNG,
					versionSource: versionSource,
					isRemix: isRemix,
					unlisted: req.body.unlisted
				});

				res.json({
					id: newMapID
				});
			};

			sourceImg.src = png;
		});
	}
});

// (async () => {
// 	let stream = (await PreviewGenerator(
// 		"http://unfortunate-maps.jukejuice.com/download?mapname=carlos&type=png&mapid=68279",
// 		"http://unfortunate-maps.jukejuice.com/download?mapname=carlos&type=json&mapid=68279"
// 	)).createPNGStream();
// 	const out = fs.createWriteStream(__dirname + '/mappreview.png');
// 	stream.pipe(out);

// 	out.on('finish', () => {
// 		console.log('The PNG file was created.');
// 	});
// })();

app.use('/map_editor', TagproEditMapEditor(new express.Router(), httpServer));
app.use('/', express.static(path.join(__dirname, 'public')));

setInterval(function() {
	httpReq.get("http://fortunatemaps.herokuapp.com");
	console.log("Pinged!");
}, 10 * 60 * 1000);

httpServer.listen(PORT, () => {
	console.log('listening on *:' + PORT);
});