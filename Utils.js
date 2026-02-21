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

Utils.cleanQuery = text => {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

Utils.isAlphanumeric = text => Boolean(text.match(/^[a-zA-Z0-9_]*$/gi));

Utils.makeAlphanumeric = text => text.replace(/[^a-zA-Z0-9-]/gi, "");

Utils.templateEngineData = async (req) => ({
	SETTINGS: SETTINGS.PACK(),
	profileID: req.profileID,
	profile: req.getProfile ? await req.getProfile() : null
});

// Base 4 (0123) <-> Hex (0-F) conversion helpers
// 2 Base4 digits = 1 Hex digit
// 00=0, 01=1, 02=2, 03=3, 10=4, 11=5, 12=6, 13=7
// 20=8, 21=9, 22=A, 23=B, 30=C, 31=D, 32=E, 33=F
const B4_TO_HEX = {
	'00': '0', '01': '1', '02': '2', '03': '3',
	'10': '4', '11': '5', '12': '6', '13': '7',
	'20': '8', '21': '9', '22': 'A', '23': 'B',
	'30': 'C', '31': 'D', '32': 'E', '33': 'F'
};
const HEX_TO_B4 = {
	'0': '00', '1': '01', '2': '02', '3': '03',
	'4': '10', '5': '11', '6': '12', '7': '13',
	'8': '20', '9': '21', 'A': '22', 'B': '23',
	'C': '30', 'D': '31', 'E': '32', 'F': '33'
};

Utils.base4ToHex = (b4Str) => {
	if (!b4Str) return "";
	// Ensure even length for pairing (pad start with 0 if needed? No, hash parts are fixed length usually)
	// But if odd, maybe just pad start with 0.
	if (b4Str.length % 2 !== 0) b4Str = '0' + b4Str;
	
	let hex = "";
	for (let i = 0; i < b4Str.length; i += 2) {
		const pair = b4Str.substr(i, 2);
		hex += (B4_TO_HEX[pair] || "?");
	}
	return hex;
};

Utils.hexToBase4 = (hexStr) => {
	if (!hexStr) return "";
	let b4 = "";
	for (let char of hexStr.toUpperCase()) {
		b4 += (HEX_TO_B4[char] || "");
	}
	return b4;
};

module.exports = Utils;
