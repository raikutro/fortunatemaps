const { Jimp } = require('jimp');
const PNGImage = require('pngjs-image');
const ndFill = require('ndarray-fill');
const zeros = require('zeros');
const fetch = require('node-fetch');

const Utils = require('../Utils');
const SETTINGS = require('./map_settings');
const fs = require('fs');

const TEXTURES = ["VANILLA"];

let TILES = {};

let assetsLoaded = false;

const loadImage = (path) => Jimp.read(path);

(async () => {
	let promises = TEXTURES.map(name => {
		return new Promise(async (resolve, reject) => {
			TILES[name] = {};
			TILES[name].GENERAL = await loadImage(`${__dirname}/../assets/textures/${name.toLowerCase()}/tiles.png`);
			TILES[name].PORTALS = await loadImage(`${__dirname}/../assets/textures/${name.toLowerCase()}/portal.png`);
			TILES[name].BOOSTS = await loadImage(`${__dirname}/../assets/textures/${name.toLowerCase()}/speedpad.png`);
			TILES[name].REDBOOSTS = await loadImage(`${__dirname}/../assets/textures/${name.toLowerCase()}/speedpadred.png`);
			TILES[name].BLUEBOOSTS = await loadImage(`${__dirname}/../assets/textures/${name.toLowerCase()}/speedpadblue.png`);
			TILES[name].REDPORTALS = await loadImage(`${__dirname}/../assets/textures/${name.toLowerCase()}/portalred.png`);
			TILES[name].BLUEPORTALS = await loadImage(`${__dirname}/../assets/textures/${name.toLowerCase()}/portalblue.png`);

			resolve();
		});
	});

	Promise.all(promises).then(() => {
		assetsLoaded = true;
	});
})();


class MapCanvas {
	constructor(width, height) {
		this.image = new Jimp({ width: width, height: height, color: 0x0 });
	}

	get width() {
		return this.image.width;
	}

	get height() {
		return this.image.height;
	}

	drawImage(src, sx, sy, sWidth, sHeight, dx, dy, dWidth=null, dHeight=null) {
		// console.log(src);
		let clonedSrc = src.clone();
		clonedSrc.crop({ x: sx, y: sy, w: sWidth, h: sHeight});
		if(dWidth !== null) clonedSrc.resize({ w: dWidth, h: dHeight });

		// this.image.blit({ src: clonedSrc, x: dx, y: dy });
		this.image.composite(clonedSrc, dx, dy);
	}

	toDataURL(type, quality, callback) {
		return callback(null, this.image.getBase64(type, {quality: quality}));
	}
}

function rgbToHex(r, g, b) {
	return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const generate = (layout, logic, textureName="VANILLA") => {
	return new Promise(async (resolve, reject) => {
		await waitForLoadedAssets();

		let pngLink;
		let tempURL = null;

		if(!TEXTURES.includes(textureName)) textureName = "VANILLA";

		if(layout.includes("://")) {
			pngLink = layout;
		} else {
			pngLink = await new Promise((resolve, reject) => {
				tempURL = `./temp/temp${String(Math.random()).slice(2)}.png`;
				fs.writeFile(tempURL, layout, 'base64', (err) => {
					if(err) return reject(err);

					resolve(tempURL);
				});
			});
		}

		let [map, mapImage] = await mapURLToArray(pngLink).catch(err => null);
		if(!map) return reject("Invalid map");

		let mapJSON;

		if(tempURL !== null) {
			let deletedFile = await new Promise((resolve, reject) => {
				fs.unlink(tempURL, err => {
					if(err) return reject(err);

					resolve(true);
				});
			}).catch(err => {
				return null;
			});
		}

		try {
			mapJSON = JSON.parse(logic);
		} catch(e) {
			mapJSON = await mapURLToJSON(logic).catch(err => null);
		}

		if(!mapJSON) return reject('Invalid map json');

		const canvas = new MapCanvas(
			(map.shape[0] * SETTINGS.TILE_SIZE) || SETTINGS.TILE_SIZE,
			(map.shape[1] * SETTINGS.TILE_SIZE) || SETTINGS.TILE_SIZE
		);
		const drawTile = (tile, x, y) => {
			canvas.drawImage(
				tile,
				0, 0,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
				x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
			);
		};

		const wallMap = [];
		for (let y = 0; y < map.shape[1]; y++) {
			wallMap[y] = [];
			for (let x = 0; x < map.shape[0]; x++) {
				const hex = mapImage.getColor(x, y).toString(16).padEnd('0', 6).slice(0, 6);
				wallMap[y][x] = (SETTINGS.WALL_TYPES.hasOwnProperty(hex) ? SETTINGS.WALL_TYPES[hex].wallSolids : 0);
			}
		}

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
					canvas.drawImage(
						TILES[textureName].GENERAL,
						SETTINGS.TILE_COORDINATES.FLOOR.x * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_COORDINATES.FLOOR.y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
						x * SETTINGS.TILE_SIZE, y * SETTINGS.TILE_SIZE,
						SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
					);
				}

				if(SETTINGS.IS_WALL(tileType)) {
					drawWallTile(canvas, wallMap, x, y, textureName);
				} else if(SETTINGS.TILE_COORDINATES[SETTINGS.TILE_NAMES[tileType]]) {
					canvas.drawImage(
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

		fillStates(canvas, mapJSON);

		resolve(canvas);
	});
};

const generateThumbnail = async (previewCanvas, { thumbnailSize=400 }={}) => {
	let newWidth;
	let newHeight;
	if(previewCanvas.width < previewCanvas.height) {
		let ratio = previewCanvas.width / previewCanvas.height;
		newWidth = thumbnailSize * ratio;
		newHeight = thumbnailSize;
	} else {
		let ratio = previewCanvas.height / previewCanvas.width;
		newWidth = thumbnailSize;
		newHeight = thumbnailSize * ratio;
	}

	newWidth = Math.floor(newWidth);
	newHeight = Math.floor(newHeight);

	// Create the thumbnail canvas
	const thumbnailCanvas = new MapCanvas(0,0);
	thumbnailCanvas.image = previewCanvas.image.clone();
	thumbnailCanvas.image.resize({w: newWidth, h: newHeight});

	return thumbnailCanvas;
};

function mapURLToArray(mapURL){
	return new Promise((resolve, reject) => {
		let mapPNGLink = mapURL;
		PNGImage.readImage(mapPNGLink, (err, image) => {
			if(err) return reject(err);

			let array = mapImageToArray(image);

			if(!array) return reject("Couldn't resolve map data.");

			resolve([array, image]);
		});
	});
}

function mapURLToJSON(mapURL){
	return new Promise((resolve, reject) => {
		let mapJSONLink = mapURL;
		fetch(mapJSONLink).then(a => a.json()).then(resolve).catch(reject);
	})
}

function mapImageToArray(image) {
	if(!image) return false;
	let width = image.getWidth();
	let height = image.getHeight();

	let shape = [width, height].map(n => Math.max(Math.min(256, n), 1));

	let buffer = zeros(shape, "array");

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let tileType = SETTINGS.TILE_COLORS.findIndex(a => {
				let tileRGB = Utils.hexToRGB(image.getColor(x, y));
				return a.red === tileRGB[0] && a.green === tileRGB[1] && a.blue === tileRGB[2];
			});
			if(tileType === -1) {
				tileType = SETTINGS.TILE_IDS.BACKGROUND;
			}

			buffer.set(x, y, tileType);
		}
	}

	return buffer;
}

function fillStates(canvas, mapJSON, textureName="VANILLA"){
	if(mapJSON.fields) Object.keys(mapJSON.fields).forEach(key => {
		let position = key.split(",");
		position = {
			x: position[0],
			y: position[1]
		};

		let defaultState = mapJSON.fields[key].defaultState === "on" ? "green" : mapJSON.fields[key].defaultState;
		let gateCoords = SETTINGS.TILE_COORDINATES[defaultState.toUpperCase() + "GATE"];

		if(gateCoords){
			canvas.drawImage(
				TILES[textureName].GENERAL,
				gateCoords.x * SETTINGS.TILE_SIZE, gateCoords.y * SETTINGS.TILE_SIZE,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
				position.x * SETTINGS.TILE_SIZE, position.y * SETTINGS.TILE_SIZE,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
			);
		}
	});

	if(mapJSON.portals) Object.keys(mapJSON.portals).forEach(key => {
		let position = key.split(",");
		position = {
			x: position[0],
			y: position[1]
		};

		// draw deactivated portal on portals with no destination
		if(!mapJSON.portals[key].destination) {
			canvas.drawImage(
				TILES[textureName].PORTALS,
				160, 0,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE,
				position.x * SETTINGS.TILE_SIZE, position.y * SETTINGS.TILE_SIZE,
				SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE
			);
		}
	});

	if(Array.isArray(mapJSON.marsballs)) mapJSON.marsballs.forEach(marsball => {
		canvas.drawImage(
			TILES[textureName].GENERAL,
			480, 360,
			SETTINGS.TILE_SIZE * 2, SETTINGS.TILE_SIZE * 2,
			(marsball.x * SETTINGS.TILE_SIZE) - (SETTINGS.TILE_SIZE / 2),
			(marsball.y * SETTINGS.TILE_SIZE) - (SETTINGS.TILE_SIZE / 2),
			SETTINGS.TILE_SIZE * 2, SETTINGS.TILE_SIZE * 2
		);
	});
}

function wallSolidsAt(wallMap, col, row) {
	if (col < 0 || row < 0 || row >= wallMap.length || col >= wallMap[0].length) return 0;
	return wallMap[row][col];
}

function drawWallTile(canvas, wallMap, col, row, textureName="VANILLA") {
	const solids = wallMap[row][col];
	if (!solids) return;
	for (let q = 0; q < 4; q++) {
		const mask = (solids >> (q << 1)) & 3;
		if (mask === 0) continue;
		const cornerX = col + ((q & 2) === 0 ? 1 : 0);
		const cornerY = row + (((q + 1) & 2) === 0 ? 0 : 1);
		let aroundCorner =
			(wallSolidsAt(wallMap, cornerX, cornerY) & 0xc0) |
			(wallSolidsAt(wallMap, cornerX - 1, cornerY) & 0x03) |
			(wallSolidsAt(wallMap, cornerX - 1, cornerY - 1) & 0x0c) |
			(wallSolidsAt(wallMap, cornerX, cornerY - 1) & 0x30);
		aroundCorner |= (aroundCorner << 8);
		const startDirection = q * 2 + 1;
		let cwSteps = 0;
		while (cwSteps < 8 && (aroundCorner & (1 << (startDirection + cwSteps)))) { cwSteps++; }
		let ccwSteps = 0;
		while (ccwSteps < 8 && (aroundCorner & (1 << (startDirection + 7 - ccwSteps)))) { ccwSteps++; }
		const hasChip = (mask === 3 && (((solids | (solids << 8)) >> ((q + 2) << 1)) & 3) === 0);
		let solidStart, solidEnd;
		if (cwSteps === 8) {
			solidStart = solidEnd = 0;
		} else {
			solidEnd = (startDirection + cwSteps + 4) % 8;
			solidStart = (startDirection - ccwSteps + 12) % 8;
		}
		const key = `${q}${solidStart}${solidEnd}${hasChip ? "d" : ""}`;
		const coords = SETTINGS.QUADRANT_COORDS[key] || [5.5, 5.5];
		let destX = col * SETTINGS.TILE_SIZE;
		let destY = row * SETTINGS.TILE_SIZE;
		if (q === 0) destX += SETTINGS.QUADRANT_SIZE;
		else if (q === 1) { destX += SETTINGS.QUADRANT_SIZE; destY += SETTINGS.QUADRANT_SIZE; }
		else if (q === 2) destY += SETTINGS.QUADRANT_SIZE;
		const srcX = coords[0] * 40;
		const srcY = coords[1] * 40;
		canvas.drawImage(TILES[textureName].GENERAL, srcX, srcY, SETTINGS.QUADRANT_SIZE, SETTINGS.QUADRANT_SIZE,
					  destX, destY, SETTINGS.QUADRANT_SIZE, SETTINGS.QUADRANT_SIZE);
	}
}

function drawWall(canvas, x, y, type, neighbors, textureName="VANILLA") {
	if(type === "WALL") type = "FULL";

	for (let i = 0; i < 4; i++) {
		// console.log(SETTINGS.WALL_DRAW_ORDER[i], SETTINGS.WALL_COORDINATES.FULL[i]);
		canvas.drawImage(
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
			canvas.drawImage(
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

module.exports = {
	generate,
	generateThumbnail
}