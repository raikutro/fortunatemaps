const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const args = process.argv.slice(2);
const username = args[0];

if (!username) {
    console.error("Please provide a username. Usage: node scripts/make_admin.js <username>");
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log("Connected to database...");
    
    try {
        const user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });

        if (!user) {
            console.error(`User '${username}' not found.`);
            process.exit(1);
        }

        user.isAdmin = true;
        await user.save();

        console.log(`Successfully granted admin privileges to user: ${user.username}`);
        process.exit(0);

    } catch (err) {
        console.error("Error updating user:", err);
        process.exit(1);
    }
}).catch(err => {
    console.error("Database connection error:", err);
    process.exit(1);
});
