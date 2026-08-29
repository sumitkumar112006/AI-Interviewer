/**
 * One-time migration script: Create subscription documents for all existing users
 * who don't already have one, and set their generationsResetAt field.
 * 
 * Run: node src/scripts/migrate-subscriptions.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const userModel = require('../models/user.model');
const subscriptionModel = require('../models/subscription.model');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Get all users
        const allUsers = await userModel.find({});
        console.log(`📋 Found ${allUsers.length} total users`);

        let created = 0;
        let skipped = 0;
        let updated = 0;

        for (const user of allUsers) {
            // Check if subscription already exists
            const existingSub = await subscriptionModel.findOne({ userId: user._id });

            if (existingSub) {
                console.log(`  ⏩ Skipped ${user.username} (${user.email}) — subscription already exists`);
                skipped++;
            } else {
                // Create subscription document
                await subscriptionModel.create({
                    userId: user._id,
                    plan: user.plan || 'free',
                    status: 'active',
                    startedAt: user.createdAt || now,
                    currentPeriodEnd: thirtyDaysFromNow
                });
                console.log(`  ✅ Created subscription for ${user.username} (${user.email}) — plan: ${user.plan || 'free'}`);
                created++;
            }

            // Also set generationsResetAt if not already set
            if (!user.generationsResetAt) {
                await userModel.findByIdAndUpdate(user._id, {
                    generationsUsed: user.generationsUsed || 0,
                    generationsResetAt: thirtyDaysFromNow
                });
                console.log(`  🔄 Set generationsResetAt for ${user.username}`);
                updated++;
            }
        }

        console.log('\n═══════════════════════════════════════');
        console.log(`✅ Migration complete!`);
        console.log(`   Created: ${created} subscriptions`);
        console.log(`   Skipped: ${skipped} (already had subscription)`);
        console.log(`   Updated: ${updated} users (set generationsResetAt)`);
        console.log('═══════════════════════════════════════');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        await mongoose.disconnect();
        process.exit(1);
    }
}

migrate();
