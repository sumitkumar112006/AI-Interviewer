require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const userModel = require('../src/models/user.model');
const connectToDB = require('../src/config/database');

async function makeAdmin() {
    const targetEmail = process.argv[2];

    try {
        await connectToDB();

        let query = {};
        if (targetEmail && targetEmail.trim()) {
            query = { email: targetEmail.trim().toLowerCase() };
        } else {
            console.log("No email specified. Promoting the most recently registered user...");
        }

        const user = await userModel.findOne(query).sort({ createdAt: -1 });

        if (!user) {
            console.error("❌ No matching user found in database!");
            process.exit(1);
        }

        user.role = 'super_admin';
        await user.save();

        console.log(`\n🎉 SUCCESS! User '${user.username}' (${user.email}) is now a SUPER ADMIN!`);
        console.log(`Now log in or refresh your browser, then navigate to:`);
        console.log(`http://localhost:5173/admin-portal-dashboard-root\n`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Error making admin:", err);
        process.exit(1);
    }
}

makeAdmin();
