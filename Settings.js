const SETTINGS = {
	NGROK_URL: process.env.NGROK_URL,
	CTF_AUTH_URL: "https://ctfauth.herokuapp.com/api/v1",
	DEV_MODE: (process.env.NODE_ENV || "").toUpperCase() === "DEVELOPER",
	MAPS: {
		PREVIEW_QUALITY: 0.7,
		THUMBNAIL_SIZE: 400
	},
	SITE: {
		MAPS_PER_PAGE: 20,
		LOGIN_EXPIRATION_TIME_LIMIT: 100 * 24 * 3600000,
		COOKIE_TOKEN_NAME: 'nekotizer',
		MAP_NAME_LENGTH: 200,
		AUTHOR_LENGTH: 200,
		TAG_NAME_LENGTH: 16,
		MAX_TAGS: 10,
		MAX_AUTHORS: 24,
		CERTIFICATIONS: {
			0: {
				priority: 10,
				name: "Nothing",
				backgroundColor: "gray",
				textColor: "#eee"
			},
			1: {
				priority: 10,
				name: "Developer",
				backgroundColor: "#3F51B5",
				textColor: "#eee"
			},
			2: {
				priority: 9,
				name: "MTC",
				backgroundColor: "#4CAF50",
				textColor: "#eee"
			}
		},
		ADMIN_ONLY_TAGS: ["ROTATION"],
		TAGS: {
			"CTF": {
				name: "CTF",
				backgroundColor: "linear-gradient(45deg, #DF5349 50%, #4971DF 50%)",
				textColor: "#eee"
			},
			"NF": {
				name: "NF",
				backgroundColor: "#FFEB3B",
				textColor: "black"
			},
			"DTF": {
				name: "DTF",
				backgroundColor: "#673AB7",
				textColor: "#eee"
			},
			"2NF": {
				name: "2NF",
				backgroundColor: "linear-gradient(45deg, #FF9800 33%, #F0F0F0 33% 66%, #FF9800 33%)",
				textColor: "black"
			},
			"MARS BALL": {
				name: "Mars Ball",
				backgroundColor: "maroon",
				textColor: "#eee"
			},
			"ROTATION": {
				name: "Rotation",
				backgroundColor: "linear-gradient(90deg, #33c738, #a4d270)",
				textColor: "#eee"
			},
			"UMDUMP": {
				name: "U-M Transfer",
				backgroundColor: "#003F00",
				textColor: "#eee"
			}
		}
	},
	ERRORS: {
		LOGIN_ERROR: errCode({ err: "An error occurred while logging in", code: "LOGIN.LOGIN_ERROR" }),
		ALREADY_REGISTERED: errCode({ err: "This profile has already been registered", code: "REGISTER.ALREADY_REGISTERED" }),
		PREVIEW_GENERATION: errCode({ err: "An error occurred while generating map preview", code: "MAP.PREVIEW_GENERATION" }),
		// PREVIEW_GENERATION: errCode({ err: "An error occurred while generating map preview", code: "MAP.PREVIEW_GENERATION" })
	},
	FILLERS: {
		BIO: ["404 Biography Not Found", "No Description", "Nothing to be said here", "I'm too lazy to write a biography."]
	}
};

function errCode({err, code}) {
	return customErr => ({err: err + (customErr ? ": " : "") + (customErr || "")});
}

module.exports = SETTINGS;