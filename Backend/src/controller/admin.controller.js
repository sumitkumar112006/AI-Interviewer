const userModel = require("../models/user.model");
const interviewReportModel = require("../models/interviewReport.model");
const coverLetterModel = require("../models/coverLetter.model");
const subscriptionModel = require("../models/subscription.model");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const notificationModel = require("../models/notification.model");
const { recordAdminAudit } = require("../services/auditLog.service");
const { ALL_ROLES, PERMISSIONS } = require("../config/rbac.config");
const { getUserActivitySummary, getUserActivityAnalytics } = require("../services/userActivity.service");

/**
 * @name getAdminStatsController
 * @description Get overall platform statistics for the admin dashboard
 * @access Private (Admin Only)
 */
async function getAdminStatsController(req, res) {
    try {
        const [totalUsers, totalAdmins, totalReports, totalCoverLetters, blockedUsers, activitySummary] = await Promise.all([
            userModel.countDocuments({ isDeleted: { $ne: true } }),
            userModel.countDocuments({ role: { $ne: 'user' }, isDeleted: { $ne: true } }),
            interviewReportModel.countDocuments(),
            coverLetterModel.countDocuments(),
            userModel.countDocuments({ isBlocked: true, isDeleted: { $ne: true } }),
            getUserActivitySummary().catch(err => {
                console.warn('[ADMIN STATS] Activity summary fallback:', err.message);
                return { dau: 0, wau: 0, mau: 0, dormant: 0, newLast7Days: 0, returningLast7Days: 0 };
            })
        ]);

        const planCounts = await userModel.aggregate([
            { $match: { isDeleted: { $ne: true } } },
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
                $match: { isDeleted: { $ne: true } }
            },
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
                dailyRegistrations,
                activity: activitySummary
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
        const { search = "", plan = "", role = "", blocked = "", deleted = "", activity = "", page = 1, limit = 20 } = req.query;

        const query = {};

        if (deleted === "true") {
            query.isDeleted = true;
        } else if (deleted !== "all") {
            query.isDeleted = { $ne: true };
        }

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

        // Activity filter handling
        if (activity) {
            const now = new Date();
            if (activity === 'today') {
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                query.lastActiveAt = { $gte: startOfToday };
            } else if (activity === '7d') {
                const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                query.lastActiveAt = { $gte: sevenDaysAgo };
            } else if (activity === '30d') {
                const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                query.lastActiveAt = { $gte: thirtyDaysAgo };
            } else if (activity === 'dormant') {
                const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                const thirtyDaysHex = Math.floor(thirtyDaysAgo.getTime() / 1000).toString(16).padEnd(24, '0');
                const thirtyDaysObjectId = new mongoose.Types.ObjectId(thirtyDaysHex);

                query.$and = (query.$and || []).concat([
                    {
                        $or: [
                            { lastActiveAt: { $lt: thirtyDaysAgo } },
                            {
                                lastActiveAt: null,
                                $or: [
                                    { createdAt: { $lt: thirtyDaysAgo } },
                                    { createdAt: null, _id: { $lt: thirtyDaysObjectId } }
                                ]
                            }
                        ]
                    }
                ]);
            } else if (activity === 'never') {
                query.lastActiveAt = null;
            }
        }

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        const [accounts, total] = await Promise.all([
            userModel.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            userModel.countDocuments(query)
        ]);

        // Aggregate generated report, resume, and cover letter counts for each account
        const accountIds = accounts.map(u => u._id);

        const [reportCounts, coverLetterCounts, resumeCounts] = await Promise.all([
            interviewReportModel.aggregate([
                { $match: { user: { $in: accountIds } } },
                { $group: { _id: "$user", count: { $sum: 1 } } }
            ]),
            coverLetterModel.aggregate([
                { $match: { user: { $in: accountIds } } },
                { $group: { _id: "$user", count: { $sum: 1 } } }
            ]),
            interviewReportModel.aggregate([
                { $match: { user: { $in: accountIds }, $or: [{ generatedResumeHtml: { $exists: true, $ne: "" } }, { resume: { $exists: true, $ne: "" } }] } },
                { $group: { _id: "$user", count: { $sum: 1 } } }
            ])
        ]);

        const reportMap = {};
        reportCounts.forEach(r => { reportMap[r._id.toString()] = r.count; });

        const coverLetterMap = {};
        coverLetterCounts.forEach(c => { coverLetterMap[c._id.toString()] = c.count; });

        const resumeMap = {};
        resumeCounts.forEach(res => { resumeMap[res._id.toString()] = res.count; });

        const enrichedUsers = accounts.map(u => ({
            ...u,
            totalReports: reportMap[u._id.toString()] || 0,
            totalResumes: resumeMap[u._id.toString()] || 0, totalCoverLetters: coverLetterMap[u._id.toString()] || 0
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
        const { role, reason } = req.body;

        const validRoles = ALL_ROLES;
        if (!role || !validRoles.includes(role.toLowerCase())) {
            return res.status(400).json({ message: `Invalid role "${role}". Allowed: ${ALL_ROLES.join(', ')}.` });
        }

        const targetRole = role.toLowerCase();
        const requesterRole = req.user?.role || 'admin';
        const requesterId = req.user?.id || req.user?._id?.toString();

        const existingUser = await userModel.findById(userId).select("username email role");
        if (!existingUser) {
            return res.status(404).json({ message: "Account not found." });
        }

        // Privilege Escalation Guard 1: Ordinary admin cannot self-promote or modify own role
        if (requesterId && requesterId === userId.toString() && requesterRole !== 'super_admin' && targetRole !== existingUser.role) {
            await recordAdminAudit({
                req,
                action: 'PRIVILEGE_ESCALATION_BLOCKED',
                category: 'SECURITY',
                severity: 'CRITICAL',
                targetId: existingUser._id,
                targetType: 'User',
                targetIdentifier: `${existingUser.username} (${existingUser.email})`,
                changeSummary: `Administrator "${req.user.username}" attempted unauthorized self-role modification.`,
                reason: reason || 'Self-role alteration attempt'
            });
            return res.status(403).json({ message: "Privilege escalation prevented: You cannot alter your own administrative role." });
        }

        // Privilege Escalation Guard 2: Ordinary admin cannot promote anyone to super_admin
        if (targetRole === 'super_admin' && requesterRole !== 'super_admin') {
            await recordAdminAudit({
                req,
                action: 'PRIVILEGE_ESCALATION_BLOCKED',
                category: 'SECURITY',
                severity: 'CRITICAL',
                targetId: existingUser._id,
                targetType: 'User',
                targetIdentifier: `${existingUser.username} (${existingUser.email})`,
                changeSummary: `Administrator "${req.user.username}" attempted to promote "${existingUser.username}" to Super Administrator without authorization.`,
                reason: reason || 'Unauthorized promotion to super_admin'
            });
            return res.status(403).json({ message: "Privilege escalation prevented: Only a Super Administrator can promote accounts to Super Administrator." });
        }

        // Privilege Escalation Guard 3: Ordinary admin cannot modify an existing super_admin's role
        if (existingUser.role === 'super_admin' && requesterRole !== 'super_admin') {
            await recordAdminAudit({
                req,
                action: 'PRIVILEGE_ESCALATION_BLOCKED',
                category: 'SECURITY',
                severity: 'CRITICAL',
                targetId: existingUser._id,
                targetType: 'User',
                targetIdentifier: `${existingUser.username} (${existingUser.email})`,
                changeSummary: `Administrator "${req.user.username}" attempted to modify Super Administrator "${existingUser.username}" without authorization.`,
                reason: reason || 'Unauthorized modification of super_admin role'
            });
            return res.status(403).json({ message: "Privilege escalation prevented: Only a Super Administrator can modify privileges of a Super Administrator." });
        }

        const oldRole = existingUser.role;
        existingUser.role = targetRole;
        await existingUser.save();

        await recordAdminAudit({
            req,
            action: 'USER_ROLE_CHANGED',
            category: 'ADMIN',
            severity: 'WARN',
            targetId: existingUser._id,
            targetType: 'User',
            targetIdentifier: `${existingUser.username} (${existingUser.email})`,
            before: { role: oldRole },
            after: { role: targetRole },
            changeSummary: `Changed role from "${oldRole}" to "${targetRole}" for user ${existingUser.username}`,
            reason
        });

        return res.status(200).json({
            message: `User ${existingUser.username} (${existingUser.email}) role updated to '${targetRole.toUpperCase()}'.`,
            user: existingUser
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

        const requestedRole = ALL_ROLES.includes(role.toLowerCase()) ? role.toLowerCase() : 'admin';
        const requesterRole = req.user?.role || 'admin';

        // Privilege Escalation Guard: Only Super Admins can create new Super Admin accounts
        if (requestedRole === 'super_admin' && requesterRole !== 'super_admin') {
            await recordAdminAudit({
                req,
                action: 'PRIVILEGE_ESCALATION_BLOCKED',
                category: 'SECURITY',
                severity: 'CRITICAL',
                targetIdentifier: email.trim().toLowerCase(),
                targetType: 'AdminAccount',
                changeSummary: `Administrator "${req.user.username}" attempted to register a new Super Administrator without authorization.`,
                reason: req.body?.reason || 'Unauthorized creation of super_admin account'
            });
            return res.status(403).json({
                message: "Privilege escalation prevented: Only a Super Administrator can create a Super Administrator account."
            });
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
            role: requestedRole,
            isVerified: true,
            plan: 'premium'
        });

        await recordAdminAudit({
            req,
            action: 'ADMIN_CREATED',
            category: 'ADMIN',
            severity: 'WARN',
            targetId: newAdmin._id,
            targetType: 'AdminAccount',
            targetIdentifier: `${newAdmin.username} (${newAdmin.email})`,
            before: null,
            after: { username: newAdmin.username, email: newAdmin.email, role: newAdmin.role },
            changeSummary: `Created new administrator account "${newAdmin.username}" with role "${newAdmin.role}"`,
            reason: req.body?.reason
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
        const { plan, reason } = req.body;

        if (!plan || !['free', 'pro', 'premium'].includes(plan.toLowerCase())) {
            return res.status(400).json({ message: "Invalid plan. Allowed: 'free', 'pro', 'premium'." });
        }

        const normalizedPlan = plan.toLowerCase();
        const now = new Date();
        const newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const existingUser = await userModel.findById(userId).select("username email plan");
        if (!existingUser) {
            return res.status(404).json({ message: "User not found." });
        }
        const oldPlan = existingUser.plan || 'free';

        // Update user plan and reset generation credits for the new billing period
        const user = await userModel.findByIdAndUpdate(
            userId,
            {
                plan: normalizedPlan,
                generationsUsed: 0,
                generationsResetAt: newPeriodEnd
            },
            { returnDocument: 'after' }
        ).select("-password");

        // Create or update subscription document
        await subscriptionModel.findOneAndUpdate(
            { userId: userId },
            {
                plan: normalizedPlan,
                status: 'ACTIVE',
                startedAt: now,
                currentPeriodStart: now,
                currentPeriodEnd: newPeriodEnd,
                cancelAtPeriodEnd: false
            },
            { upsert: true, returnDocument: 'after' }
        );

        await recordAdminAudit({
            req,
            action: 'USER_PLAN_CHANGED',
            category: 'ADMIN',
            severity: 'INFO',
            targetId: user._id,
            targetType: 'User',
            targetIdentifier: `${user.username} (${user.email})`,
            before: { plan: oldPlan },
            after: { plan: normalizedPlan },
            changeSummary: `Updated subscription plan from "${oldPlan}" to "${normalizedPlan}" for user ${user.username}`,
            reason
        });

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
        const { isBlocked, reason } = req.body;

        if (typeof isBlocked !== 'boolean') {
            return res.status(400).json({ message: "isBlocked boolean parameter required." });
        }

        const requesterRole = req.user?.role || 'admin';
        const requesterId = req.user?.id || req.user?._id?.toString();

        // Prevent admin from blocking themselves
        if (requesterId && requesterId === userId.toString()) {
            return res.status(400).json({ message: "You cannot suspend your own administrative account." });
        }

        const existingUser = await userModel.findById(userId).select("username email role isBlocked");
        if (!existingUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // Privilege Escalation Guard: Ordinary admin cannot suspend a super_admin
        if (existingUser.role === 'super_admin' && requesterRole !== 'super_admin') {
            await recordAdminAudit({
                req,
                action: 'PRIVILEGE_ESCALATION_BLOCKED',
                category: 'SECURITY',
                severity: 'CRITICAL',
                targetId: existingUser._id,
                targetType: 'User',
                targetIdentifier: `${existingUser.username} (${existingUser.email})`,
                changeSummary: `Administrator "${req.user.username}" attempted to suspend Super Administrator "${existingUser.username}" without authorization.`,
                reason: reason || 'Unauthorized suspension attempt on super_admin'
            });
            return res.status(403).json({ message: "Privilege escalation prevented: Ordinary administrators cannot suspend a Super Administrator." });
        }

        const oldBlocked = Boolean(existingUser.isBlocked);

        const user = await userModel.findByIdAndUpdate(
            userId,
            { isBlocked },
            { returnDocument: 'after' }
        ).select("-password");

        await recordAdminAudit({
            req,
            action: isBlocked ? 'USER_SUSPENDED' : 'USER_RESTORED',
            category: 'ADMIN',
            severity: isBlocked ? 'WARN' : 'INFO',
            targetId: user._id,
            targetType: 'User',
            targetIdentifier: `${user.username} (${user.email})`,
            before: { isBlocked: oldBlocked },
            after: { isBlocked },
            changeSummary: `${isBlocked ? 'Suspended' : 'Restored'} user account ${user.username} (${user.email})`,
            reason
        });

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

        const oldCredits = user.customBonusCredits || 0;
        user.customBonusCredits = Math.max(0, (user.customBonusCredits || 0) + bonusCredits);
        await user.save();

        await recordAdminAudit({
            req,
            action: 'CREDITS_GRANTED',
            category: 'ADMIN',
            severity: 'INFO',
            targetId: user._id,
            targetType: 'User',
            targetIdentifier: `${user.username} (${user.email})`,
            before: { customBonusCredits: oldCredits },
            after: { customBonusCredits: user.customBonusCredits },
            changeSummary: `Granted ${bonusCredits >= 0 ? '+' : ''}${bonusCredits} bonus credits to ${user.username}. New balance: ${user.customBonusCredits}`,
            reason: req.body?.reason
        });

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

        const oldFeatures = { ...(user.blockedFeatures || {}) };
        user.blockedFeatures = {
            aiAssistant: Boolean(blockedFeatures.aiAssistant),
            resumeGeneration: Boolean(blockedFeatures.resumeGeneration),
            coverLetterGeneration: Boolean(blockedFeatures.coverLetterGeneration),
            interviewReports: Boolean(blockedFeatures.interviewReports)
        };

        await user.save();

        await recordAdminAudit({
            req,
            action: 'FEATURE_ACCESS_CHANGED',
            category: 'ADMIN',
            severity: 'INFO',
            targetId: user._id,
            targetType: 'FeatureMatrix',
            targetIdentifier: `${user.username} (${user.email})`,
            before: { blockedFeatures: oldFeatures },
            after: { blockedFeatures: user.blockedFeatures },
            changeSummary: `Updated feature access permissions for ${user.username}`,
            reason: req.body?.reason
        });

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

        const [user, reports, coverLetters] = await Promise.all([
            userModel.findById(userId).select("username email plan role isBlocked customBonusCredits customAiBonusCredits blockedFeatures createdAt lastActiveAt").lean(),
            interviewReportModel.find({ user: userId })
                .select("_id developerTitle matchScore createdAt generatedResumeHtml resume jobDescription")
                .sort({ createdAt: -1 })
                .lean(),
            coverLetterModel.find({ user: userId })
                .select("_id roleName companyName generatedContent createdAt interviewReport")
                .sort({ createdAt: -1 })
                .lean()
        ]);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const totalReports = reports.length;
        const totalCoverLetters = coverLetters.length;
        const resumes = reports.filter(r => (r.generatedResumeHtml && r.generatedResumeHtml.trim() !== '') || (r.resume && r.resume.trim() !== ''));
        const totalResumes = resumes.length;

        return res.status(200).json({
            user: {
                ...user,
                totalReports,
                totalResumes,
                totalCoverLetters
            },
            reports,
            resumes,
            coverLetters,
            stats: {
                totalReports,
                totalResumes,
                totalCoverLetters
            }
        });
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

        const oldGen = user.customBonusCredits || 0;
        const oldAi = user.customAiBonusCredits || 0;

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

        await recordAdminAudit({
            req,
            action: 'CREDITS_ADJUSTED',
            category: 'ADMIN',
            severity: 'INFO',
            targetId: user._id,
            targetType: 'User',
            targetIdentifier: `${user.username} (${user.email})`,
            before: { customBonusCredits: oldGen, customAiBonusCredits: oldAi },
            after: { customBonusCredits: user.customBonusCredits, customAiBonusCredits: user.customAiBonusCredits },
            changeSummary: `Adjusted credits for ${user.username}: Generation (${oldGen} -> ${user.customBonusCredits}), AI (${oldAi} -> ${user.customAiBonusCredits})`,
            reason: req.body?.reason
        });

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

        await recordAdminAudit({
            req,
            action: 'BROADCAST_SENT',
            category: 'ADMIN',
            severity: 'INFO',
            targetType: 'Notification',
            targetIdentifier: `Target: ${targetType} (${recipients.length} recipients)`,
            after: { title: title.trim(), targetType, recipientsCount: recipients.length },
            changeSummary: `Sent broadcast notification "${title.trim()}" to ${recipients.length} user(s) (target: ${targetType})`
        });

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
                .populate('userId', 'username email plan isDeleted')
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
        if (plan) filter.plan = { $regex: new RegExp(`^${plan.trim()}$`, 'i') };
        if (status) filter.status = { $regex: new RegExp(`^${status.trim()}$`, 'i') };

        const [subscriptions, totalCount, statusAgg] = await Promise.all([
            Subscription.find(filter)
                .populate('userId', 'username email plan isBlocked isDeleted')
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

        const tierCounts = { pro: 0, premium: 0, free: 0, activeTotal: 0, cancelledTotal: 0 };
        statusAgg.forEach(s => {
            const normStatus = (s._id.status || '').toUpperCase();
            const normPlan = (s._id.plan || '').toLowerCase();
            if (normStatus === 'ACTIVE') {
                tierCounts.activeTotal += s.count;
                if (normPlan === 'pro') tierCounts.pro += s.count;
                if (normPlan === 'premium') tierCounts.premium += s.count;
                if (normPlan === 'free') tierCounts.free += s.count;
            } else if (normStatus === 'CANCELLED') {
                tierCounts.cancelledTotal += s.count;
            }
        });

        // Normalize legacy records for consistent client-side presentation
        subscriptions.forEach(s => {
            if (s.status) s.status = s.status.toUpperCase();
            if (!s.currentPeriodStart && s.startedAt) {
                s.currentPeriodStart = s.startedAt;
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
 * @name getSubscriptionReconciliationController
 * @description Get comprehensive forensic diagnostic reconciliation of Users, Subscriptions, Payments, and Invoices
 */
async function getSubscriptionReconciliationController(req, res) {
    try {
        const { getSubscriptionAndFinancialReconciliation } = require('../services/subscriptionReconciliation.service');
        const data = await getSubscriptionAndFinancialReconciliation();
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error('Reconciliation diagnostic error:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to execute subscription and financial reconciliation diagnostic.'
        });
    }
}

/**
 * @name getAdminAuditLogsController
 * @description Get subscription and payment state transition audit logs
 */
async function getAdminAuditLogsController(req, res) {
    try {
        const source = (req.query.source || 'system').toLowerCase();
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));

        // Subscriptions source: Legacy fallback
        if (source === 'subscriptions') {
            const SubscriptionEvent = require("../models/subscriptionEvent.model");
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
                source: 'subscriptions',
                data: events,
                pagination: {
                    total: totalCount,
                    page,
                    pages: Math.ceil(totalCount / limit) || 1,
                    limit
                }
            });
        }

        // Primary source: SystemEvent (Persistent, append-only admin audit trail)
        const { SystemEvent } = require("../models/systemEvent.model");
        const filter = {};

        if (req.query.category && req.query.category !== 'ALL') {
            filter.category = req.query.category.toUpperCase();
        }

        if (req.query.severity && req.query.severity !== 'ALL') {
            filter.severity = req.query.severity.toUpperCase();
        }

        const actionFilter = req.query.action || req.query.eventType;
        if (actionFilter && actionFilter !== 'ALL') {
            const trimmedAction = actionFilter.trim();
            filter.$or = [
                { eventType: trimmedAction },
                { 'details.action': trimmedAction }
            ];
        }

        // Date range filtering
        if (req.query.startDate || req.query.endDate) {
            filter.createdAt = {};
            if (req.query.startDate) {
                filter.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                const end = new Date(req.query.endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        // Keyword search across actor, target, summary, action
        if (req.query.search && req.query.search.trim()) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            const matchingUsers = await userModel.find({
                $or: [{ username: searchRegex }, { email: searchRegex }]
            }).select('_id').lean();
            const userIds = matchingUsers.map(u => u._id);

            const searchOr = [
                { 'details.targetIdentifier': searchRegex },
                { 'details.changeSummary': searchRegex },
                { 'details.action': searchRegex },
                { eventType: searchRegex }
            ];

            if (userIds.length > 0) {
                searchOr.push({ actorId: { $in: userIds } });
                searchOr.push({ targetId: { $in: userIds } });
            }

            if (filter.$or) {
                filter.$and = filter.$and || [];
                filter.$and.push({ $or: filter.$or });
                delete filter.$or;
                filter.$and.push({ $or: searchOr });
            } else {
                filter.$or = searchOr;
            }
        }

        const [events, totalCount] = await Promise.all([
            SystemEvent.find(filter)
                .populate('actorId', 'username email role')
                .populate('targetId', 'username email role')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            SystemEvent.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            source: 'system',
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
 * @name getAdminSystemEventsController
 * @description Get system operational events and audit logs with pagination and severity filter
 */
async function getAdminSystemEventsController(req, res) {
    try {
        const { SystemEvent } = require("../models/systemEvent.model");
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const { severity, category, eventType, startDate, endDate, search } = req.query;

        const filter = {};
        if (severity) filter.severity = severity.toUpperCase();
        if (category) filter.category = category.toUpperCase();
        if (eventType) filter.eventType = eventType.trim();

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate && !isNaN(new Date(startDate).getTime())) filter.createdAt.$gte = new Date(startDate);
            if (endDate && !isNaN(new Date(endDate).getTime())) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = e;
            }
        }

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { eventType: searchRegex },
                { 'details.message': searchRegex },
                { 'details.action': searchRegex },
                { targetType: searchRegex }
            ];
        }

        const [events, totalCount, categoryCounts, severityCounts] = await Promise.all([
            SystemEvent.find(filter)
                .populate('actorId', 'username email role')
                .populate('targetId', 'username email role')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            SystemEvent.countDocuments(filter),
            SystemEvent.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ]),
            SystemEvent.aggregate([
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ])
        ]);

        const catMap = {};
        categoryCounts.forEach(c => { if (c._id) catMap[c._id] = c.count; });
        const sevMap = {};
        severityCounts.forEach(s => { if (s._id) sevMap[s._id] = s.count; });

        return res.status(200).json({
            success: true,
            data: events,
            metrics: {
                categories: catMap,
                severities: sevMap
            },
            pagination: {
                total: totalCount,
                page,
                pages: Math.ceil(totalCount / limit) || 1,
                limit
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch system events." });
    }
}

/**
 * @name getAdminInvoicesController
 * @description Search, filter & list all tax invoices with server-side pagination & revenue summaries
 * @access Private (Admin Only)
 */
async function getAdminInvoicesController(req, res) {
    try {
        const { Invoice } = require("../models/invoice.model");
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const { status, search, startDate, endDate } = req.query;

        const filter = {};

        // 1. Status Filter (ISSUED, PAID, VOID)
        if (status && ['ISSUED', 'PAID', 'VOID'].includes(status.toUpperCase())) {
            filter.status = status.toUpperCase();
        }

        // 2. Date Range Filter (issuedAt)
        if (startDate || endDate) {
            filter.issuedAt = {};
            if (startDate) {
                const start = new Date(startDate);
                if (!isNaN(start.getTime())) filter.issuedAt.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    filter.issuedAt.$lte = end;
                }
            }
        }

        // 3. Search Filter (invoiceNumber, billTo name/email, or userId)
        if (search && search.trim()) {
            const cleanSearch = search.trim();
            const searchRegex = new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

            // Find matching user accounts to match on userId
            const matchingUsers = await userModel.find({
                $or: [
                    { username: searchRegex },
                    { email: searchRegex }
                ]
            }).select('_id').limit(50).lean();

            const userIds = matchingUsers.map(u => u._id);

            filter.$or = [
                { invoiceNumber: searchRegex },
                { 'billTo.name': searchRegex },
                { 'billTo.email': searchRegex }
            ];

            if (userIds.length > 0) {
                filter.$or.push({ userId: { $in: userIds } });
            }

            if (mongoose.Types.ObjectId.isValid(cleanSearch)) {
                filter.$or.push({ userId: new mongoose.Types.ObjectId(cleanSearch) });
                filter.$or.push({ _id: new mongoose.Types.ObjectId(cleanSearch) });
            }
        }

        // 4. Parallel Query: Filtered paginated results + Filtered count + Overall Summary
        const [invoices, totalCount, summaryAgg] = await Promise.all([
            Invoice.find(filter)
                .populate('userId', 'username email isDeleted')
                .sort({ issuedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Invoice.countDocuments(filter),
            Invoice.aggregate([
                {
                    $group: {
                        _id: null,
                        totalInvoices: { $sum: 1 },
                        totalRevenuePaise: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'PAID'] }, '$totalAmount', 0]
                            }
                        },
                        paidCount: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0]
                            }
                        },
                        issuedCount: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'ISSUED'] }, 1, 0]
                            }
                        },
                        voidCount: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'VOID'] }, 1, 0]
                            }
                        }
                    }
                }
            ])
        ]);

        const summaryData = summaryAgg[0] || {
            totalInvoices: 0,
            totalRevenuePaise: 0,
            paidCount: 0,
            issuedCount: 0,
            voidCount: 0
        };

        const summary = {
            totalInvoices: summaryData.totalInvoices,
            totalRevenueRupees: (summaryData.totalRevenuePaise / 100).toFixed(2),
            paidCount: summaryData.paidCount,
            issuedCount: summaryData.issuedCount,
            voidCount: summaryData.voidCount
        };

        return res.status(200).json({
            success: true,
            data: invoices,
            summary,
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

/**
 * @name deleteUserController
 * @description Safely archives and anonymizes a user account while strictly preserving
 * financial records (Payments, PaymentOrders, Invoices, SubscriptionEvents) according to
 * legal and tax statutory retention requirements.
 * @access Private (Admin Only)
 */
async function deleteUserController(req, res) {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID." });
        }

        // Prevent admin from deleting themselves
        if (req.user && (req.user._id?.toString() === userId.toString() || req.user.id?.toString() === userId.toString())) {
            return res.status(400).json({ message: "You cannot delete your own admin account while logged in." });
        }

        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User account not found." });
        }

        // Privilege Escalation Guard: Ordinary admin cannot delete or archive a super_admin
        const requesterRole = req.user?.role || 'admin';
        if (user.role === 'super_admin' && requesterRole !== 'super_admin') {
            await recordAdminAudit({
                req,
                action: 'PRIVILEGE_ESCALATION_BLOCKED',
                category: 'SECURITY',
                severity: 'CRITICAL',
                targetId: user._id,
                targetType: 'User',
                targetIdentifier: `${user.username} (${user.email})`,
                changeSummary: `Administrator "${req.user.username}" attempted to delete Super Administrator "${user.username}" without authorization.`,
                reason: req.body?.reason || 'Unauthorized deletion attempt on super_admin'
            });
            return res.status(403).json({
                message: "Privilege escalation prevented: Ordinary administrators cannot delete or archive a Super Administrator."
            });
        }

        // Idempotency: If already archived/deleted, return safe status
        if (user.isDeleted) {
            return res.status(200).json({
                success: true,
                message: `User account "${user.username}" is already archived/deleted.`,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    isDeleted: true,
                    deletedAt: user.deletedAt
                }
            });
        }

        const userSnapshot = {
            username: user.username,
            email: user.email,
            plan: user.plan,
            role: user.role,
            customBonusCredits: user.customBonusCredits
        };

        // 1. Terminate any active subscriptions cleanly to prevent future charges
        const SubscriptionEvent = require("../models/subscriptionEvent.model");
        try {
            const activeSubscriptions = await subscriptionModel.find({
                userId,
                status: { $in: ['ACTIVE', 'active', 'GRACE_PERIOD'] }
            });
            for (const sub of activeSubscriptions) {
                sub.status = 'CANCELLED';
                sub.canceledAt = new Date();
                sub.cancelAtPeriodEnd = false;
                await sub.save();

                await SubscriptionEvent.create({
                    userId,
                    subscriptionId: sub._id,
                    eventType: 'CANCELLED',
                    fromPlan: sub.plan,
                    toPlan: 'free',
                    actorType: 'ADMIN',
                    metadata: {
                        reason: 'Account archived by administrator; financial records preserved'
                    }
                });
            }
        } catch (subErr) {
            console.error("Subscription cancellation during user archival warning:", subErr.message);
        }

        // 2. Remove personal user-generated documents (Right to be Forgotten) & invalidate cache.
        // NOTE: Payments, PaymentOrders, Invoices, and SubscriptionEvents are EXPLICITLY PRESERVED
        // to maintain statutory accounting compliance and financial audit integrity.
        const { deleteCachePattern } = require("../services/redis.service");
        await Promise.allSettled([
            interviewReportModel.deleteMany({ user: userId }),
            coverLetterModel.deleteMany({ user: userId }),
            notificationModel.deleteMany({ recipient: userId }),
            deleteCachePattern(`*${userId}*`)
        ]);

        // 3. Anonymize user personal data and set archival flags (preserves referential integrity for invoices/payments)
        const crypto = require("crypto");
        const anonymizedId = userId.toString().slice(-6);
        const anonymizedUsername = `deleted_user_${anonymizedId}`;
        const anonymizedEmail = `deleted_${userId.toString()}@anonymized.kivi.ai`;
        const unmatchablePassword = `[ACCOUNT_ARCHIVED_${crypto.randomUUID()}]`;

        user.username = anonymizedUsername;
        user.email = anonymizedEmail;
        user.password = unmatchablePassword;
        user.isDeleted = true;
        user.deletedAt = new Date();
        user.anonymizedAt = new Date();
        user.deletionReason = (req.body && req.body.reason) ? String(req.body.reason).slice(0, 500) : "Administrative account archival";
        user.deletedBy = req.user?._id || req.user?.id || null;
        user.isBlocked = true;
        user.role = 'user';
        user.plan = 'free';
        user.customBonusCredits = 0;
        user.customAiBonusCredits = 0;
        user.careerProfile = {
            selfDescription: "",
            targetRole: "",
            targetCompanies: [],
            experienceLevel: "fresher",
            savedDescriptions: [],
            savedRoadmaps: []
        };
        user.blockedFeatures = {
            aiAssistant: true,
            resumeGeneration: true,
            coverLetterGeneration: true,
            interviewReports: true
        };

        await user.save();

        // 4. Record high-importance audit event
        await recordAdminAudit({
            req,
            action: 'USER_DELETED',
            category: 'ADMIN',
            severity: 'WARN',
            targetId: user._id,
            targetType: 'User',
            targetIdentifier: `${userSnapshot.username} (${userSnapshot.email})`,
            before: userSnapshot,
            after: {
                isDeleted: true,
                anonymizedUsername,
                anonymizedEmail,
                financialRecordsPreserved: true
            },
            changeSummary: `Safely archived user "${userSnapshot.username}" (${userSnapshot.email}). Personal content purged; statutory financial transactions, payments, and invoices preserved.`,
            reason: user.deletionReason
        });

        return res.status(200).json({
            success: true,
            message: `User account "${userSnapshot.username}" safely archived and anonymized. All statutory financial, invoice, and payment records were preserved.`,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isDeleted: true,
                deletedAt: user.deletedAt
            }
        });
    } catch (err) {
        console.error("deleteUserController error:", err);
        return res.status(500).json({ message: err.message || "Failed to delete user." });
    }
}

/**
 * @name exportAdminDataController
 * @description Securely stream CSV or XLSX exports for admin modules
 * @access Private (Admin Only)
 */
async function exportAdminDataController(req, res) {
    try {
        const { moduleName } = req.params;
        const { format = 'csv', ...queryParams } = req.query;
        const { streamExport } = require('../services/export.service');

        await streamExport({
            moduleName,
            format,
            queryParams,
            req,
            res
        });
    } catch (err) {
        console.error('Export controller error:', err);
        if (!res.headersSent) {
            return res.status(err.status || 500).json({ message: err.message || 'Export failed.' });
        }
    }
}

/**
 * @name getUserActivityAnalyticsController
 * @description Get aggregated user activity analytics (DAU, WAU, MAU, Dormant, New, Returning)
 * @access Private (Admin Only, Permission: analytics.read)
 */
async function getUserActivityAnalyticsController(req, res) {
    try {
        const { timeframe = '30d', plan = 'all' } = req.query;
        const analytics = await getUserActivityAnalytics({ timeframe, plan });
        return res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (err) {
        console.error('[ADMIN ACTIVITY ANALYTICS ERROR]', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to fetch user activity analytics.'
        });
    }
}

/**
 * @name getAdminSystemHealthController
 * @description Get operational health telemetry for all platform subsystems
 * @access Private (Admin Only, Permission: settings.read | audit.read)
 */
async function getAdminSystemHealthController(req, res) {
    try {
        const { getSystemHealth } = require('../services/systemHealth.service');
        const forceLive = req.query.refresh === 'true';
        const health = await getSystemHealth({ forceLive });
        return res.status(200).json({
            success: true,
            data: health
        });
    } catch (err) {
        console.error('[ADMIN SYSTEM HEALTH ERROR]', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to probe system health.'
        });
    }
}

/**
 * @name getAdminSettingsController
 * @description Retrieve active platform-wide settings configuration
 * @access Private (Permission: settings.read)
 */
async function getAdminSettingsController(req, res) {
    try {
        const appSettingsService = require('../services/appSettings.service');
        const settings = await appSettingsService.getAppSettings();
        return res.status(200).json({
            success: true,
            settings
        });
    } catch (err) {
        console.error('Error in getAdminSettingsController:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve platform settings.'
        });
    }
}

/**
 * @name updateAdminSettingsController
 * @description Update platform-wide settings (maintenance, kill-switches, registration, AI provider, limits)
 * @access Private (Permission: settings.update)
 */
async function updateAdminSettingsController(req, res) {
    try {
        const appSettingsService = require('../services/appSettings.service');
        const updated = await appSettingsService.updateAppSettings(req.body, {
            actorId: req.user?._id,
            actorUsername: req.user?.username || 'admin',
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(200).json({
            success: true,
            message: 'Platform settings updated successfully.',
            settings: updated
        });
    } catch (err) {
        console.error('Error in updateAdminSettingsController:', err);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to update platform settings.'
        });
    }
}

/**
 * @name rollbackAdminVersionController
 * @description Roll back version control configuration to the previous valid configuration
 * @access Private (Permission: settings.update)
 */
async function rollbackAdminVersionController(req, res) {
    try {
        const appSettingsService = require('../services/appSettings.service');
        const rolledBack = await appSettingsService.rollbackVersionControl({
            actorId: req.user?._id,
            actorUsername: req.user?.username || 'admin',
            actorRole: req.user?.role || 'admin',
            req
        });
        return res.status(200).json({
            success: true,
            message: 'Version configuration rolled back to previous valid state successfully.',
            settings: rolledBack
        });
    } catch (err) {
        console.error('Error in rollbackAdminVersionController:', err);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to rollback version configuration.'
        });
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
    getAdminSystemEventsController,
    getAdminSystemHealthController,
    getAdminSettingsController,
    updateAdminSettingsController,
    rollbackAdminVersionController,
    getAdminInvoicesController,
    deleteUserController,
    exportAdminDataController,
    getSubscriptionReconciliationController,
    getUserActivityAnalyticsController
};
