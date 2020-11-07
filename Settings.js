const SETTINGS = {
	NGROK_URL: "https://ce933ff80519.ngrok.io",
	CTF_AUTH_URL: "https://ctfauth.herokuapp.com/api/v1",
	DEV_MODE: !process.env.PORT,
	MAPS: {
		PREVIEW_QUALITY: 0.7
	},
	SITE: {
		MAPS_PER_PAGE: 20,
		LOGIN_EXPIRATION_TIME_LIMIT: 100 * 24 * 3600000,
		COOKIE_TOKEN_NAME: "nekotizer",
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
		ADMIN_ONLY_TAGS: [7],
		TAGS: {
			1: {
				name: "Custom",
				backgroundColor: "gray",
				textColor: "white"
			},
			2: {
				name: "CTF",
				backgroundColor: "linear-gradient(45deg, #DF5349 50%, #4971DF 50%)",
				textColor: "white"
			},
			3: {
				name: "NF",
				backgroundColor: "#FFEB3B",
				textColor: "black"
			},
			4: {
				name: "DTF",
				backgroundColor: "#673AB7",
				textColor: "white"
			},
			5: {
				name: "2NF",
				backgroundColor: "linear-gradient(45deg, #FF9800 33%, #F0F0F0 33% 66%, #FF9800 33%)",
				textColor: "black"
			},
			6: {
				name: "Mars Ball",
				backgroundColor: "maroon",
				textColor: "white"
			},
			7: {
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