const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const MapEntry = require('../models/MapEntry');
require('dotenv').config();

const tempDir = path.join(__dirname, '../temp');

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

async function dumpCollection(Model, filename) {
    const totalCount = await Model.countDocuments({});
    console.log(`Total documents to dump for ${Model.modelName}: ${totalCount}`);

    return new Promise((resolve, reject) => {
        const filePath = path.join(tempDir, filename);
        const writeStream = fs.createWriteStream(filePath);
        
        writeStream.write('[\n');
        
        const cursor = Model.find({}).lean().cursor();
        let isFirst = true;
        let count = 0;

        cursor.on('data', (doc) => {
            if (!isFirst) {
                writeStream.write(',\n');
            }
            // Be mindful of buffers being stringified to Base64 in JSON
            writeStream.write(JSON.stringify(doc));
            isFirst = false;
            count++;

            // Log progress
            if (count % 100 === 0 || count === totalCount) {
                const percent = ((count / totalCount) * 100).toFixed(2);
                process.stdout.write(`\r[${Model.modelName}] Dumped ${count}/${totalCount} documents (${percent}%)...`);
            }
        });

        cursor.on('error', (err) => {
            console.error(`\nError dumping ${Model.modelName}:`, err);
            reject(err);
        });

        cursor.on('end', () => {
            writeStream.write('\n]');
            writeStream.end(() => {
                console.log(`\n[${Model.modelName}] Finished dumping ${count} documents to ${filename}.`);
                resolve(count);
            });
        });
    });
}

mongoose.connect(process.env.MONGODB_URL).then(async () => {
    console.log("Connected to database. Starting dump...\n");

    try {
        console.log("--- Dumping Users ---");
        await dumpCollection(User, 'users.json');

        console.log("\n--- Dumping Maps ---");
        await dumpCollection(MapEntry, 'maps.json');

        console.log("\nDump complete!");
        process.exit(0);

    } catch (err) {
        console.error("\nError during dump:", err);
        process.exit(1);
    }
}).catch(err => {
    console.error("Database connection error:", err);
    process.exit(1);
});
