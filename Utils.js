const SETTINGS = require('./Settings');

const { gzip, ungzip } = require('node-gzip');
const { pack, unpack } = require('msgpackr');

let Utils = {};

Utils.Compression = {
	compressMapLayout(mapLayout) {
		try {
			const mapLayoutUncompressedBuffer = Buffer.from(mapLayout, 'base64');
			return gzip(mapLayoutUncompressedBuffer);
		} catch(e) {
			console.error(mapLayout, e);
			return null;
		}
	},

	decompressMapLayout(mapLayoutCompressedBuffer) {
		try {
			return ungzip(mapLayoutCompressedBuffer);
		} catch(e) {
			console.error(mapLayoutCompressedBuffer, e);
			return null;
		}
	},

	compressMapLogic(mapJSON) {
		try {
			const mapLogicPackedBuffer = pack(mapJSON);
			return gzip(mapLogicPackedBuffer);
		} catch(e) {
			console.error(mapJSON, e);
			return null;
		}
	},

	async decompressMapLogic(mapLayoutCompressedBuffer) {
		try {
			const decompressedMapLogic = await ungzip(mapLayoutCompressedBuffer);
			const unpackedMapLogic = unpack(decompressedMapLogic);
			return unpackedMapLogic;
		} catch(e) {
			console.error(mapLayoutCompressedBuffer, e);
			return null;
		}
	}
};

Utils.makeID = (length) => {
	return Math.random().toString(36).substr(2, (length || 7) + 2);
}

Utils.componentToHex = c => {
	let hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

Utils.rgbToHex = (r, g, b) => {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

Utils.tileToHex = tile => {
	return rgbToHex(TILE_COLORS[tile].r, TILE_COLORS[tile].b, TILE_COLORS[tile].g);
}

Utils.hexToRGB = hex => {
	let b = hex >> 16;
	let g = hex >> 8 & 0xFF;
	let r = hex & 0xFF;
	return [r,g,b];
}

Utils.hasCorrectParameters = (body, correctBody) => {
	if(!body || Object.keys(body).length === 0) return false;

	let isCorrect = true;
	Object.keys(body).forEach(key => {
		if(!isCorrect) return;

		if(correctBody[key]) {
			if(typeof correctBody[key] === "object") {
				if(typeof body[key] !== correctBody[key].type || !correctBody[key].func(body[key])) isCorrect = false;
			} else if(typeof body[key] !== correctBody[key]) isCorrect = false;
		} else {
			isCorrect = false;
		}
	});

	return isCorrect;
}

Utils.cleanQueryableText = text => {
	return text.replace(/[#@]/g, "");
};

Utils.isAlphanumeric = text => Boolean(text.match(/^[a-zA-Z0-9_]*$/gi));

Utils.makeAlphanumeric = text => text.replace(/[^a-zA-Z0-9-]/gi, "");

Utils.templateEngineData = async (req) => ({
	SETTINGS: SETTINGS.PACK(),
	profileID: req.profileID,
	profile: req.getProfile ? await req.getProfile() : null
});

module.exports = Utils;
