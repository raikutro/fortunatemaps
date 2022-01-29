const { createCanvas, loadImage } = require('canvas');
const PNGImage = require('pngjs-image');
const ndFill = require('ndarray-fill');
const zeros = require('zeros');
const fetch = require('node-fetch');

const Utils = require('../Utils');
const SETTINGS = require('./map_settings');
const fs = require("fs");

const TEXTURES = ["VANILLA"];

let TILES = {};

(async () => {
	let promises = TEXTURES.map(name => {
		return new Promise(async (resolve, reject) => {
			TILES[name] = {};
			TILES[name].GENERAL = await loadImage(`./assets/textures/${name.toLowerCase()}/tiles.png`);
			TILES[name].PORTALS = await loadImage(`./assets/textures/${name.toLowerCase()}/portal.png`);
			TILES[name].BOOSTS = await loadImage(`./assets/textures/${name.toLowerCase()}/speedpad.png`);
			TILES[name].REDBOOSTS = await loadImage(`./assets/textures/${name.toLowerCase()}/speedpadred.png`);
			TILES[name].BLUEBOOSTS = await loadImage(`./assets/textures/${name.toLowerCase()}/speedpadblue.png`);
			TILES[name].REDPORTALS = await loadImage(`./assets/textures/${name.toLowerCase()}/portalred.png`);
			TILES[name].BLUEPORTALS = await loadImage(`./assets/textures/${name.toLowerCase()}/portalblue.png`);

			resolve();
		});
	});

	Promise.all(promises).then(() => {
		assetsLoaded = true;
	});
})();

let assetsLoaded = false;

module.exports = (rawPngLink, json, textureName="VANILLA") => {
	return new Promise(async (resolve, reject) => {
		await waitForLoadedAssets();

		let pngLink;
		let tempURL = null;

		if(rawPngLink.includes("://")) {
			pngLink = rawPngLink;
		} else {
			pngLink = await new Promise((resolve, reject) => {
				tempURL = `./temp/temp${Date.now()}.png`;
				fs.writeFile(tempURL, rawPngLink, 'base64', async (err) => {
					if(err) reject(err);

					resolve(tempURL);
				});
			});
		}

		let map = await mapURLToArray(pngLink);
		let mapJSON;

		if(tempURL !== null) {
			let deletedFile = await new Promise((resolve, reject) => {
				fs.unlink(tempURL, err => {
					if(err) return reject(err);

					resolve(tempURL);
				});
			}).catch(err => {
				console.log(err);
				return false;
			});
		}

		try {
			mapJSON = JSON.parse(json);
		} catch(e) {
			mapJSON = await mapURLToJSON(json);
		}

		const canvas = createCanvas(map.shape[0] * SETTINGS.TILE_SIZE, map.shape[1] * SETTINGS.TILE_SIZE);
		const ctx = canvas.getContext('2d');
		const drawTile = (tile, x, y) => {
			ctx.drawImage(
				tile,
				0, 0,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
				x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
			);
		};

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
						TILES[textureName].GENERAL,
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
						TILES[textureName].GENERAL,
						SETTINGS.TILE_COORDINATES[SETTINGS.TILE_NAMES[tileType]].x * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_COORDINATES[SETTINGS.TILE_NAMES[tileType]].y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
						x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
					);
				} else if(tileType === SETTINGS.TILE_IDS.BOOST) {
					drawTile(TILES[textureName].BOOSTS, x, y);
				} else if(tileType === SETTINGS.TILE_IDS.REDBOOST) {
					drawTile(TILES[textureName].REDBOOSTS, x, y);
				} else if(tileType === SETTINGS.TILE_IDS.BLUEBOOST) {
					drawTile(TILES[textureName].BLUEBOOSTS, x, y);
				} else if(tileType === SETTINGS.TILE_IDS.PORTAL) {
					drawTile(TILES[textureName].PORTALS, x, y);
				} else if(tileType === SETTINGS.TILE_IDS.REDPORTAL) {
					drawTile(TILES[textureName].REDPORTALS, x, y);
				} else if(tileType === SETTINGS.TILE_IDS.BLUEPORTAL) {
					drawTile(TILES[textureName].BLUEPORTALS, x, y);
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

function fillStates(ctx, mapJSON, textureName="VANILLA"){
	Object.keys(mapJSON.fields).forEach(key => {
		let position = key.split(",");
		position = {
			x: position[0],
			y: position[1]
		};

		let defaultState = mapJSON.fields[key].defaultState === "on" ? "green" : mapJSON.fields[key].defaultState;
		let gateCoords = SETTINGS.TILE_COORDINATES[defaultState.toUpperCase() + "GATE"];

		if(gateCoords){
			ctx.drawImage(
				TILES[textureName].GENERAL,
				gateCoords.x * SETTINGS.TILE_SIZE, gateCoords.y * SETTINGS.TILE_SIZE,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
				position.x * SETTINGS.TILE_SIZE, position.y * SETTINGS.TILE_SIZE,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
			);
		}
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
				TILES[textureName].PORTALS,
				160, 0,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
				position.x * SETTINGS.TILE_SIZE, position.y * SETTINGS.TILE_SIZE,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
			);
		}
	});

	mapJSON.marsballs.forEach(marsball => {
		ctx.drawImage(
			TILES[textureName].GENERAL,
			480, 360,
			SETTINGS.TILE_SIZE * 2, SETTINGS.TILE_SIZE * 2,
			(marsball.x * SETTINGS.TILE_SIZE) - (SETTINGS.TILE_SIZE / 2),
			(marsball.y * SETTINGS.TILE_SIZE) - (SETTINGS.TILE_SIZE / 2),
			SETTINGS.TILE_SIZE * 2, SETTINGS.TILE_SIZE * 2
		);
	});
}

function drawWall(ctx, x, y, type, neighbors, textureName="VANILLA") {
	if(type === "WALL") type = "FULL";

	for (let i = 0; i < 4; i++) {
		// console.log(SETTINGS.WALL_DRAW_ORDER[i], SETTINGS.WALL_COORDINATES.FULL[i]);
		ctx.drawImage(
			TILES[textureName].GENERAL,
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
				TILES[textureName].GENERAL,
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