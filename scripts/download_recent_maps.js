const mongoose = require('mongoose');
const MapEntry = require('../models/MapEntry');
const Utils = require('../Utils');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("Usage: node scripts/download_recent_maps.js <number_of_maps> <output_folder>");
        process.exit(1);
    }

    const n = parseInt(args[0], 10);
    const outputFolder = args[1];

    if (isNaN(n) || n <= 0) {
        console.error("Please provide a valid positive number for n.");
        process.exit(1);
    }

    if (!fs.existsSync(outputFolder)) {
        console.log(`Creating directory: ${outputFolder}`);
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("Connected to database...");

        console.log(`Fetching the ${n} most recent maps...`);
        const maps = await MapEntry.find({})
            .sort({ mapID: -1 })
            .limit(n)
            .select('mapID png'); // Only fetch what we need

        console.log(`Found ${maps.length} maps. Downloading...`);

        let savedCount = 0;

        for (const map of maps) {
            if (!map.png) {
                console.log(`Skipping map ${map.mapID} (No PNG data)`);
                continue;
            }

            try {
                // Decompress the PNG buffer (GZIP)
                const pngBuffer = await Utils.Compression.decompressMapLayout(map.png);
                
                if (!pngBuffer) {
                    console.error(`Failed to decompress PNG for map ${map.mapID}`);
                    continue;
                }

                const filePath = path.join(outputFolder, `map_${map.mapID}.png`);
                fs.writeFileSync(filePath, pngBuffer);

                if (savedCount % 100 === 0) {
                    console.log(`Saved ${savedCount}/${maps.length} maps...`);
                }
                savedCount++;
            } catch (err) {
                console.error(`Error saving map ${map.mapID}:`, err);
            }
        }

        console.log(`\nDone! Successfully saved ${savedCount}/${maps.length} maps to ${outputFolder}`);
        process.exit(0);

    } catch (err) {
        console.error("Fatal Error:", err);
        process.exit(1);
    }
}

main();
