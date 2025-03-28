// ------------------------------------------------------------------------
// This code was adapted from "Fortunate Maps Texture Preview" by BambiTP
// https://greasyfork.org/en/scripts/527679-fortunate-maps-texture-preview
// ------------------------------------------------------------------------

const baseUrl = "https://static.koalabeast.com";

// ----------------------------
// Configuration & Global Data
// ----------------------------
const config = {
	tileSize: 40,         // Final tile is 40x40px.
	quadSize: 20          // Each wall quadrant is 20x20px.
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
	"8080ff":       { y: 8, x: 14 },
	"8080ff":       { y: 7, x: 14 },
	"656500":       { y: 6, x: 14 },
};

// Texture packs definition using relative paths.
const wallTypes = {
	"787878": { wallSolids: 0xff },
	"804070": { wallSolids: 0x2d },
	"408050": { wallSolids: 0xd2 },
	"405080": { wallSolids: 0x4b },
	"807040": { wallSolids: 0xb4 }
};

const quadrantCoords = {
	"132": [10.5, 7.5],
	"232": [11, 7.5],
	"332": [11, 8],
	"032": [10.5, 8],
	"132d": [0.5, 3.5],
	"232d": [1, 3.5],
	"032d": [0.5, 4],
	"143": [4.5, 9.5],
	"243": [5, 9.5],
	"343": [5, 10],
	"043": [4.5, 10],
	"143d": [1.5, 2.5],
	"243d": [2, 2.5],
	"043d": [1.5, 3],
	"154": [6.5, 9.5],
	"254": [7, 9.5],
	"354": [7, 10],
	"054": [6.5, 10],
	"154d": [9.5, 2.5],
	"254d": [10, 2.5],
	"354d": [10, 3],
	"165": [0.5, 7.5],
	"265": [1, 7.5],
	"365": [1, 8],
	"065": [0.5, 8],
	"165d": [10.5, 3.5],
	"265d": [11, 3.5],
	"365d": [11, 4],
	"176": [1.5, 6.5],
	"276": [2, 6.5],
	"376": [2, 7],
	"076": [1.5, 7],
	"276d": [9, 1.5],
	"376d": [9, 2],
	"076d": [8.5, 2],
	"107": [6.5, 8.5],
	"207": [7, 8.5],
	"307": [7, 9],
	"007": [6.5, 9],
	"207d": [11, 1.5],
	"307d": [11, 2],
	"007d": [10.5, 2],
	"110": [4.5, 8.5],
	"210": [5, 8.5],
	"310": [5, 9],
	"010": [4.5, 9],
	"110d": [0.5, 1.5],
	"310d": [1, 2],
	"010d": [0.5, 2],
	"121": [9.5, 6.5],
	"221": [10, 6.5],
	"321": [10, 7],
	"021": [9.5, 7],
	"121d": [2.5, 1.5],
	"321d": [3, 2],
	"021d": [2.5, 2],
	"142": [1.5, 7.5],
	"242": [2, 7.5],
	"042": [1.5, 8],
	"142d": [10.5, 0.5],
	"242d": [11, 0.5],
	"042d": [10.5, 1],
	"153": [5.5, 6.5],
	"253": [6, 6.5],
	"353": [6, 7],
	"053": [5.5, 7],
	"153d": [5.5, 0.5],
	"253d": [6, 0.5],
	"164": [9.5, 7.5],
	"264": [10, 7.5],
	"364": [10, 8],
	"164d": [0.5, 0.5],
	"264d": [1, 0.5],
	"364d": [1, 1],
	"175": [4.5, 5.5],
	"275": [5, 5.5],
	"375": [5, 6],
	"075": [4.5, 6],
	"275d": [7, 1.5],
	"375d": [7, 2],
	"206": [4.5, 9.5],
	"306": [4.5, 10],
	"006": [3.5, 10],
	"206d": [2, 3.5],
	"306d": [2, 4],
	"006d": [1.5, 4],
	"117": [5.5, 2.5],
	"217": [6, 2.5],
	"317": [6, 4],
	"017": [5.5, 4],
	"317d": [6, 3],
	"017d": [5.5, 3],
	"120": [7.5, 9.5],
	"320": [8, 10],
	"020": [7.5, 10],
	"120d": [9.5, 3.5],
	"320d": [10, 4],
	"020d": [9.5, 4],
	"131": [6.5, 5.5],
	"231": [7, 5.5],
	"331": [7, 6],
	"031": [6.5, 6],
	"131d": [4.5, 1.5],
	"031d": [4.5, 2],
	"141": [7.5, 8.5],
	"241": [8, 8.5],
	"323": [4, 5],
	"041": [7.5, 9],
	"141d": [8.5, 3.5],
	"041d": [8.5, 4],
	"152": [8.5, 7.5],
	"252": [9, 7.5],
	"334": [2, 0],
	"052": [8.5, 8],
	"152d": [3.5, 0.5],
	"252d": [4, 0.5],
	"163": [2, 7.5],
	"263": [3, 7.5],
	"363": [3, 8],
	"045": [9.5, 0],
	"163d": [7.5, 0.5],
	"263d": [8, 0.5],
	"174": [3.5, 8.5],
	"274": [4, 8.5],
	"374": [4, 9],
	"056": [7.5, 5],
	"274d": [3, 3.5],
	"374d": [3, 4],
	"167": [7.5, 6.5],
	"205": [10, 8.5],
	"305": [10, 9],
	"005": [9.5, 9],
	"205d": [2, 0.5],
	"305d": [2, 1],
	"170": [6.5, 7.5],
	"216": [9, 9.5],
	"316": [9, 10],
	"016": [8.5, 10],
	"316d": [10, 5],
	"016d": [9.5, 5],
	"127": [2.5, 9.5],
	"201": [5, 7.5],
	"327": [3, 10],
	"027": [2.5, 10],
	"327d": [2, 5],
	"027d": [1.5, 5],
	"130": [1.5, 8.5],
	"212": [4, 6.5],
	"330": [2, 9],
	"030": [1.5, 9],
	"130d": [9.5, 0.5],
	"030d": [9.5, 1],
	"151": [10.5, 9.5],
	"251": [11, 9.5],
	"324": [0, 7],
	"051": [10.5, 10],
	"151d": [10.5, 4.5],
	"324d": [0, 0],
	"162": [8.5, 10.5],
	"262": [9, 10.5],
	"335": [6, 8],
	"035": [5.5, 8],
	"162d": [3.5, 2.5],
	"262d": [8, 2.5],
	"173": [0.5, 9.5],
	"273": [1, 9.5],
	"373": [1, 10],
	"046": [11.5, 7],
	"046d": [11.5, 0],
	"273d": [1, 4.5],
	"157": [11.5, 8.5],
	"204": [0, 5.5],
	"304": [0, 5],
	"057": [11.5, 9],
	"204d": [0, 4.5],
	"304d": [0, 6],
	"160": [11.5, 7.5],
	"215": [8, 6.5],
	"315": [8, 7],
	"015": [7.5, 7],
	"160d": [2.5, 4.5],
	"315d": [9, 3],
	"171": [5.5, 10.5],
	"271": [6, 10.5],
	"326": [6, 5],
	"026": [5.5, 5],
	"326d": [7, 5],
	"026d": [4.5, 5],
	"137": [3.5, 6.5],
	"202": [0, 7.5],
	"337": [4, 7],
	"037": [3.5, 7],
	"202d": [9, 4.5],
	"037d": [2.5, 3],
	"140": [11.5, 5.5],
	"213": [0, 8.5],
	"313": [0, 9],
	"040": [11.5, 5],
	"140d": [11.5, 4.5],
	"040d": [11.5, 6],
	"161": [9.5, 10.5],
	"261": [10, 10.5],
	"325": [9, 6],
	"025": [8.5, 6],
	"161d": [3.5, 1.5],
	"325d": [4, 1],
	"172": [1.5, 10.5],
	"272": [2, 10.5],
	"336": [3, 6],
	"036": [2.5, 6],
	"036d": [7.5, 1],
	"272d": [8, 1.5],
	"147": [4.5, 7.5],
	"203": [4, 3.5],
	"303": [4, 4],
	"047": [4.5, 8],
	"047d": [8.5, 5],
	"203d": [8, 4.5],
	"150": [7.5, 3.5],
	"214": [7, 7.5],
	"314": [7, 8],
	"050": [7.5, 4],
	"150d": [3.5, 4.5],
	"314d": [3, 5],
	"100": [5.5, 5.5],
	"200": [6, 5.5],
	"300": [6, 6],
	"000": [5.5, 6],
	"100d": [5.5, 8.5],
	"200d": [6, 8.5],
	"300d": [6, 10],
	"000d": [5.5, 10]
};

// ----------------------------
// Global Image Variables
// ----------------------------
let images = {
	tile: null,
	speedpad: null,
	speedpadRed: null,
	speedpadBlue: null,
	portal: null,
	portalRed: null,
	portalBlue: null
};

let imagesLoaded = false;

// ----------------------------
// JSON Gate Data Explanation
// ----------------------------
// (See description above)
// ----------------------------
// Set currentTexturePack from localStorage if available.
let currentTexturePack = window.SETTINGS.TEXTURES[2];
const LOCAL_SETTINGS = JSON.parse(localStorage.getItem("localSettings") || "{}");
const savedTexture = LOCAL_SETTINGS.texturePack || null;

if (savedTexture) {
	const found = window.SETTINGS.TEXTURES.find(tp => tp.url === savedTexture);
	if (found) {
		currentTexturePack = found;
		// console.log("[FM] Loaded saved texture pack:", currentTexturePack.name);
	}
}

// ----------------------------
// Utility: waitForElement
// ----------------------------
function waitForElement(selector, callback, timeout = 10000) {
	const start = Date.now();
	(function check() {
		const el = document.querySelector(selector);
		if (el) {
			// console.log(`[FM] Found element for selector "${selector}"`);
			callback(el);
		} else if (Date.now() - start > timeout) {
			console.warn(`[FM] Timeout waiting for element: ${selector}`);
		} else {
			setTimeout(check, 200);
		}
	})();
}

function waitUntil(func, ms) {
	return new Promise((resolve) => {
		const interval = setInterval(() => {
			if (func()) {
				clearInterval(interval);
				resolve();
			}
		}, ms);
	});
}

// ----------------------------
// Utility Functions
// ----------------------------
function rgbToHex(r, g, b) {
	return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// loadImage prepends baseUrl if needed.
function loadImage(url) {
	if (url.startsWith("/")) {
		url = baseUrl + url;
	}
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			// console.log(`[FM] Loaded image: ${url}`);
			resolve(img);
		};
		img.onerror = (e) => {
			console.error(`[FM] Error loading image: ${url}`, e);
			reject(e);
		};
		img.src = url;
	});
}

(async() => {
	try {
		images.tile = await loadImage(currentTexturePack.tiles);
		images.speedpad = await loadImage(currentTexturePack.speedpad);
		images.speedpadRed = await loadImage(currentTexturePack.speedpadRed);
		images.speedpadBlue = await loadImage(currentTexturePack.speedpadBlue);
		images.portal = await loadImage(currentTexturePack.portal);
		images.portalRed = await loadImage(currentTexturePack.portalRed);
		images.portalBlue = await loadImage(currentTexturePack.portalBlue);

		imagesLoaded = true;
	} catch(e) {
		console.error("[FM] Error loading texture images", e);
		return;
	}
})();

function getFloorTile(key) {
	if (key === "ffff00") {
		return { image: images.speedpad, y: 0, x: 0 };
	} else if (key === "ff7373") {
		return { image: images.speedpadRed, y: 0, x: 0 };
	} else if (key === "7373ff") {
		return { image: images.speedpadBlue, y: 0, x: 0 };
	} else if (key === "cac000") {
		return { image: images.portal, x: 0, y: 0 };
	} else if (key === "cc3300") {
		return { image: images.portalRed, x: 0, y: 0 };
	} else if (key === "0066cc") {
		return { image: images.portalBlue, x: 0, y: 0 };
	} else if (floorTiles.hasOwnProperty(key)) {
		return { image: images.tile, x: floorTiles[key].x, y: floorTiles[key].y };
	} else {
		return null;
	}
}

function wallSolidsAt(wallMap, col, row) {
	if (col < 0 || row < 0 || row >= wallMap.length || col >= wallMap[0].length) return 0;
	return wallMap[row][col];
}

function drawWallTile(ctx, wallMap, col, row) {
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
		ctx.drawImage(images.tile, srcX, srcY, config.quadSize, config.quadSize,
					  destX, destY, config.quadSize, config.quadSize);
	}
}

window.GENERATE_MAP_PREVIEW = async function(originalPNGImage, mapJSONData) {
	if (!originalPNGImage) return;
	
	await waitUntil(() => imagesLoaded);

	// console.log("[FM] Starting map processing...");
	// console.log("[FM] All texture images loaded");

	const offCanvas = document.createElement('canvas');
	offCanvas.width = originalPNGImage.width;
	offCanvas.height = originalPNGImage.height;
	const offCtx = offCanvas.getContext('2d');
	offCtx.drawImage(originalPNGImage, 0, 0);
	// console.log("[FM] Offscreen canvas drawn");
	const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
	const data = imageData.data;

	let wallMap = [];
	for (let y = 0; y < offCanvas.height; y++) {
		wallMap[y] = [];
		for (let x = 0; x < offCanvas.width; x++) {
			const idx = (y * offCanvas.width + x) * 4;
			const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
			const hex = rgbToHex(r, g, b).toLowerCase();
			wallMap[y][x] = (a === 0) ? 0 : (wallTypes.hasOwnProperty(hex) ? wallTypes[hex].wallSolids : 0);
		}
	}
	// console.log("[FM] wallMap built:", wallMap);

	const finalCanvas = document.createElement('canvas');
	finalCanvas.width = offCanvas.width * config.tileSize;
	finalCanvas.height = offCanvas.height * config.tileSize;
	const finalCtx = finalCanvas.getContext('2d');
	finalCtx.imageSmoothingEnabled = false;
	// console.log("[FM] Final canvas created");

	const defaultFloorTile = getFloorTile("d4d4d4");
	if (defaultFloorTile) {
		const sx = defaultFloorTile.x * config.tileSize;
		const sy = defaultFloorTile.y * config.tileSize;
		for (let y = 0; y < offCanvas.height; y++) {
			for (let x = 0; x < offCanvas.width; x++) {
				finalCtx.drawImage(defaultFloorTile.image, sx, sy, config.tileSize, config.tileSize,
								   x * config.tileSize, y * config.tileSize, config.tileSize, config.tileSize);
			}
		}
	}

	for (let y = 0; y < offCanvas.height; y++) {
		for (let x = 0; x < offCanvas.width; x++) {
			const idx = (y * offCanvas.width + x) * 4;
			const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
			if (a === 0) continue;
			const hex = rgbToHex(r, g, b).toLowerCase();
			if (wallTypes.hasOwnProperty(hex)) continue;
			let tileSource = null;
			if (hex === "007500") {
				const fieldKey = `${x},${y}`;
				let state = "empty"; // Default state remains "empty"
				if (mapJSONData && mapJSONData.fields && mapJSONData.fields[fieldKey]) {
					let ds = mapJSONData.fields[fieldKey].defaultState;
					if (ds === "on") {
						state = "green";
					} else if (ds === "off") {
						state = "empty"; // Change "off" to "empty"
					} else {
						state = ds;
					}
				}

				const tileKey = "007500_" + state;
				tileSource = getFloorTile(tileKey);
			} else {
				tileSource = getFloorTile(hex);
			}
			if (tileSource) {
				const sx = tileSource.x * config.tileSize;
				const sy = tileSource.y * config.tileSize;
				finalCtx.drawImage(tileSource.image, sx, sy, config.tileSize, config.tileSize,
								   x * config.tileSize, y * config.tileSize, config.tileSize, config.tileSize);
			} else {
				finalCtx.fillStyle = "#000000";
				finalCtx.fillRect(x * config.tileSize, y * config.tileSize, config.tileSize, config.tileSize);
			}
		}
	}
	// console.log("[FM] Floor and gate tiles drawn");

	if (mapJSONData && mapJSONData.portals) {
		Object.entries(mapJSONData.portals).forEach(([key, portalData]) => {
			if (!portalData.hasOwnProperty("destination")) {
				const [x, y] = key.split(",").map(Number);
				const sx = 4 * config.tileSize; // source x: tile column 4
				const sy = 0 * config.tileSize; // source y: tile row 0
				finalCtx.drawImage(images.portal, sx, sy, config.tileSize, config.tileSize,
					x * config.tileSize, y * config.tileSize, config.tileSize, config.tileSize);
				console.log(`[FM] Exit portal drawn at ${x},${y}`);
			}
		});
	}

	for (let y = 0; y < wallMap.length; y++) {
		for (let x = 0; x < wallMap[0].length; x++) {
			if (wallMap[y][x] !== 0) {
				drawWallTile(finalCtx, wallMap, x, y);
			}
		}
	}
	// console.log("[FM] Wall tiles overlaid");

	// Marsball rendering:
	// For each marsball in the JSON, draw an 80x80 image from the tiles texture (source: 12*40, 9*40)
	// Now centered over the tile instead of having its top-left corner at the tile's top-left.
	if (mapJSONData && mapJSONData.marsballs) {
		mapJSONData.marsballs.forEach(mars => {
			// Calculate destination so the marsball is centered over the tile.
			const destX = mars.x * config.tileSize - config.tileSize/2;
			const destY = mars.y * config.tileSize - config.tileSize/2;
			finalCtx.drawImage(
				images.tile,
				12 * config.tileSize, 9 * config.tileSize, 2 * config.tileSize, 2 * config.tileSize,
				destX, destY, 2 * config.tileSize, 2 * config.tileSize
			);
		});
		// console.log("[FM] Marsballs drawn");
	}

	return finalCanvas;
}
