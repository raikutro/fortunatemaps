const mongoose = require('mongoose');
const MapEntry = require('../models/MapEntry');
const ModelHash = require('../components/model_hash');
const Utils = require('../Utils');
const SETTINGS = require('../Settings');
require('dotenv').config();

const BATCH_SIZE = 50;

mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log("Connected to database...");

    try {
        const isForce = process.argv.includes('--force');
        if (isForce) {
            console.log("Starting FORCE update (processing all maps)...");
        } else {
            console.log("Starting missing hash backfill (only maps without hashes)...");
        }

        let totalUpdated = 0;
        let batchCount = 0;
        let lastMapID = null;

        while (true) {
            const query = {};

            if (!isForce) {
                query.$or = [
                    { hierarchicalHash: { $exists: false } },
                    { hierarchicalHash: "" },
                ];
            }

            if (lastMapID !== null) {
                query.mapID = { $lt: lastMapID };
            }

            // Find maps and sort by mapID descending (newest first)
            const maps = await MapEntry.find(query)
            .sort({ mapID: -1 })
            .limit(BATCH_SIZE);

            if (maps.length === 0) {
                console.log("No more maps to update.");
                break;
            }

            lastMapID = maps[maps.length - 1].mapID;

            batchCount++;
            console.log(`\nProcessing Batch #${batchCount} (${maps.length} maps)...`);

            const bulkOps = [];

            // Process batch in parallel
            await Promise.all(maps.map(async (map) => {
                if (!map.png) return;

                try {
                    // Decompress PNG
                    const pngBuffer = await Utils.Compression.decompressMapLayout(map.png);
                    if (!pngBuffer) {
                        console.error(`Map ${map.mapID}: failed to decompress PNG.`);
                        return;
                    }

                    // Calculate Hash
                    const hierarchicalHashArray = await ModelHash.get(pngBuffer);
                    
                    const hashBuffer = Buffer.alloc(32);
                    for(let i = 0; i < 32; i++) {
                        let byte = 0;
                        for(let j = 0; j < 8; j++) {
                            if(hierarchicalHashArray[i*8 + j]) {
                                byte |= (1 << (7 - j));
                            }
                        }
                        hashBuffer[i] = byte;
                    }

                    bulkOps.push({
                        updateOne: {
                            filter: { _id: map._id },
                            update: { hierarchicalHash: hashBuffer }
                        }
                    });

                } catch (err) {
                    console.error(`Map ${map.mapID}: Error - ${err.message}`);
                }
            }));

            if (bulkOps.length > 0) {
                const result = await MapEntry.bulkWrite(bulkOps);
                totalUpdated += result.modifiedCount;
                console.log(`Batch #${batchCount} complete. Updated ${result.modifiedCount} maps.`);
            } else {
                console.log(`Batch #${batchCount} complete. No updates needed.`);
            }
        }

        console.log(`\nDone! Total maps updated: ${totalUpdated}`);
        process.exit(0);

    } catch (err) {
        console.error("Fatal Error:", err);
        process.exit(1);
    }
}).catch(err => {
    console.error("Database connection error:", err);
    process.exit(1);
});
