const SETTINGS = require("./Settings");

let Utils = {};

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

Utils.templateEngineData = (req) => {return {
	SETTINGS,
	profileID: req.profileID
}};

module.exports = Utils;