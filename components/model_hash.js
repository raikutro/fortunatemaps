const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');
const { DIMENSIONS } = require('../Settings').HIERARCHICAL_HASH;

// Load hash model
const modelPath = path.join(__dirname, '../chunk_models/hash_model.json');
let hashModel = null;
try {
    hashModel = require(modelPath);
} catch (err) {
    console.error("Could not load hash_model.json. Make sure to train it first.");
}

const ModelHash = {
    /**
     * Generates a hash from an image buffer using a trained median threshold model.
     * 1. Grayscale
     * 2. Resize to 16x16 (Bicubic)
     * 3. Assign 1 if pixel >= median threshold, else 0.
     * 
     * @param {Buffer|string} imageBuffer - The image buffer
     * @returns {Promise<number[]>} - Array of 256 bits (0 or 1)
     */
    async get(imageBuffer) {
        if (!imageBuffer) return [];
        if (!hashModel || !hashModel.thresholds) {
            console.error("Hash model missing or invalid.");
            return Array(256).fill(0);
        }

        try {
            let input = imageBuffer;
            if (typeof imageBuffer === 'string') {
                input = Buffer.from(imageBuffer, 'base64');
            }

            const image = await Jimp.read(input);
            
            // 1. Scale down using Bicubic
            image.resize({ w: DIMENSIONS, h: DIMENSIONS, mode: 'bicubicInterpolation' });

            // 2. Grayscale
            image.greyscale();

            const hash = [];
            const { data } = image.bitmap;
            
            let pixelIndex = 0;
            // Data is stored as RGBA (4 bytes per pixel).
            for (let i = 0; i < data.length; i += 4) {
                const val = data[i]; // R channel
                const threshold = hashModel.thresholds[pixelIndex];
                
                if (val >= threshold) {
                    hash.push(1);
                } else {
                    hash.push(0);
                }
                pixelIndex++;
            }

            return hash;

        } catch (err) {
            console.error("ModelHash Error:", err);
            return Array(256).fill(0); // Return array with 256 zeros on error so length is consistent
        }
    }
};

module.exports = ModelHash;
