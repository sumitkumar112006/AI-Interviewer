const userModel = require("../models/user.model");
const interviewReportModel = require("../models/interviewReport.model");
const coverLetterModel = require("../models/coverLetter.model");
const subscriptionModel = require("../models/subscription.model");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const notificationModel = require("../models/notification.model");

/**
 * @name getAdminStatsController
 * @description Get overall platform statistics for the admin dashboard
 * @access Private (Admin Only)
 */
async function getAdminStatsController(req, res) {
    try {
        const [totalUsers, totalAdmins, totalReports, totalCoverLetters, blockedUsers] = await Promise.all([
            userModel.countDocuments(),
            userModel.countDocuments({ role: { $in: ['admin', 'super_admin'] } }),
            interviewReportModel.countDocuments(),
            coverLetterModel.countDocuments(),
            userModel.countDocuments({ isBlocked: true })
        ]);

        const planCounts = await userModel.aggregate([
            { $group: { _id: { $ifNull: ["$plan", "free"] }, count: { $sum: 1 } } }
        ]);

        const plans = { free: 0, pro: 0, premium: 0 };
        planCounts.forEach(p => {
            const key = (p._id || 'free').toLowerCase();
            if (key in plans) plans[key] = p.count;
        });

        // Calculate 7-day registration trend (extract timestamp from _id if createdAt is missing)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const dailyRegistrationsRaw = await userModel.aggregate([
            {
                $addFields: {
                    userCreatedAt: { $ifNull: ["$createdAt", { $toDate: "$_id" }] }
                }
            },
            {
                $match: { userCreatedAt: { $gte: sevenDaysAgo } }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$userCreatedAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Map into full 7-day continuous dataset so days with 0 registrations are filled nicely
        const regMap = new Map(dailyRegistrationsRaw.map(r => [r._id, r.count]));
        const dailyRegistrations = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyRegistrations.push({
                _id: dateStr,
                count: regMap.get(dateStr) || 0
            });
        }

        return res.status(200).json({
            stats: {
                totalUsers,
                totalAdmins,
                totalReports,
                totalCoverLetters,
                blockedUsers,
                plans,
                dailyRegistrations
            }
        });
    } catch (err) {
        console.error("[ADMIN STATS ERROR]", err);
        return res.status(500).json({ message: err.message || "Failed to fetch admin stats." });
    }
}

/**
 * @name getAdminUsersController
 * @description Search, filter, and list users & admins with generation metrics
 * @access Private (Admin Only)
 */
async function getAdminUsersController(req, res) {
    try {
        const { search = "", plan = "", role = "", blocked = "", page = 1, limit = 20 } = req.query;

        const query = {};

        if (search.trim()) {
            const searchRegex = new RegExp(search.trim(), "i");
            query.$or = [{ username: searchRegex }, { email: searchRegex }];
        }

        if (plan) {
            query.plan = plan.toLowerCase();
        }

        if (role) {
            query.role = role.toLowerCase();
        }

        if (blocked !== "") {
            query.isBlocked = blocked === "true";
        }

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        const [accounts, total] = await Promise.all([
            userModel.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            userModel.countDocuments(query)
        ]);

        // Aggregate generated report counts for each account
        const accountIds = accounts.map(u => u._id);

        const [reportCounts, coverLetterCounts] = await Promise.all([
            interviewReportModel.aggregate([
                { $match: { user: { $in: accountIds } } },
                { $group: { _id: "$user", count: { $sum: 1 } } }
            ]),
            coverLetterModel.aggregate([
                { $match: { user: { $in: accountIds } } },
                { $group: { _id: "$user", count: { $sum: 1 } } }
            ])
        ]);

        const reportMap = {};
        reportCounts.forEach(r => { reportMap[r._id.toString()] = r.count; });

        const coverLetterMap = {};
        coverLetterCounts.forEach(c => { coverLetterMap[c._id.toString()] = c.count; });

        const enrichedUsers = accounts.map(u => ({
            ...u,
            totalReports: reportMap[u._id.toString()] || 0,
            totalCoverLetters: coverLetterMap[u._id.toString()] || 0
        }));

        return res.status(200).json({
            users: enrichedUsers,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum
            }
        });
    } catch (err) {
        console.error("[ADMIN USERS ERROR]", err);
        return res.status(500).json({ message: err.message || "Failed to fetch user list." });
    }
}

/**
 * @name updateUserRoleController
 * @description Update a user's role ('user', 'admin', 'super_admin')
 * @access Private (Admin Only)
 */
async function updateUserRoleController(req, res) {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        const validRoles = ['user', 'admin', 'super_admin'];
        if (!role || !validRoles.includes(role.toLowerCase())) {
            return res.status(400).json({ message: "Invalid role. Allowed: 'user', 'admin', 'super_admin'." });
        }

        const targetRole = role.toLowerCase();

        const user = await userModel.findByIdAndUpdate(
            userId,
            { role: targetRole },
            { new: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "Account not found." });
        }

        return res.status(200).json({
            message: `User ${user.username} (${user.email}) role updated to '${targetRole.toUpperCase()}'.`,
            user
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to update user role." });
    }
}

/**
 * @name createAdminAccountController
 * @description Create a brand new Administrator user account in users table
 * @access Private (Admin Only)
 */
async function createAdminAccountController(req, res) {
    try {
        const { username, email, password, role = 'admin' } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: "Username, Email, and Password are required." });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long." });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await userModel.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(400).json({ message: "An account with this email already exists." });
        }

        const hash = await bcrypt.hash(password, 10);

        const newAdmin = await userModel.create({
            username: username.trim(),
            email: normalizedEmail,
            password: hash,
            role: ['super_admin', 'admin'].includes(role.toLowerCase()) ? role.toLowerCase() : 'admin',
            isVerified: true,
            plan: 'premium'
        });

        return res.status(201).json({
            message: `New Administrator account '${newAdmin.username}' created successfully.`,
            admin: {
                id: newAdmin._id,
                username: newAdmin.username,
                email: newAdmin.email,
                role: newAdmin.role
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to create admin account." });
    }
}

/**
 * @name updateUserPlanController
 * @description Update a user's subscription plan ('free', 'pro', 'premium')
 * @access Private (Admin Only)
 */
async function updateUserPlanController(req, res) {
    try {
        const { userId } = req.params;
        const { plan } = req.body;

        if (!plan || !['free', 'pro', 'premium'].includes(plan.toLowerCase())) {
            return res.status(400).json({ message: "Invalid plan. Allowed: 'free', 'pro', 'premium'." });
        }

        const normalizedPlan = plan.toLowerCase();
        const now = new Date();
        const newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

        // Update user plan and reset generation credits for the new billing period
        const user = await userModel.findByIdAndUpdate(
            userId,
            {
                plan: normalizedPlan,
                generationsUsed: 0,
                generationsResetAt: newPeriodEnd
            },
            { new: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Create or update subscription document
        await subscriptionModel.findOneAndUpdate(
            { userId: userId },
            {
                plan: normalizedPlan,
                status: 'active',
                startedAt: now,
                currentPeriodEnd: newPeriodEnd,
                cancelAtPeriodEnd: false
            },
            { upsert: true, new: true }
        );

        try {
            await notificationModel.create({
                recipient: user._id,
                sender: req.user?._id || req.user?.id,
                title: "Subscription Plan Updated",
                message: `Your subscription plan has been updated to '${user.plan.toUpperCase()}' by an administrator.`,
                type: "ACCOUNT_STATUS"
            });
        } catch (nErr) { console.error("Notification creation failed:", nErr); }

        return res.status(200).json({
            message: `User ${user.username} plan updated to '${user.plan.toUpperCase()}'.`,
            user
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to update user plan." });
    }
}

/**
 * @name toggleUserBlockController
 * @description Toggle block status for a user (isBlocked: true/false)
 * @access Private (Admin Only)
 */
async function toggleUserBlockController(req, res) {
    try {
        const { userId } = req.params;
        const { isBlocked } = req.body;

        if (typeof isBlocked !== 'boolean') {
            return res.status(400).json({ message: "isBlocked boolean parameter required." });
        }

        const user = await userModel.findByIdAndUpdate(
            userId,
            { isBlocked },
            { new: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        try {
            await notificationModel.create({
                recipient: user._id,
                sender: req.user?._id || req.user?.id,
                title: isBlocked ? "Account Access Restricted" : "Account Access Restored",
                message: isBlocked 
                    ? "Your account access has been restricted by an administrator." 
                    : "Your account access has been restored.",
                type: "ACCOUNT_STATUS"
            });
        } catch (nErr) { console.error("Notification creation failed:", nErr); }

        return res.status(200).json({
            message: `User ${user.username} is now ${user.isBlocked ? 'BLOCKED' : 'UNBLOCKED'}.`,
            user
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to update block status." });
    }
}

/**
 * @name grantUserCreditsController
 * @description Grant custom bonus credits to a user by email or User ID
 * @access Private (Admin Only)
 */
async function grantUserCreditsController(req, res) {
    try {
        const { identifier, bonusCredits } = req.body;

        if (!identifier || typeof bonusCredits !== 'number') {
            return res.status(400).json({ message: "User identifier (email or ID) and numeric bonusCredits required." });
        }

        let query = {};
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            query = { _id: identifier };
        } else {
            query = { email: identifier.trim().toLowerCase() };
        }

        const user = await userModel.findOne(query);
        if (!user) {
            return res.status(404).json({ message: `No user found for identifier '${identifier}'.` });
        }

        user.customBonusCredits = Math.max(0, (user.customBonusCredits || 0) + bonusCredits);
        await user.save();

        try {
            await notificationModel.create({
                recipient: user._id,
                sender: req.user?._id || req.user?.id,
                title: "Bonus Credits Received",
                message: `You have received +${bonusCredits} bonus credits from an administrator. New bonus balance: ${user.customBonusCredits}.`,
                type: "CREDIT_UPDATE"
            });
        } catch (nErr) { console.error("Notification creation failed:", nErr); }

        return res.status(200).json({
            message: `Successfully added ${bonusCredits} bonus credits to ${user.email}. New total bonus credits: ${user.customBonusCredits}.`,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                customBonusCredits: user.customBonusCredits
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to grant credits." });
    }
}

/**
 * @name updateUserFeatureAccessController
 * @description Update granular feature access booleans for a specific user
 * @access Private (Admin Only)
 */
async function updateUserFeatureAccessController(req, res) {
    try {
        const { userId } = req.params;
        const { blockedFeatures } = req.body;

        if (!blockedFeatures || typeof blockedFeatures !== 'object') {
            return res.status(400).json({ message: "blockedFeatures object required." });
        }

        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        user.blockedFeatures = {
            aiAssistant: Boolean(blockedFeatures.aiAssistant),
            resumeGeneration: Boolean(blockedFeatures.resumeGeneration),
            coverLetterGeneration: Boolean(blockedFeatures.coverLetterGeneration),
            interviewReports: Boolean(blockedFeatures.interviewReports)
        };

        await user.save();

        try {
            const blockedList = [];
            if (user.blockedFeatures.aiAssistant) blockedList.push("AI Assistant");
            if (user.blockedFeatures.resumeGeneration) blockedList.push("Resume Generation");
            if (user.blockedFeatures.coverLetterGeneration) blockedList.push("Cover Letter Generator");
            if (user.blockedFeatures.interviewReports) blockedList.push("Interview Reports");

            const details = blockedList.length > 0 
                ? `Restricted features: ${blockedList.join(", ")}.` 
                : "All features are now fully enabled.";

            await notificationModel.create({
                recipient: user._id,
                sender: req.user?._id || req.user?.id,
                title: "Feature Permissions Updated",
                message: `An administrator updated feature permissions on your account. ${details}`,
                type: "FEATURE_UPDATE"
            });
        } catch (nErr) { console.error("Notification creation failed:", nErr); }

        return res.status(200).json({
            message: `Feature access permissions updated for ${user.email}.`,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                blockedFeatures: user.blockedFeatures
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to update feature access." });
    }
}

/**
 * @name getUserByIdController
 * @description Fetch single user profile details by User ID for evaluation page
 * @access Private (Admin Only)
 */
async function getUserByIdController(req, res) {
    try {
        const { userId } = req.params;
        const user = await userModel.findById(userId).select("username email plan role isBlocked customBonusCredits customAiBonusCredits blockedFeatures createdAt");
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        return res.status(200).json({ user });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch user details." });
    }
}

/**
 * @name adjustUserCreditsController
 * @description Increase or reduce user custom bonus credits (Generations & AI Assistant)
 * @access Private (Admin Only)
 */
async function adjustUserCreditsController(req, res) {
    try {
        const { userId } = req.params;
        const { customBonusCredits, customAiBonusCredits, target, action, amount } = req.body;

        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Mode 1: Direct setting via sliders / numeric values (can be negative or positive)
        if (typeof customBonusCredits === 'number' || typeof customAiBonusCredits === 'number') {
            if (typeof customBonusCredits === 'number') {
                user.customBonusCredits = customBonusCredits;
            }
            if (typeof customAiBonusCredits === 'number') {
                user.customAiBonusCredits = customAiBonusCredits;
            }
        } 
        // Mode 2: Targeted increment / reduction
        else if (target && action && typeof amount === 'number') {
            const delta = action === 'increase' ? amount : -amount;
            if (target === 'ai') {
                user.customAiBonusCredits = (user.customAiBonusCredits || 0) + delta;
            } else {
                user.customBonusCredits = (user.customBonusCredits || 0) + delta;
            }
        } else {
            return res.status(400).json({ message: "Valid credit modification parameters required." });
        }

        await user.save();

        try {
            await notificationModel.create({
                recipient: user._id,
                sender: req.user?._id || req.user?.id,
                title: "Credit Balance Adjusted",
                message: `An administrator updated your bonus credits. Generation Bonus: ${user.customBonusCredits > 0 ? '+' : ''}${user.customBonusCredits}, AI Assistant Bonus: ${user.customAiBonusCredits > 0 ? '+' : ''}${user.customAiBonusCredits}.`,
                type: "CREDIT_UPDATE"
            });
        } catch (nErr) { console.error("Notification creation failed:", nErr); }

        return res.status(200).json({
            message: `Updated credits for ${user.email}. Generation Bonus: ${user.customBonusCredits}, AI Bonus: ${user.customAiBonusCredits}.`,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                customBonusCredits: user.customBonusCredits,
                customAiBonusCredits: user.customAiBonusCredits
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to adjust user credits." });
    }
}

/**
 * @name sendAdminMessageController
 * @description Send notification message to single user, specific plan users, or all users
 * @access Private (Admin Only)
 */
async function sendAdminMessageController(req, res) {
    try {
        const { targetType, targetValue, title, message } = req.body;
        const senderId = req.user?._id || req.user?.id;

        if (!title || !title.trim() || !message || !message.trim()) {
            return res.status(400).json({ message: "Both notification title and message text are required." });
        }

        const validTypes = ['all', 'free', 'pro', 'premium', 'user', 'plan'];
        if (!targetType || !validTypes.includes(targetType)) {
            return res.status(400).json({ message: "Invalid targetType selected." });
        }

        let recipients = [];

        if (targetType === 'user') {
            if (!targetValue || !targetValue.trim()) {
                return res.status(400).json({ message: "User email or ID required for individual user." });
            }
            let query = {};
            if (mongoose.Types.ObjectId.isValid(targetValue.trim())) {
                query = { _id: targetValue.trim() };
            } else {
                query = { email: targetValue.trim().toLowerCase() };
            }
            const targetUser = await userModel.findOne(query);
            if (!targetUser) {
                return res.status(404).json({ message: `No user found for identifier '${targetValue}'.` });
            }
            recipients = [targetUser._id];
        } else if (['free', 'pro', 'premium'].includes(targetType)) {
            const matchingUsers = await userModel.find({ plan: targetType }).select('_id');
            recipients = matchingUsers.map(u => u._id);
        } else if (targetType === 'plan') {
            const planName = (targetValue || 'free').toLowerCase();
            const matchingUsers = await userModel.find({ plan: planName }).select('_id');
            recipients = matchingUsers.map(u => u._id);
        } else if (targetType === 'all') {
            const allUsers = await userModel.find({}).select('_id');
            recipients = allUsers.map(u => u._id);
        }

        if (recipients.length === 0) {
            return res.status(404).json({ message: "No matching users found to send message to." });
        }

        const notificationDocs = recipients.map(recipientId => ({
            recipient: recipientId,
            sender: senderId,
            title: title.trim(),
            message: message.trim(),
            type: 'SYSTEM',
            createdAt: new Date()
        }));

        await notificationModel.insertMany(notificationDocs);

        return res.status(200).json({
            message: `Successfully sent message to ${recipients.length} user(s).`,
            recipientsCount: recipients.length
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to send admin message." });
    }
}

/**
 * @name getAdminPaymentsController
 * @description Get list of payments with filtering & revenue totals
 */
async function getAdminPaymentsController(req, res) {
    try {
        const Payment = require("../models/payment.model");
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const status = req.query.status;

        const filter = {};
        if (status) {
            filter.status = status.toUpperCase();
        }

        const [payments, totalCount, statsAgg] = await Promise.all([
            Payment.find(filter)
                .populate('userId', 'username email plan')
                .populate('orderId', 'planKey billingCycle amount gatewayOrderId')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Payment.countDocuments(filter),
            Payment.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ])
        ]);

        const summary = {
            totalRevenuePaise: 0,
            successCount: 0,
            failedCount: 0,
            refundedCount: 0
        };

        statsAgg.forEach(s => {
            if (s._id === 'SUCCESS') {
                summary.totalRevenuePaise = s.totalAmount;
                summary.successCount = s.count;
            } else if (s._id === 'FAILED') {
                summary.failedCount = s.count;
            } else if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(s._id)) {
                summary.refundedCount += s.count;
            }
        });

        return res.status(200).json({
            success: true,
            data: payments,
            summary: {
                ...summary,
                totalRevenueRupees: (summary.totalRevenuePaise / 100).toFixed(2)
            },
            pagination: {
                total: totalCount,
                page,
                pages: Math.ceil(totalCount / limit) || 1,
                limit
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch payments." });
    }
}

/**
 * @name getAdminSubscriptionsController
 * @description Get all subscriptions with tier breakdowns
 */
async function getAdminSubscriptionsController(req, res) {
    try {
        const Subscription = require("../models/subscription.model");
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const plan = req.query.plan;
        const status = req.query.status;

        const filter = {};
        if (plan) filter.plan = plan.toLowerCase();
        if (status) filter.status = status.toUpperCase();

        const [subscriptions, totalCount, statusAgg] = await Promise.all([
            Subscription.find(filter)
                .populate('userId', 'username email plan isBlocked')
                .populate('planId', 'name price features')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Subscription.countDocuments(filter),
            Subscription.aggregate([
                {
                    $group: {
                        _id: { plan: '$plan', status: '$status' },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const tierCounts = { pro: 0, premium: 0, activeTotal: 0, cancelledTotal: 0 };
        statusAgg.forEach(s => {
            if (s._id.status === 'ACTIVE') {
                tierCounts.activeTotal += s.count;
                if (s._id.plan === 'pro') tierCounts.pro += s.count;
                if (s._id.plan === 'premium') tierCounts.premium += s.count;
            } else if (s._id.status === 'CANCELLED') {
                tierCounts.cancelledTotal += s.count;
            }
        });

        return res.status(200).json({
            success: true,
            data: subscriptions,
            tierCounts,
            pagination: {
                total: totalCount,
                page,
                pages: Math.ceil(totalCount / limit) || 1,
                limit
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch subscriptions." });
    }
}

/**
 * @name getAdminAuditLogsController
 * @description Get subscription and payment state transition audit logs
 */
async function getAdminAuditLogsController(req, res) {
    try {
        const SubscriptionEvent = require("../models/subscriptionEvent.model");
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const eventType = req.query.eventType;

        const filter = {};
        if (eventType) filter.eventType = eventType.toUpperCase();

        const [events, totalCount] = await Promise.all([
            SubscriptionEvent.find(filter)
                .populate('userId', 'username email plan')
                .populate('paymentOrderId', 'amount currency gatewayOrderId')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            SubscriptionEvent.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            data: events,
            pagination: {
                total: totalCount,
                page,
                pages: Math.ceil(totalCount / limit) || 1,
                limit
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch audit logs." });
    }
}

/**
 * @name getAdminInvoicesController
 * @description Get all tax invoices
 */
async function getAdminInvoicesController(req, res) {
    try {
        const { Invoice } = require("../models/invoice.model");
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

        const [invoices, totalCount] = await Promise.all([
            Invoice.find()
                .populate('userId', 'username email')
                .sort({ issuedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Invoice.countDocuments()
        ]);

        return res.status(200).json({
            success: true,
            data: invoices,
            pagination: {
                total: totalCount,
                page,
                pages: Math.ceil(totalCount / limit) || 1,
                limit
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch invoices." });
    }
}

module.exports = {
    getAdminStatsController,
    getAdminUsersController,
    updateUserRoleController,
    createAdminAccountController,
    updateUserPlanController,
    toggleUserBlockController,
    grantUserCreditsController,
    updateUserFeatureAccessController,
    getUserByIdController,
    adjustUserCreditsController,
    sendAdminMessageController,
    getAdminPaymentsController,
    getAdminSubscriptionsController,
    getAdminAuditLogsController,
    getAdminInvoicesController
};
