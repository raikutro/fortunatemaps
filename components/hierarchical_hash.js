const { Jimp } = require('jimp');

const HierarchicalHash = {
    /**
     * Generates a hierarchical hash from an image buffer.
     * 1. Grayscale
     * 2. Resize to 2x2, 4x4, 8x8 (Bicubic)
     * 3. Concatenate pixel values
     * 4. Quantize by dividing by q
     * 
     * @param {Buffer} imageBuffer - The image buffer
     * @param {number} q - Quantization constant (divisor)
     * @returns {Promise<number[]>} - Array of quantized values
     */
    async get(imageBuffer, q = 0) {
        if (!imageBuffer) return [];

        try {
            let input = imageBuffer;
            if (typeof imageBuffer === 'string') {
                input = Buffer.from(imageBuffer, 'base64');
            }

            const image = await Jimp.read(input);
            
            // 1. Grayscale
            image.greyscale();

            const sizes = [2, 4, 8];
            let hash = [];

            for (const size of sizes) {
                // 2. Scale down using Bicubic
                const resized = image.clone().resize({ w: size, h: size, mode: 'bicubicInterpolation' });
                
                // Reading pixel values
                const { data, width, height } = resized.bitmap;
                
                // Data is stored as RGBA (4 bytes per pixel). Since it's grayscale, R=G=B.
                // We just want one value.
                for (let i = 0; i < data.length; i += 4) {
                    const val = data[i]; // R channel
                    hash.push(val);
                }
            }

            // Quantize
            // maps values to 0-k integers.
            // Assuming q is the divisor.
            if (q > 1) {
                hash = hash.map(val => Math.floor(val / q));
            }

            return hash;

        } catch (err) {
            console.error("HierarchicalHash Error:", err);
            return [];
        }
    }
};

module.exports = HierarchicalHash;
