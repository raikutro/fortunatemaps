require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');

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

app.get('/', (req, res) => {
	res.render('index', {});
});

app.get('/editor', (req, res) => {
	res.render('editor', {});
});

app.get('/map', (req, res) => {
	res.render('map', {});
});

app.post('/upload_map', async (req, res) => {
	if(req.body.layout && req.body.logic && req.body.sourceMapID) {
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
		req.body.sourceMapID = Number(req.body.sourceMapID);

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

			let newMapID = (await MapEntry.count({})) + 1;
			let versionSourceMapEntry = await MapEntry.findOne({mapID: req.body.sourceMapID});

			let versionSource = versionSourceMapEntry ? versionSourceMapEntry.versionSource : newMapID;

			await MapEntry.create({
				name: mapJSON.info.name,
				authorID: authorID,
				authorName: mapJSON.info.author,
				description: "No Description",
				dateUploaded: new Date(),
				tags: [],
				mapID: newMapID,
				json: mapLogic,
				png: mapLayout,
				previewPng: previewCanvas.toDataURL(),
				versionSource: versionSource,
				isRemix: isRemix,
				unlisted: req.body.unlisted
			});

			res.json({
				id: newMapID
			});
		});
	}
});

(async () => {
	let stream = (await PreviewGenerator(
		"http://unfortunate-maps.jukejuice.com/download?mapname=carlos&type=png&mapid=74001",
		"http://unfortunate-maps.jukejuice.com/download?mapname=carlos&type=json&mapid=74001"
	)).createPNGStream();
	const out = fs.createWriteStream(__dirname + '/mappreview.png');
	stream.pipe(out);

	out.on('finish', () => {
		console.log('The PNG file was created.');
	});
})();

(async () => {
	app.use('/map_editor', await TagproEditMapEditor(new express.Router(), httpServer));
})();
app.use('/', express.static(path.join(__dirname, 'public')));

httpServer.listen(PORT, () => {
	console.log('listening on *:' + PORT);
});