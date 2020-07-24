require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = express();
const httpServer = http.Server(app);

const DEV_MODE = !process.env.PORT;
const PORT = process.env.PORT || 80;

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

app.get('/', function(req, res){
	res.render('index', {});
});

app.get('/map', function(req, res){
	res.render('map', {});
});

app.get('/map', function(req, res){
	res.sendFile(__dirname + '/public/map.html');
});

app.use('/', express.static(path.join(__dirname, 'public')));

httpServer.listen(PORT, () => {
	console.log('listening on *:' + PORT);
});