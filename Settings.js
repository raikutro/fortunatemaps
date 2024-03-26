const SETTINGS = {
	NGROK_URL: process.env.NGROK_URL,
	CTF_AUTH_URL: "https://ctfauth.herokuapp.com/api/v2",
	DEV_MODE: (process.env.NODE_ENV || "").toUpperCase() === "DEVELOPMENT",
	MAPS: {
		PREVIEW_QUALITY: 0.7,
		THUMBNAIL_QUALITY: 0.9,
		THUMBNAIL_SIZE: 400,
		MAX_PNG_LENGTH: 2 ** 20,
		MAX_JSON_LENGTH: 2 ** 20,
	},
	SITE: {
		MAPS_PER_PAGE: 24,
		LOGIN_EXPIRATION_TIME_LIMIT: 100 * 24 * 3600000,
		COOKIE_TOKEN_NAME: process.env.COOKIE_TOKEN_NAME,
		MAP_NAME_LENGTH: 150,
		AUTHOR_LENGTH: 150,
		TAG_NAME_MAX_LENGTH: 16,
		MAX_TAGS: 10,
		MAX_AUTHORS: 24,
		CERTIFICATIONS: {
			0: {
				priority: 10,
				name: "Nothing",
				backgroundColor: "gray",
				textColor: "#EEEEEE"
			},
			1: {
				priority: 10,
				name: "F-M Developer",
				backgroundColor: "#69BF4A",
				textColor: "#EEEEEE"
			},
			2: {
				priority: 9,
				name: "MTC",
				backgroundColor: "#4CAF50",
				textColor: "#EEEEEE"
			},
			3: {
				priority: 8,
				name: "TPFG",
				backgroundColor: "#5DB4E8",
				textColor: "#EEEEEE"
			}
		},
		ADMIN_ONLY_TAGS: ["ROTATION", "RETIRED", "UMDUMP"],
		TAGS: {
			CTF: {
				name: "CTF",
				backgroundColor: "linear-gradient(45deg, #DF5349 50%, #4971DF 50%)",
				textColor: "#EEEEEE"
			},
			NF: {
				name: "NF",
				backgroundColor: "#FFEB3B",
				textColor: "#111111"
			},
			DTF: {
				name: "DTF",
				backgroundColor: "#673AB7",
				textColor: "#EEEEEE"
			},
			"2NF": {
				name: "2NF",
				backgroundColor: "linear-gradient(45deg, #FF9800 33%, #F0F0F0 33% 66%, #FF9800 33%)",
				textColor: "#111111"
			},
			"MARS BALL": {
				name: "Mars Ball",
				backgroundColor: "maroon",
				textColor: "#EEEEEE"
			},
			"MINIGAME": {
				name: "Minigame",
				backgroundColor: "#B73AB3",
				textColor: "#EEEEEE"
			},
			"ROTATION": {
				name: "Rotation",
				backgroundColor: "linear-gradient(90deg, #33C738, #A4D270)",
				textColor: "#EEEEEE"
			},
			"RETIRED": {
				name: "Retired",
				backgroundColor: "linear-gradient(90deg, #C4C4C4, #D1D1D1)",
				textColor: "#111111"
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
		INVALID_LOGIN_TOKEN: errCode({ err: "Your login token has expired", code: "LOGIN.INVALID_TOKEN" }),
		ALREADY_REGISTERED: errCode({ err: "This profile has already been registered", code: "REGISTER.ALREADY_REGISTERED" }),
		
		INVALID_MAP_ID: errCode({ err: "That map ID is invalid", code: "SEARCH.INVALID_MAP_ID" }),
		NOT_FOUND: errCode({ err: "That resource could not be located", code: "SEARCH.NOT_FOUND" }),
		MAX_PAGE_LIMIT: errCode({ err: "The page you were trying to access is out of range. Please use a smaller value", code: "SEARCH.MAX_PAGE_LIMIT" }),
		TEST_MAP_LINK_FAIL: errCode({ err: "Sorry, we could not start up a test map", code: "TEST.TEST_MAP_LINK_FAIL" }),
		
		UPLOAD_MAX_SIZE: errCode({ err: "A size error occurred while uploading your map.", code: "UPLOAD.MAX_SIZE"}),
		PREVIEW_GENERATION: errCode({ err: "An error occurred while generating map preview", code: "CREATION.PREVIEW_GENERATION" }),
		PREVIEW_WRITING: errCode({ err: "An error occurred while saving the map preview", code: "CREATION.PREVIEW_WRITING" }),
		THUMBNAIL_GENERATION: errCode({ err: "An error occurred while generating map thumbnail", code: "CREATION.THUMBNAIL_GENERATION" })
	},
	FILLERS: {
		BIO: ["404 Biography Not Found", "No Description", "Nothing to be said here", "I'm too lazy to write a biography."]
	},
	PACK: () => {
		return {
			...SETTINGS,
			ERRORS: Object.keys(SETTINGS.ERRORS).reduce((acc, key) => ({
				...acc,
				[key]: SETTINGS.ERRORS[key]()
			}), {})
		};
	}
};

function errCode({err, code}) {
	return customErr => ({err: err + (customErr ? ": " : "") + (customErr || ""), code});
}

module.exports = SETTINGS;