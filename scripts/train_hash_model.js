const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
const SETTINGS = require('../Settings');

const args = process.argv.slice(2);
const folderPath = args[0];
const outputPath = args[1] || 'hash_model.json';

if (!folderPath) {
    console.error("Usage: node train_hash_model.js <path_to_png_folder> [output_file.json]");
    process.exit(1);
}

async function main() {
    try {
        if (!fs.existsSync(folderPath)) {
            console.error(`Folder not found: ${folderPath}`);
            return;
        }

        const files = fs.readdirSync(folderPath).filter(file => file.toLowerCase().endsWith('.png'));
        
        if (files.length === 0) {
            console.error("No PNG files found in the specified folder.");
            return;
        }

        console.log(`Found ${files.length} PNG files. Processing...`);

        // We have a 16x16 box, meaning 256 pixels. 
        // We will store an array of values for each pixel.
        const DIMENSIONS = SETTINGS.HIERARCHICAL_HASH.DIMENSIONS;
        const pixelValues = Array.from({ length: DIMENSIONS * DIMENSIONS }, () => []);
        let processedCount = 0;

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            try {
                const image = await Jimp.read(filePath);
                
                // 1. Scale down to 16x16 box
                // Using bicubic interpolation for smoother scaling
                image.resize({ w: DIMENSIONS, h: DIMENSIONS, mode: 'bicubicInterpolation' });
                
                // 2. Grayscale
                image.greyscale();
                
                // 3. Collect pixel values
                const { data } = image.bitmap;
                
                let pixelIndex = 0;
                // data is stored as RGBA (4 bytes per pixel). 
                // We iterate 4 bytes at a time and take the Red channel as our greyscale value.
                for (let i = 0; i < data.length; i += 4) {
                    const val = data[i];
                    pixelValues[pixelIndex].push(val);
                    pixelIndex++;
                }
                
                processedCount++;
                if (processedCount % 100 === 0) {
                    console.log(`Processed ${processedCount}/${files.length} maps...`);
                }
            } catch (err) {
                console.error(`Failed to process ${file}:`, err.message);
            }
        }

        if (processedCount === 0) {
            console.error("No files were successfully processed.");
            return;
        }

        console.log(`Finished processing ${processedCount} maps. Calculating medians...`);

        const thresholds = new Array(DIMENSIONS * DIMENSIONS);

        for (let i = 0; i < DIMENSIONS * DIMENSIONS; i++) {
            const values = pixelValues[i];
            if (values.length === 0) {
                thresholds[i] = 0;
                continue;
            }
            
            // Sort values to find median
            values.sort((a, b) => a - b);
            
            const mid = Math.floor(values.length / 2);
            let median;
            
            if (values.length % 2 === 0) {
                // Average of two middle values, rounded down to an 8-bit integer
                median = Math.floor((values[mid - 1] + values[mid]) / 2);
            } else {
                median = values[mid];
            }
            
            thresholds[i] = median;
        }

        const outputData = {
            thresholds: thresholds,
            numberOfMaps: processedCount
        };

        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
        console.log(`Successfully saved hash model with ${processedCount} maps to ${outputPath}`);
        console.log(`Generated an array of ${thresholds.length} 8-bit integers representing median pixel brightness.`);

    } catch (err) {
        console.error("An error occurred during training:", err);
    }
}

main();
