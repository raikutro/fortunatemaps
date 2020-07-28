let Utils = {};

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

module.exports = Utils;