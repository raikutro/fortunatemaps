const { createCanvas, loadImage } = require('canvas');
const PNGImage = require('pngjs-image');
const ndFill = require('ndarray-fill');
const zeros = require('zeros');
const fetch = require('node-fetch');

const Utils = require('../Utils');
const SETTINGS = require('./settings');

let TILES = {};

(async () => {
	TILES.GENERAL = await loadImage("./assets/tiles.png");
	TILES.PORTALS = await loadImage("./assets/portal.png");
	TILES.BOOSTS = await loadImage("./assets/speedpad.png");
	TILES.REDBOOSTS = await loadImage("./assets/speedpadred.png");
	TILES.BLUEBOOSTS = await loadImage("./assets/speedpadblue.png");

	assetsLoaded = true;
})();

let assetsLoaded = false;

module.exports = (pngLink, json) => {
	return new Promise(async (resolve, reject) => {
		await waitForLoadedAssets();

		let map = await mapURLToArray(pngLink);
		let mapJSON;

		try {
			mapJSON = JSON.parse(json);
		} catch(e) {
			mapJSON = await mapURLToJSON(json);
		}

		const canvas = createCanvas(map.shape[0] * SETTINGS.TILE_SIZE, map.shape[1] * SETTINGS.TILE_SIZE);
		const ctx = canvas.getContext('2d');

		for (let y = 0; y < map.shape[1]; y++) {
			for (let x = 0; x < map.shape[0]; x++) {
				let tileType = map.get(x, y);

				let neighborObj = {
					UP: y !== 0 && SETTINGS.IS_WALL(map.get(x, y - 1)),
					DOWN: y !== map.shape[1] && SETTINGS.IS_WALL(map.get(x, y + 1)),
					LEFT: x !== 0 && SETTINGS.IS_WALL(map.get(x - 1, y)),
					RIGHT: x !== map.shape[0] && SETTINGS.IS_WALL(map.get(x + 1, y))
				};

				if(tileType !== SETTINGS.TILE_IDS.BACKGROUND) {
					ctx.drawImage(
						TILES.GENERAL,
						SETTINGS.TILE_COORDINATES.FLOOR.x * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_COORDINATES.FLOOR.y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
						x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
					);
				}

				if(SETTINGS.IS_WALL(tileType)) {
					drawWall(ctx, x, y, SETTINGS.TILE_NAMES[tileType], neighborObj);
				} else if(SETTINGS.TILE_COORDINATES[SETTINGS.TILE_NAMES[tileType]]) {
					ctx.drawImage(
						TILES.GENERAL,
						SETTINGS.TILE_COORDINATES[SETTINGS.TILE_NAMES[tileType]].x * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_COORDINATES[SETTINGS.TILE_NAMES[tileType]].y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
						x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
					);
				} else if(tileType === SETTINGS.TILE_IDS.BOOST) {
					ctx.drawImage(
						TILES.BOOSTS,
						0, 0,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
						x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
					);
				} else if(tileType === SETTINGS.TILE_IDS.REDBOOST) {
					ctx.drawImage(
						TILES.REDBOOSTS,
						0, 0,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
						x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
					);
				} else if(tileType === SETTINGS.TILE_IDS.BLUEBOOST) {
					ctx.drawImage(
						TILES.BLUEBOOSTS,
						0, 0,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
						x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
					);
				} else if(tileType === SETTINGS.TILE_IDS.PORTAL) {
					ctx.drawImage(
						TILES.PORTALS,
						0, 0,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
						x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
					);
				}
			}
		}

		fillStates(ctx, mapJSON);

		resolve(canvas);
	});
}

function mapURLToArray(mapURL){
	return new Promise((resolve, reject) => {
		let mapPNGLink = mapURL;
		PNGImage.readImage(mapPNGLink, (err, image) => {
			if(err) reject(err);

			let array = mapImageToArray(image);

			if(!array) return reject("Couldn't resolve map data.");

			resolve(array);
		});
	}).catch(console.log);
}

function mapURLToJSON(mapURL){
	return new Promise((resolve, reject) => {
		let mapJSONLink = mapURL;
		fetch(mapJSONLink).then(a => a.json()).then(resolve).catch(reject);
	}).catch(console.log);
}

function mapImageToArray(image) {
	if(!image) return false;
	let width = image.getWidth();
	let height = image.getHeight();

	let buffer = zeros([width, height], "array");

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let tileType = SETTINGS.TILE_COLORS.findIndex(a => {
				let tileRGB = Utils.hexToRGB(image.getColor(x, y));
				return a.red === tileRGB[0] && a.green === tileRGB[1] && a.blue === tileRGB[2];
			});
			if(tileType === -1) {
				// console.log(image.getColor(x, y), hexToRGB(image.getColor(x, y)));
				tileType = SETTINGS.TILE_IDS.BACKGROUND;
			}

			buffer.set(x, y, tileType);
		}
	}

	return buffer;
}

function fillStates(ctx, mapJSON){
	Object.keys(mapJSON.fields).forEach(key => {
		let position = key.split(",");
		position = {
			x: position[0],
			y: position[1]
		};

		let gateCoords = SETTINGS.TILE_COORDINATES[mapJSON.fields[key].defaultState.toUpperCase() + "GATE"];

		ctx.drawImage(
			TILES.GENERAL,
			gateCoords.x * SETTINGS.TILE_SIZE, gateCoords.y * SETTINGS.TILE_SIZE,
			SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
			position.x * SETTINGS.TILE_SIZE, position.y * SETTINGS.TILE_SIZE,
			SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
		);
	});

	Object.keys(mapJSON.portals).forEach(key => {
		let position = key.split(",");
		position = {
			x: position[0],
			y: position[1]
		};

		// draw deactivated portal on portals with no destination
		if(!mapJSON.portals[key].destination) {
			ctx.drawImage(
				TILES.PORTALS,
				160, 0,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
				position.x * SETTINGS.TILE_SIZE, position.y * SETTINGS.TILE_SIZE,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
			);
		}
	});
}

function drawWall(ctx, x, y, type, neighbors) {
	if(type === "WALL") type = "FULL";

	for (let i = 0; i < 4; i++) {
		// console.log(SETTINGS.WALL_DRAW_ORDER[i], SETTINGS.WALL_COORDINATES.FULL[i]);
		ctx.drawImage(
			TILES.GENERAL,
			SETTINGS.WALL_COORDINATES[type][i][0],
			SETTINGS.WALL_COORDINATES[type][i][1],
			SETTINGS.QUADRANT_SIZE, SETTINGS.QUADRANT_SIZE,
			(x * SETTINGS.TILE_SIZE) + SETTINGS.WALL_DRAW_ORDER[i][0],
			(y * SETTINGS.TILE_SIZE) + SETTINGS.WALL_DRAW_ORDER[i][1],
			SETTINGS.QUADRANT_SIZE, SETTINGS.QUADRANT_SIZE
		);
	}

	Object.keys(neighbors).forEach(key => {
		if(neighbors[key]) {
			ctx.drawImage(
				TILES.GENERAL,
				SETTINGS.WALL_CONNECTIONS[type][key][0],
				SETTINGS.WALL_CONNECTIONS[type][key][1],
				SETTINGS.WALL_CONNECTIONS[type][key][2],
				SETTINGS.WALL_CONNECTIONS[type][key][3],
				(x * SETTINGS.TILE_SIZE) + SETTINGS.WALL_CONNECTION_POSITIONS[key][0],
				(y * SETTINGS.TILE_SIZE) + SETTINGS.WALL_CONNECTION_POSITIONS[key][1],
				SETTINGS.WALL_CONNECTIONS[type][key][2],
				SETTINGS.WALL_CONNECTIONS[type][key][3]
			);
		}
	});
}

function waitForLoadedAssets() {
	return new Promise((resolve, reject) => {
		let waitInterval;
		waitInterval = setInterval(() => {
			if(assetsLoaded) {
				resolve();
				clearInterval(waitInterval);
			}
		}, 500);
	});
}