const { Jimp } = require('jimp');
const fetch = require('node-fetch');

const MAP_SETTINGS = require('./map_settings');
const SITE_SETTINGS = require('../Settings');

const baseUrl = "https://static.koalabeast.com";
const config = {
	tileSize: MAP_SETTINGS.TILE_SIZE,
	quadSize: MAP_SETTINGS.QUADRANT_SIZE
};

// Mapping for floor/feature tiles (except boosts/portals).
const floorTiles = {
	"d4d4d4": { y: 4, x: 13 },
	"808000": { y: 1, x: 13 },
	"ff0000": { y: 1, x: 14 },
	"0000ff": { y: 1, x: 15 },
	"373737": { y: 0, x: 12 },
	"202020": { y: 0, x: 13 },
	"b90000": { y: 5, x: 14 },
	"190094": { y: 5, x: 15 },
	"dcbaba": { y: 4, x: 14 },
	"bbb8dd": { y: 4, x: 15 },
	"dcdcba": { y: 5, x: 13 },
	"00ff00": { y: 4, x: 12 },
	"b97a57": { y: 6, x: 13 },
	"ff8000": { y: 1, x: 12 },
	"007500_empty": { y: 3, x: 12 },
	"007500_green": { y: 3, x: 13 },
	"007500_red":   { y: 3, x: 14 },
	"007500_blue":  { y: 3, x: 15 },
	"8080ff":       { y: 7, x: 14 },
	"656500":       { y: 6, x: 14 },
};

const wallTypes = MAP_SETTINGS.WALL_TYPES;
const quadrantCoords = MAP_SETTINGS.QUADRANT_COORDS;

const imagesCache = new Map();
const cloneCache = {};
const blackTile = new Jimp({ width: config.tileSize, height: config.tileSize, color: 0x000000ff });

const normalizeTextureName = (name="") => String(name || "").toLowerCase();

const resolveTexturePack = (textureName="") => {
	const normalized = normalizeTextureName(textureName);
	const textures = SITE_SETTINGS.TEXTURES || [];
	const defaultTexture = normalizeTextureName(SITE_SETTINGS.DEFAULT_PREVIEW_TEXTURE_PACK);

	return textures.find(tp => normalizeTextureName(tp.url) === normalized || normalizeTextureName(tp.name) === normalized) ||
		textures.find(tp => normalizeTextureName(tp.url) === defaultTexture) ||
		textures[0];
};

const loadImage = async (url) => {
	const resolvedUrl = url.startsWith("/") ? baseUrl + url : url;
	return Jimp.read(resolvedUrl);
};

const ensureTextureImages = async (textureName) => {
	const pack = resolveTexturePack(textureName);
	if (!pack) throw new Error("No texture packs available for preview generation.");

	if (imagesCache.has(pack.url)) {
		return imagesCache.get(pack.url);
	}

	const images = {
		tile: await loadImage(pack.tiles),
		speedpad: await loadImage(pack.speedpad),
		speedpadRed: await loadImage(pack.speedpadRed),
		speedpadBlue: await loadImage(pack.speedpadBlue),
		portal: await loadImage(pack.portal),
		portalRed: await loadImage(pack.portalRed),
		portalBlue: await loadImage(pack.portalBlue)
	};

	imagesCache.set(pack.url, images);
	return images;
};

const decodeLayoutToImage = async (layout) => {
	if (typeof layout !== "string") throw new Error("Invalid layout data.");

	// Remote URL
	if (layout.includes("://")) return Jimp.read(layout);

	// Base64 PNG data
	try {
		const buffer = Buffer.from(layout, "base64");
		return await Jimp.read(buffer);
	} catch (err) {
		// Fall through to attempting local/path loading
	}

	// Local/path-based
	return Jimp.read(layout);
};

const loadMapLogic = async (logic) => {
	try {
		return JSON.parse(logic);
	} catch (e) {
		// Attempt to fetch from URL if JSON parse fails.
		try {
			const res = await fetch(logic);
			return await res.json();
		} catch (err) {
			return null;
		}
	}
};

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

	drawImage(src, sx, sy, sWidth, sHeight, dx, dy, dWidth=null, dHeight=null, cacheSpace="") {
		const cacheKey = `${cacheSpace}|${sx}|${sy}|${sWidth}|${sHeight}|${dWidth}|${dHeight}`;
		if(!cloneCache[cacheKey]) {
			const clonedSrc = src.clone();
			clonedSrc.crop({ x: sx, y: sy, w: sWidth, h: sHeight});
			if(dWidth !== null && dWidth !== 0 && dHeight !== 0) clonedSrc.resize({ w: dWidth, h: dHeight });
			cloneCache[cacheKey] = clonedSrc;
		}
		this.image.composite(cloneCache[cacheKey], dx, dy);
	}

	toDataURL(type, quality, callback) {
		return callback(null, this.image.getBase64(type, {quality: quality}));
	}
}

function rgbToHex(r, g, b) {
	return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getFloorTile(key, images) {
	if (key === "ffff00") {
		return { image: images.speedpad, cache: 'SP', x: 0, y: 0 };
	} else if (key === "ff7373") {
		return { image: images.speedpadRed, cache: 'SPR', x: 0, y: 0 };
	} else if (key === "7373ff") {
		return { image: images.speedpadBlue, cache: 'SPB', x: 0, y: 0 };
	} else if (key === "cac000") {
		return { image: images.portal, cache: 'PL', x: 0, y: 0 };
	} else if (key === "cc3300") {
		return { image: images.portalRed, cache: 'PLR', x: 0, y: 0 };
	} else if (key === "0066cc") {
		return { image: images.portalBlue, cache: 'PLB', x: 0, y: 0 };
	} else if (floorTiles.hasOwnProperty(key)) {
		return { image: images.tile, cache: 'T', x: floorTiles[key].x, y: floorTiles[key].y };
	} else {
		return null;
	}
}

function wallSolidsAt(wallMap, col, row) {
	if (col < 0 || row < 0 || row >= wallMap.length || col >= wallMap[0].length) return 0;
	return wallMap[row][col];
}

function drawWallTile(canvas, wallMap, col, row, images) {
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
		const coords = quadrantCoords[key] || [5.5, 5.5];
		let destX = col * config.tileSize;
		let destY = row * config.tileSize;
		if (q === 0) destX += config.quadSize;
		else if (q === 1) { destX += config.quadSize; destY += config.quadSize; }
		else if (q === 2) destY += config.quadSize;
		const srcX = coords[0] * 40;
		const srcY = coords[1] * 40;
		canvas.drawImage(
			images.tile,
			srcX,
			srcY,
			config.quadSize,
			config.quadSize,
			destX,
			destY,
			config.quadSize,
			config.quadSize,
			'W'
		);
	}
}

function buildWallMap(image) {
	const width = image.bitmap.width;
	const height = image.bitmap.height;
	const { data } = image.bitmap;
	const wallMap = [];

	for (let y = 0; y < height; y++) {
		wallMap[y] = [];
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;
			const r = data[idx];
			const g = data[idx + 1];
			const b = data[idx + 2];
			const a = data[idx + 3];
			const hex = rgbToHex(r, g, b).toLowerCase();
			wallMap[y][x] = (a === 0) ? 0 : (wallTypes.hasOwnProperty(hex) ? wallTypes[hex].wallSolids : 0);
		}
	}

	return wallMap;
}

function drawDefaultFloor(canvas, defaultFloorTile, width, height) {
	if (!defaultFloorTile) return;
	const sx = defaultFloorTile.x * config.tileSize;
	const sy = defaultFloorTile.y * config.tileSize;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			canvas.drawImage(
				defaultFloorTile.image,
				sx, sy,
				config.tileSize, config.tileSize,
				x * config.tileSize, y * config.tileSize,
				config.tileSize, config.tileSize,
				'F'
			);
		}
	}
}

function drawTiles(canvas, image, mapJSONData, images) {
	const width = image.bitmap.width;
	const height = image.bitmap.height;
	const { data } = image.bitmap;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;
			const r = data[idx];
			const g = data[idx + 1];
			const b = data[idx + 2];
			const a = data[idx + 3];
			if (a === 0) continue;
			const hex = rgbToHex(r, g, b).toLowerCase();
			if (wallTypes.hasOwnProperty(hex)) continue;
			let tileSource = null;
			if (hex === "007500") {
				const fieldKey = `${x},${y}`;
				let state = "empty";
				if (mapJSONData && mapJSONData.fields && mapJSONData.fields[fieldKey]) {
					let ds = mapJSONData.fields[fieldKey].defaultState;
					if (ds === "on") {
						state = "green";
					} else if (ds === "off") {
						state = "empty";
					} else {
						state = ds;
					}
				}
				const tileKey = "007500_" + state;
				tileSource = getFloorTile(tileKey, images);
			} else {
				tileSource = getFloorTile(hex, images);
			}
			if (tileSource) {
				const sx = tileSource.x * config.tileSize;
				const sy = tileSource.y * config.tileSize;
				canvas.drawImage(
					tileSource.image,
					sx, sy,
					config.tileSize, config.tileSize,
					x * config.tileSize, y * config.tileSize,
					config.tileSize, config.tileSize,
					tileSource.cache
				);
			} else {
				canvas.drawImage(
					blackTile,
					0, 0,
					config.tileSize, config.tileSize,
					x * config.tileSize, y * config.tileSize,
					config.tileSize, config.tileSize,
					'B'
				);
			}
		}
	}
}

function drawExitPortals(canvas, mapJSONData, images) {
	if (!mapJSONData || !mapJSONData.portals) return;
	Object.entries(mapJSONData.portals).forEach(([key, portalData]) => {
		if (!portalData.hasOwnProperty("destination")) {
			const [x, y] = key.split(",").map(Number);
			const sx = 4 * config.tileSize;
			const sy = 0 * config.tileSize;
			canvas.drawImage(
				images.portal,
				sx, sy,
				config.tileSize, config.tileSize,
				x * config.tileSize, y * config.tileSize,
				config.tileSize, config.tileSize,
				'P'
			);
		}
	});
}

function drawWalls(canvas, wallMap, images) {
	for (let y = 0; y < wallMap.length; y++) {
		for (let x = 0; x < wallMap[0].length; x++) {
			if (wallMap[y][x] !== 0) {
				drawWallTile(canvas, wallMap, x, y, images);
			}
		}
	}
}

function drawMarsballs(canvas, mapJSONData, images) {
	if (!mapJSONData || !mapJSONData.marsballs) return;
	mapJSONData.marsballs.forEach(mars => {
		const destX = mars.x * config.tileSize - config.tileSize/2;
		const destY = mars.y * config.tileSize - config.tileSize/2;
		canvas.drawImage(
			images.tile,
			12 * config.tileSize, 9 * config.tileSize, 2 * config.tileSize, 2 * config.tileSize,
			destX, destY, 2 * config.tileSize, 2 * config.tileSize,
			'M'
		);
	});
}

const generate = (layout, logic, textureName=SITE_SETTINGS.DEFAULT_PREVIEW_TEXTURE_PACK) => {
	return new Promise(async (resolve, reject) => {
		try {
			const images = await ensureTextureImages(textureName);
			const mapImage = await decodeLayoutToImage(layout);
			if(!mapImage) return reject("Invalid map");

			const mapJSON = await loadMapLogic(logic);
			if(!mapJSON) return reject("Invalid map json");

			const wallMap = buildWallMap(mapImage);
			const canvas = new MapCanvas(
				mapImage.bitmap.width * config.tileSize,
				mapImage.bitmap.height * config.tileSize
			);

			const defaultFloorTile = getFloorTile("d4d4d4", images);
			drawDefaultFloor(canvas, defaultFloorTile, mapImage.bitmap.width, mapImage.bitmap.height);
			drawTiles(canvas, mapImage, mapJSON, images);
			drawExitPortals(canvas, mapJSON, images);
			drawWalls(canvas, wallMap, images);
			drawMarsballs(canvas, mapJSON, images);

			resolve(canvas);
		} catch (err) {
			reject(err);
		}
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

	const thumbnailCanvas = new MapCanvas(0,0);
	thumbnailCanvas.image = previewCanvas.image.clone();
	thumbnailCanvas.image.resize({w: newWidth, h: newHeight});

	return thumbnailCanvas;
};

module.exports = {
	generate,
	generateThumbnail
}
