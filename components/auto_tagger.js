const { Jimp } = require('jimp');
const SITE_SETTINGS = require('../Settings');

// Feature Colors
const COLORS = {
    YELLOW_FLAG: "808000",
    RED_FLAG: "ff0000",
    BLUE_FLAG: "0000ff",
    RED_ENDZONE: "b90000",
    BLUE_ENDZONE: "190094"
};

function rgbToHex(r, g, b) {
    return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const AutoTagger = {
    async generateTags(layoutBase64, logicJSON) {
        const counts = {
            redFlag: 0,
            blueFlag: 0,
            yellowFlag: 0,
            redEndzone: 0,
            blueEndzone: 0,
            marsBalls: 0
        };

        // 1. Analyze Logic (JSON)
        if (logicJSON && Array.isArray(logicJSON.marsballs)) {
            counts.marsBalls = logicJSON.marsballs.length;
        }

        // 2. Analyze Layout (PNG)
        try {
            const buffer = Buffer.from(layoutBase64, 'base64');
            const image = await Jimp.read(buffer);
            const { width, height, data } = image.bitmap;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                if (a === 0) continue; // Skip transparent

                const hex = rgbToHex(r, g, b).toLowerCase();

                switch (hex) {
                    case COLORS.RED_FLAG: counts.redFlag++; break;
                    case COLORS.BLUE_FLAG: counts.blueFlag++; break;
                    case COLORS.YELLOW_FLAG: counts.yellowFlag++; break;
                    case COLORS.RED_ENDZONE: counts.redEndzone++; break;
                    case COLORS.BLUE_ENDZONE: counts.blueEndzone++; break;
                }
            }
        } catch (err) {
            console.error("AutoTagger Image Error:", err);
            return []; // Fail gracefully, return no tags
        }

        // 3. Determine Tags
        const tags = [];

        // CTF: Red & Blue flags, NO endzones
        if (counts.redFlag > 0 && counts.blueFlag > 0 && counts.redEndzone === 0 && counts.blueEndzone === 0) {
            tags.push("CTF");
        }

        // NF: Neutral/Yellow flag
        if (counts.yellowFlag > 0) {
            tags.push("NF");
        }

        // 2NF: 2 or more Neutral flags
        if (counts.yellowFlag >= 2) {
            tags.push("2NF");
        }

        // DTF: Red & Blue flags WITH endzones
        if (counts.redFlag > 0 && counts.blueFlag > 0 && (counts.redEndzone > 0 || counts.blueEndzone > 0)) {
            tags.push("DTF");
        }

        // Mars Ball
        if (counts.marsBalls > 0) {
            tags.push("MARS BALL");
        }

        return tags;
    }
};

module.exports = AutoTagger;
