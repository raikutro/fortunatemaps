const DEV_MODE = !process.env.PORT;

const SETTINGS = {
	NGROK_URL: process.env.NGROK_URL,
	CTF_AUTH_URL: "https://ctfauth.herokuapp.com/api/v2",
	DEV_MODE: DEV_MODE,
	MAPS: {
		PREVIEW_QUALITY: 0.7,
		THUMBNAIL_SIZE: 400
	},
	SITE: {
		MAPS_PER_PAGE: 20,
		LOGIN_EXPIRATION_TIME_LIMIT: 100 * 24 * 3600000,
		COOKIE_TOKEN_NAME: "nekotizer",
		MAP_NAME_LENGTH: 150,
		AUTHOR_LENGTH: 150,
		TAG_NAME_LENGTH: 16,
		MAX_TAGS: 10,
		MAX_AUTHORS: 24,
		CERTIFICATIONS: {
			0: {
				priority: 10,
				name: "Nothing",
				backgroundColor: "gray",
				textColor: "white"
			},
			1: {
				priority: 10,
				name: "Developer",
				backgroundColor: "#3F51B5",
				textColor: "white"
			},
			2: {
				priority: 9,
				name: "MTC",
				backgroundColor: "#4CAF50",
				textColor: "white"
			}
		},
		ADMIN_ONLY_TAGS: ["ROTATION"],
		TAGS: {
			CTF: {
				name: "CTF",
				backgroundColor: "linear-gradient(45deg, #DF5349 50%, #4971DF 50%)",
				textColor: "white"
			},
			NF: {
				name: "NF",
				backgroundColor: "#FFEB3B",
				textColor: "black"
			},
			DTF: {
				name: "DTF",
				backgroundColor: "#673AB7",
				textColor: "white"
			},
			"2NF": {
				name: "2NF",
				backgroundColor: "linear-gradient(45deg, #FF9800 33%, #F0F0F0 33% 66%, #FF9800 33%)",
				textColor: "black"
			},
			"MARS BALL": {
				name: "Mars Ball",
				backgroundColor: "maroon",
				textColor: "white"
			},
			"ROTATION": {
				name: "Rotation",
				backgroundColor: "linear-gradient(90deg, #33c738, #a4d270)",
				textColor: "white"
			}
		}
	},
	ERROR_CODES: {
		LOGIN_ERROR: 1,
		ALREADY_REGISTERED: 2
	},
	FILLERS: {
		BIO: ["404 Biography Not Found", "No Description", "Nothing to be said here", "I'm too lazy to write a biography."]
	}
};

module.exports = SETTINGS;