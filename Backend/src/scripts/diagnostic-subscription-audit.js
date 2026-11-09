/**
 * diagnostic-subscription-audit.js — Read-Only Forensic Subscription & User Audit
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function runAudit() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // 1. User Collection Overview
        const totalUsers = await db.collection('users').countDocuments();
        const usersByPlan = await db.collection('users').aggregate([
            { $group: { _id: '$plan', count: { $sum: 1 } } }
        ]).toArray();
        const deletedUsers = await db.collection('users').countDocuments({ isDeleted: true });
        const blockedUsers = await db.collection('users').countDocuments({ isBlocked: true });
        const unverifiedUsers = await db.collection('users').countDocuments({ isVerified: false });

        console.log('\n--- 1. USERS OVERVIEW ---');
        console.log(`Total Registered Users: ${totalUsers}`);
        console.log(`Users By Plan:`, usersByPlan);
        console.log(`Deleted / Archived Users: ${deletedUsers}`);
        console.log(`Blocked Users: ${blockedUsers}`);
        console.log(`Unverified Users: ${unverifiedUsers}`);

        // 2. Subscription Collection Overview
        const totalSubs = await db.collection('subscriptions').countDocuments();
        const subsByStatus = await db.collection('subscriptions').aggregate([
            { $group: { _id: { status: '$status', plan: '$plan' }, count: { $sum: 1 } } }
        ]).toArray();

        console.log('\n--- 2. SUBSCRIPTIONS OVERVIEW ---');
        console.log(`Total Subscription Records: ${totalSubs}`);
        console.log(`Subscriptions By Status & Plan:`, subsByStatus);

        // 3. Date & Field Inconsistencies
        const now = new Date();
        const subsMissingStart = await db.collection('subscriptions').countDocuments({
            $or: [
                { currentPeriodStart: { $exists: false } },
                { currentPeriodStart: null }
            ]
        });

        const subsPeriodEndPast = await db.collection('subscriptions').countDocuments({
            currentPeriodEnd: { $lt: now }
        });

        const activeSubsPeriodEndPast = await db.collection('subscriptions').countDocuments({
            status: { $in: ['ACTIVE', 'active'] },
            currentPeriodEnd: { $lt: now }
        });

        const activeSubsPeriodEndFuture = await db.collection('subscriptions').countDocuments({
            status: { $in: ['ACTIVE', 'active'] },
            currentPeriodEnd: { $gte: now }
        });

        console.log('\n--- 3. DATE INCONSISTENCIES ---');
        console.log(`Subscriptions with missing/null currentPeriodStart: ${subsMissingStart}`);
        console.log(`Subscriptions with currentPeriodEnd < NOW: ${subsPeriodEndPast}`);
        console.log(`ACTIVE/active Subscriptions with currentPeriodEnd < NOW: ${activeSubsPeriodEndPast}`);
        console.log(`ACTIVE/active Subscriptions with currentPeriodEnd >= NOW: ${activeSubsPeriodEndFuture}`);

        // 4. User vs Subscription Linkage
        const distinctSubUserIds = await db.collection('subscriptions').distinct('userId');
        console.log(`\nDistinct User IDs in Subscriptions: ${distinctSubUserIds.length}`);

        // Users without any subscription record
        const usersWithoutSub = await db.collection('users').find({
            _id: { $nin: distinctSubUserIds }
        }).project({ _id: 1, username: 1, email: 1, plan: 1, role: 1, isVerified: 1, createdAt: 1 }).toArray();

        console.log(`\n--- 4. USERS WITHOUT SUBSCRIPTION (${usersWithoutSub.length}) ---`);
        console.log(`Count of users without subscription: ${usersWithoutSub.length}`);
        const noSubByPlan = {};
        usersWithoutSub.forEach(u => {
            const p = u.plan || 'free';
            noSubByPlan[p] = (noSubByPlan[p] || 0) + 1;
        });
        console.log(`Breakdown of users without subscription by plan:`, noSubByPlan);
        console.log(`Sample users without subscription (first 5):`, usersWithoutSub.slice(0, 5));

        // Users with multiple subscription records
        const multiSubUsers = await db.collection('subscriptions').aggregate([
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();
        console.log(`\nUsers with MULTIPLE subscription records: ${multiSubUsers.length}`, multiSubUsers);

        for (const m of multiSubUsers) {
            const subs = await db.collection('subscriptions').find({ userId: m._id }).toArray();
            console.log(`\nUser ${m._id} has ${subs.length} subs:`);
            subs.forEach(s => console.log(`  - SubID: ${s._id}, plan: ${s.plan}, status: "${s.status}", startedAt: ${s.startedAt?.toISOString()}, end: ${s.currentPeriodEnd?.toISOString()}`));
        }

        // Orphaned subscriptions (userId does not exist in users collection)
        const allUserIds = await db.collection('users').distinct('_id');
        const allUserIdsSet = new Set(allUserIds.map(id => id.toString()));
        const orphanedSubDocs = await db.collection('subscriptions').find({ userId: { $nin: allUserIds } }).toArray();
        console.log(`\nOrphaned Subscription Records: ${orphanedSubDocs.length}`);
        orphanedSubDocs.forEach(s => console.log(`  - Orphaned SubID: ${s._id}, userId: ${s.userId}, plan: ${s.plan}, status: "${s.status}"`));

        // 5. Payment Orders & Payments correlation
        const totalOrders = await db.collection('paymentorders').countDocuments();
        const paidOrders = await db.collection('paymentorders').countDocuments({ status: 'PAID' });
        const totalPayments = await db.collection('payments').countDocuments();
        const successPayments = await db.collection('payments').countDocuments({ status: 'SUCCESS' });
        const totalInvoices = await db.collection('invoices').countDocuments();

        console.log('\n--- 5. FINANCIAL RECORD CORRELATION ---');
        console.log(`Total Payment Orders: ${totalOrders} (PAID: ${paidOrders})`);
        console.log(`Total Payments: ${totalPayments} (SUCCESS: ${successPayments})`);
        console.log(`Total Invoices: ${totalInvoices}`);

        await mongoose.disconnect();
        console.log('\n✅ Audit completed successfully.');
    } catch (err) {
        console.error('Audit failed:', err);
        process.exit(1);
    }
}

runAudit();
