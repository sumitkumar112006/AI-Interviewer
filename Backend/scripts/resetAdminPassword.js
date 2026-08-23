require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const adminModel = require('../src/models/admin.model');
const userModel = require('../src/models/user.model');
const connectToDB = require('../src/config/database');

async function resetPassword() {
    const targetEmail = process.argv[2] || "amitk839170@gmail.com";
    const newPassword = process.argv[3] || "1Sumitkumar#";

    try {
        await connectToDB();

        const normalizedEmail = targetEmail.trim().toLowerCase();
        const hash = await bcrypt.hash(newPassword, 10);

        // 1. Create or update in admins collection
        let admin = await adminModel.findOne({ email: normalizedEmail });
        if (!admin) {
            // Check if user exists in userModel to copy username
            const existingUser = await userModel.findOne({ email: normalizedEmail });
            admin = new adminModel({
                username: existingUser ? existingUser.username : "Super Admin",
                email: normalizedEmail,
                password: hash,
                role: 'super_admin',
                isVerified: true
            });
        } else {
            admin.password = hash;
            admin.role = 'super_admin';
            admin.isVerified = true;
        }
        await admin.save();

        // 2. Also keep userModel in sync for user table
        const user = await userModel.findOne({ email: normalizedEmail });
        if (user) {
            user.role = 'super_admin';
            user.password = hash;
            await user.save();
        }

        console.log(`\n🎉 SUPER ADMIN CREDENTIALS SET SUCCESSFULLY IN 'admins' TABLE!`);
        console.log(`-----------------------------------`);
        console.log(`Email    : ${admin.email}`);
        console.log(`Password : ${newPassword}`);
        console.log(`Role     : ${admin.role.toUpperCase()}`);
        console.log(`Table    : admins`);
        console.log(`-----------------------------------\n`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Error setting admin credentials:", err);
        process.exit(1);
    }
}

resetPassword();
