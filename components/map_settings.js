const SETTINGS = {
	TILE_SIZE: 40
};

SETTINGS.QUADRANT_SIZE = SETTINGS.TILE_SIZE / 2;

SETTINGS.TILE_IDS = {
	FLOOR: 0,
	WALL: 1,
	BACKGROUND: 2,
	REDFLAG: 3,
	BLUEFLAG: 4,
	BOMB: 5,
	SPIKE: 6,
	POWERUP: 7,
	BOOST: 8,
	GATE: 9,
	BUTTON: 10,
	REDBOOST: 11,
	BLUEBOOST: 12,
	REDTEAMTILE: 13,
	BLUETEAMTILE: 14,
	YELLOWTEAMTILE: 15,
	TLWALL: 16,
	TRWALL: 17,
	BLWALL: 18,
	BRWALL: 19,
	PORTAL: 20,
	REDENDZONE: 21,
	BLUEENDZONE: 22,
	GRAVITYWELL: 23,
	YELLOWFLAG: 24
};

SETTINGS.IS_WALL = id => [
	SETTINGS.TILE_IDS.WALL,
	SETTINGS.TILE_IDS.TLWALL,
	SETTINGS.TILE_IDS.TRWALL,
	SETTINGS.TILE_IDS.BLWALL,
	SETTINGS.TILE_IDS.BRWALL
].includes(id);

SETTINGS.TILE_NAMES = Object.keys(SETTINGS.TILE_IDS).reduce((acc, val) => {
	acc[Number(SETTINGS.TILE_IDS[val])] = val;

	return acc;
}, []);

// console.log(SETTINGS.TILE_NAMES);

SETTINGS.TILE_COLORS = [
	{ red: 212, green: 212, blue: 212, alpha: 255 }, // Floor
	{ red: 120, green: 120, blue: 120, alpha: 255 }, // Wall
	{ red: 0, green: 0, blue: 0, alpha: 255 }, // Background
	{ red: 255, green: 0, blue: 0, alpha: 255 }, // Red Flag
	{ red: 0, green: 0, blue: 255, alpha: 255 }, // Blue Flag
	{ red: 255, green: 128, blue: 0, alpha: 255 }, // Bomb
	{ red: 55, green: 55, blue: 55, alpha: 255 }, // Spike
	{ red: 0, green: 255, blue: 0, alpha: 255 }, // Powerup
	{ red: 255, green: 255, blue: 0, alpha: 255 }, // Boost
	{ red: 0, green: 117, blue: 0, alpha: 255 }, // Gate
	{ red: 185, green: 122, blue: 87, alpha: 255 }, // Button
	{ red: 255, green: 115, blue: 115, alpha: 255 }, // Red Boost
	{ red: 115, green: 115, blue: 255, alpha: 255 }, // Blue Boost
	{ red: 220, green: 186, blue: 186, alpha: 255 }, // Red Team Tile
	{ red: 187, green: 184, blue: 221, alpha: 255 }, // Blue Team Tile
	{ red: 220, green: 220, blue: 186, alpha: 255 }, // Yellow Team Tile
	{ red: 64, green: 128, blue: 80, alpha: 255 }, // Top Left 45 Wall
	{ red: 64, green: 80, blue: 128, alpha: 255 }, // Top Right 45 Wall
	{ red: 128, green: 112, blue: 64, alpha: 255 }, // Bottom Left 45 Wall
	{ red: 128, green: 64, blue: 112, alpha: 255 }, // Bottom Right 45 Wall,
	{ red: 202, green: 192, blue: 0, alpha: 255}, // Portal
	{ red: 185, green: 0, blue: 0, alpha: 255}, // Red Endzone
	{ red: 25, green: 0, blue: 148, alpha: 255}, // Blue Endzone
	{ red: 32, green: 32, blue: 32, alpha: 255}, // Gravity Well
	{ red: 128, green: 128, blue: 0, alpha: 255}, // Yellow Flag
];

SETTINGS.TILE_COORDINATES = {
	FLOOR: {x: 13, y: 4},
	REDFLAG: {x: 14, y: 1},
	BLUEFLAG: {x: 15, y: 1},
	BOMB: {x: 12, y: 1},
	SPIKE: {x: 12, y: 0},
	POWERUP: {x: 12, y: 7},
	GATE: {x: 12, y: 3},
	GREENGATE: {x: 13, y: 3},
	REDGATE: {x: 14, y: 3},
	BLUEGATE: {x: 15, y: 3},
	BUTTON: {x: 13, y: 6},
	REDTEAMTILE: {x: 14, y: 4},
	BLUETEAMTILE: {x: 15, y: 4},
	YELLOWTEAMTILE: {x: 13, y: 5},
	REDENDZONE: {x: 14, y: 5},
	BLUEENDZONE: {x: 15, y: 5},
	GRAVITYWELL: {x: 13, y: 0},
	YELLOWFLAG: {x: 13, y: 1},
};

SETTINGS.WALL_DRAW_ORDER = [[0, 0], [SETTINGS.QUADRANT_SIZE, 0], [0, SETTINGS.QUADRANT_SIZE], [SETTINGS.QUADRANT_SIZE, SETTINGS.QUADRANT_SIZE]];

// [top_left, top_right, bottom_left, bottom_right]
SETTINGS.WALL_COORDINATES = {
	FULL: [[0, 280], [460, 280], [0, 300], [460, 300]],
	TLWALL: [[0, 0], [100, 200], [0, 260], [60, 0]],
	TRWALL: [[360, 200], [460, 0], [60, 0], [460, 260]],
	BLWALL: [[80, 0], [60, 0], [360, 180], [300, 260]],
	BRWALL: [[60, 0], [380, 0], [280, 20], [100, 180]]
}

SETTINGS.WALL_CONNECTION_POSITIONS = {
	UP: [0, 0],
	DOWN: [0, 35],
	LEFT: [0, 0],
	RIGHT: [35, 0]
}

// 40x5 Tile Crops that get placed inbetween tiles.
SETTINGS.WALL_CONNECTIONS = {
	FULL: {
		LEFT: [440, 280, 5, 40],
		RIGHT: [35, 280, 5, 40],
		UP: [0, 200, 40, 5],
		DOWN: [0, 230, 40, 5]
	},
	TLWALL: {
		LEFT: [400, 240, 5, 40],
		RIGHT: [0, 0, 0, 0],
		UP: [120, 200, 40, 5],
		DOWN: [0, 0, 0, 0]
	},
	TRWALL: {
		LEFT: [0, 0, 0, 0],
		RIGHT: [75, 240, 5, 40],
		UP: [320, 200, 40, 5],
		DOWN: [0, 0, 0, 0]
	},
	BLWALL: {
		LEFT: [280, 240, 5, 40],
		RIGHT: [0, 0, 0, 0],
		UP: [0, 0, 0, 0],
		DOWN: [440, 74, 40, 5]
	},
	BRWALL: {
		LEFT: [0, 0, 0, 0],
		RIGHT: [195, 240, 5, 40],
		UP: [0, 0, 0, 0],
		DOWN: [0, 75, 40, 5]
	},
}

module.exports = SETTINGS;