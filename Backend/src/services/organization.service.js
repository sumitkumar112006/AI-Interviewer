/**
 * organization.service.js — B2B Partner & Organization Management Service
 *
 * Implements:
 * 1. Organization lifecycle (create, update, suspend, activate).
 * 2. Organization Administrator assignment and member seat management.
 * 3. Tenant-isolated aggregation metrics (seats, interview/resume volume, ATS performance).
 * 4. Audit trail logging for all sensitive institutional modifications.
 */

'use strict';

const mongoose = require('mongoose');
const Organization = require('../models/organization.model');
const userModel = require('../models/user.model');
const interviewReportModel = require('../models/interviewReport.model');
const coverLetterModel = require('../models/coverLetter.model');
const auditLogService = require('./auditLog.service');

function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'org';
}

/**
 * Create a new partner organization
 */
async function createOrganization(data, context = {}) {
    const { actorId, actorRole = 'admin', req } = context;

    const {
        name,
        type = 'college',
        contact = {},
        agreement = {},
        settings = {},
        adminOwnerId = null
    } = data;

    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new Error('Organization name is required.');
    }

    if (!contact.email || typeof contact.email !== 'string') {
        throw new Error('Primary contact email is required.');
    }

    let baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    while (await Organization.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    const orgAdmins = [];
    let validAdminOwner = null;

    if (adminOwnerId) {
        const ownerUser = await userModel.findById(adminOwnerId);
        if (ownerUser) {
            validAdminOwner = ownerUser._id;
            orgAdmins.push(ownerUser._id);
        }
    }

    const org = await Organization.create({
        name: name.trim(),
        slug,
        type,
        contact: {
            contactPerson: contact.contactPerson?.trim() || '',
            email: contact.email.toLowerCase().trim(),
            phone: contact.phone?.trim() || '',
            website: contact.website?.trim() || '',
            address: contact.address?.trim() || ''
        },
        adminOwner: validAdminOwner,
        orgAdmins,
        agreement: {
            contractId: agreement.contractId?.trim() || '',
            tier: agreement.tier || 'standard',
            validFrom: agreement.validFrom ? new Date(agreement.validFrom) : new Date(),
            validUntil: agreement.validUntil ? new Date(agreement.validUntil) : null,
            maxSeats: Math.max(1, Number(agreement.maxSeats) || 50),
            monthlyInterviewQuota: Math.max(0, Number(agreement.monthlyInterviewQuota) || 500),
            monthlyResumeQuota: Math.max(0, Number(agreement.monthlyResumeQuota) || 500)
        },
        settings: {
            allowedEmailDomains: Array.isArray(settings.allowedEmailDomains)
                ? settings.allowedEmailDomains.map(d => String(d).trim().toLowerCase()).filter(Boolean)
                : [],
            autoJoinByDomain: Boolean(settings.autoJoinByDomain),
            allowCandidateExports: settings.allowCandidateExports !== undefined ? Boolean(settings.allowCandidateExports) : true
        },
        stats: {
            totalMembers: validAdminOwner ? 1 : 0
        }
    });

    // If owner was assigned, update user's organization
    if (validAdminOwner) {
        await userModel.findByIdAndUpdate(validAdminOwner, {
            $set: {
                organization: org._id,
                organizationRole: 'admin'
            }
        });
    }

    if (req) {
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'ORGANIZATION_CREATED',
                category: 'ADMIN',
                severity: 'INFO',
                targetId: org._id,
                targetType: 'Organization',
                targetIdentifier: org.name,
                changeSummary: `Created B2B partner organization "${org.name}" (${org.type}). Tier: ${org.agreement.tier}, Seats: ${org.agreement.maxSeats}`
            });
        } catch (auditErr) {
            console.warn('[ORGANIZATION_SERVICE] Audit log failed:', auditErr.message);
        }
    }

    return org;
}

/**
 * Update an existing organization
 */
async function updateOrganization(orgId, updateData, context = {}) {
    const { actorId, actorRole = 'admin', req } = context;

    const org = await Organization.findById(orgId);
    if (!org) {
        throw new Error('Organization not found.');
    }

    const previousState = org.toObject();

    if (updateData.name && updateData.name.trim() !== org.name) {
        const existing = await Organization.findOne({ name: updateData.name.trim(), _id: { $ne: orgId } });
        if (existing) {
            throw new Error(`An organization named "${updateData.name.trim()}" already exists.`);
        }
        org.name = updateData.name.trim();
    }

    if (updateData.type) org.type = updateData.type;

    if (updateData.contact) {
        if (updateData.contact.contactPerson !== undefined) org.contact.contactPerson = updateData.contact.contactPerson.trim();
        if (updateData.contact.email !== undefined) org.contact.email = updateData.contact.email.toLowerCase().trim();
        if (updateData.contact.phone !== undefined) org.contact.phone = updateData.contact.phone.trim();
        if (updateData.contact.website !== undefined) org.contact.website = updateData.contact.website.trim();
        if (updateData.contact.address !== undefined) org.contact.address = updateData.contact.address.trim();
    }

    if (updateData.agreement) {
        if (updateData.agreement.contractId !== undefined) org.agreement.contractId = updateData.agreement.contractId.trim();
        if (updateData.agreement.tier !== undefined) org.agreement.tier = updateData.agreement.tier;
        if (updateData.agreement.validFrom !== undefined) org.agreement.validFrom = new Date(updateData.agreement.validFrom);
        if (updateData.agreement.validUntil !== undefined) org.agreement.validUntil = updateData.agreement.validUntil ? new Date(updateData.agreement.validUntil) : null;
        if (updateData.agreement.maxSeats !== undefined) org.agreement.maxSeats = Math.max(1, Number(updateData.agreement.maxSeats) || 1);
        if (updateData.agreement.monthlyInterviewQuota !== undefined) org.agreement.monthlyInterviewQuota = Math.max(0, Number(updateData.agreement.monthlyInterviewQuota) || 0);
        if (updateData.agreement.monthlyResumeQuota !== undefined) org.agreement.monthlyResumeQuota = Math.max(0, Number(updateData.agreement.monthlyResumeQuota) || 0);
    }

    if (updateData.settings) {
        if (updateData.settings.allowedEmailDomains !== undefined) {
            org.settings.allowedEmailDomains = Array.isArray(updateData.settings.allowedEmailDomains)
                ? updateData.settings.allowedEmailDomains.map(d => String(d).trim().toLowerCase()).filter(Boolean)
                : [];
        }
        if (updateData.settings.autoJoinByDomain !== undefined) org.settings.autoJoinByDomain = Boolean(updateData.settings.autoJoinByDomain);
        if (updateData.settings.allowCandidateExports !== undefined) org.settings.allowCandidateExports = Boolean(updateData.settings.allowCandidateExports);
    }

    await org.save();

    if (req) {
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'ORGANIZATION_UPDATED',
                category: 'ADMIN',
                severity: 'INFO',
                targetId: org._id,
                targetType: 'Organization',
                targetIdentifier: org.name,
                before: previousState,
                after: org.toObject(),
                changeSummary: `Updated organization details for "${org.name}".`
            });
        } catch (auditErr) {
            console.warn('[ORGANIZATION_SERVICE] Audit log failed:', auditErr.message);
        }
    }

    return org;
}

/**
 * Toggle organization status (active, suspended, pending)
 */
async function setOrganizationStatus(orgId, status, reason = '', context = {}) {
    const { actorId, actorRole = 'admin', req } = context;

    if (!['active', 'suspended', 'pending'].includes(status)) {
        throw new Error('Invalid organization status.');
    }

    const org = await Organization.findById(orgId);
    if (!org) {
        throw new Error('Organization not found.');
    }

    const previousStatus = org.status;
    org.status = status;
    await org.save();

    if (req) {
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'ORGANIZATION_STATUS_CHANGED',
                category: 'ADMIN',
                severity: status === 'suspended' ? 'WARN' : 'INFO',
                targetId: org._id,
                targetType: 'Organization',
                targetIdentifier: org.name,
                changeSummary: `Changed organization status from "${previousStatus}" to "${status}". Reason: ${reason || 'N/A'}`
            });
        } catch (auditErr) {
            console.warn('[ORGANIZATION_SERVICE] Audit log failed:', auditErr.message);
        }
    }

    return org;
}

/**
 * Assign an organization administrator
 */
async function assignOrgAdmin(orgId, userId, context = {}) {
    const { req } = context;

    const org = await Organization.findById(orgId);
    if (!org) throw new Error('Organization not found.');

    const user = await userModel.findById(userId);
    if (!user) throw new Error('Target user account not found.');

    // Add to orgAdmins array if not present
    if (!org.orgAdmins.some(id => id.toString() === userId.toString())) {
        org.orgAdmins.push(user._id);
        if (!org.adminOwner) {
            org.adminOwner = user._id;
        }
        await org.save();
    }

    // Update user record
    await userModel.findByIdAndUpdate(userId, {
        $set: {
            organization: org._id,
            organizationRole: 'admin'
        }
    });

    if (req) {
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'ORG_ADMIN_ASSIGNED',
                category: 'ADMIN',
                severity: 'INFO',
                targetId: org._id,
                targetType: 'Organization',
                targetIdentifier: org.name,
                changeSummary: `Assigned user "${user.username}" (${user.email}) as Organization Administrator for "${org.name}".`
            });
        } catch (_) {}
    }

    return org;
}

/**
 * Remove an organization administrator
 */
async function removeOrgAdmin(orgId, userId, context = {}) {
    const { req } = context;

    const org = await Organization.findById(orgId);
    if (!org) throw new Error('Organization not found.');

    org.orgAdmins = org.orgAdmins.filter(id => id.toString() !== userId.toString());
    if (org.adminOwner && org.adminOwner.toString() === userId.toString()) {
        org.adminOwner = org.orgAdmins[0] || null;
    }
    await org.save();

    await userModel.findByIdAndUpdate(userId, {
        $set: {
            organizationRole: 'member'
        }
    });

    if (req) {
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'ORG_ADMIN_REMOVED',
                category: 'ADMIN',
                severity: 'INFO',
                targetId: org._id,
                targetType: 'Organization',
                targetIdentifier: org.name,
                changeSummary: `Revoked Organization Administrator privileges for user ID "${userId}" from "${org.name}".`
            });
        } catch (_) {}
    }

    return org;
}

/**
 * Get paginated list of organizations
 */
async function getOrganizations({ search = '', type = '', status = '', page = 1, limit = 20 } = {}) {
    const filter = {};

    if (type && type !== 'ALL') {
        filter.type = type;
    }

    if (status && status !== 'ALL') {
        filter.status = status;
    }

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { name: regex },
            { 'contact.email': regex },
            { 'contact.contactPerson': regex },
            { slug: regex }
        ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [organizations, total] = await Promise.all([
        Organization.find(filter)
            .populate('adminOwner', 'username email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Organization.countDocuments(filter)
    ]);

    return {
        organizations,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1
    };
}

/**
 * Get organization by ID with populated admins
 */
async function getOrganizationById(orgId) {
    const org = await Organization.findById(orgId)
        .populate('adminOwner', 'username email')
        .populate('orgAdmins', 'username email lastActiveAt')
        .lean();

    if (!org) {
        throw new Error('Organization not found.');
    }

    return org;
}

/**
 * Get aggregated organization usage and statistics
 */
async function getOrganizationUsageAndStats(orgId) {
    const org = await Organization.findById(orgId).lean();
    if (!org) {
        throw new Error('Organization not found.');
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    // Current month boundaries
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
        totalMembers,
        monthlyInterviews,
        allTimeInterviews,
        monthlyResumes,
        matchScoreAgg
    ] = await Promise.all([
        // Active seats
        userModel.countDocuments({ organization: orgObjectId, isDeleted: false }),

        // Monthly interviews generated by cohort
        interviewReportModel.countDocuments({
            organization: orgObjectId,
            createdAt: { $gte: startOfMonth }
        }),

        // All-time interviews
        interviewReportModel.countDocuments({ organization: orgObjectId }),

        // Monthly resumes / cover letters
        coverLetterModel.countDocuments({
            organization: orgObjectId,
            createdAt: { $gte: startOfMonth }
        }),

        // Cohort average ATS performance
        interviewReportModel.aggregate([
            { $match: { organization: orgObjectId, matchScore: { $gte: 0 } } },
            {
                $group: {
                    _id: null,
                    avgScore: { $avg: '$matchScore' },
                    highestScore: { $max: '$matchScore' },
                    lowestScore: { $min: '$matchScore' }
                }
            }
        ])
    ]);

    const performance = matchScoreAgg[0] || {
        avgScore: 0,
        highestScore: 0,
        lowestScore: 0
    };

    const maxSeats = org.agreement?.maxSeats || 50;
    const monthlyInterviewQuota = org.agreement?.monthlyInterviewQuota || 500;
    const monthlyResumeQuota = org.agreement?.monthlyResumeQuota || 500;

    return {
        organizationId: org._id,
        name: org.name,
        type: org.type,
        status: org.status,
        seats: {
            used: totalMembers,
            total: maxSeats,
            available: Math.max(0, maxSeats - totalMembers),
            usagePercent: Math.min(100, Math.round((totalMembers / maxSeats) * 100))
        },
        interviews: {
            monthlyUsed: monthlyInterviews,
            monthlyQuota: monthlyInterviewQuota,
            allTimeTotal: allTimeInterviews,
            usagePercent: monthlyInterviewQuota > 0 
                ? Math.min(100, Math.round((monthlyInterviews / monthlyInterviewQuota) * 100)) 
                : 0
        },
        resumes: {
            monthlyUsed: monthlyResumes,
            monthlyQuota: monthlyResumeQuota,
            usagePercent: monthlyResumeQuota > 0
                ? Math.min(100, Math.round((monthlyResumes / monthlyResumeQuota) * 100))
                : 0
        },
        atsPerformance: {
            averageScore: Math.round(performance.avgScore || 0),
            highestScore: performance.highestScore || 0,
            lowestScore: performance.lowestScore || 0
        }
    };
}

/**
 * Get paginated list of organization members
 */
async function getOrganizationMembers(orgId, { search = '', page = 1, limit = 20 } = {}) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const filter = { organization: orgObjectId, isDeleted: false };

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { username: regex },
            { email: regex }
        ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [members, total] = await Promise.all([
        userModel.find(filter)
            .select('username email plan role organizationRole lastActiveAt createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        userModel.countDocuments(filter)
    ]);

    return {
        members,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1
    };
}

/**
 * Add a candidate member to an organization (with seat enforcement)
 */
async function addMemberToOrganization(orgId, userId, context = {}) {
    const { req } = context;

    const org = await Organization.findById(orgId);
    if (!org) throw new Error('Organization not found.');

    if (org.status === 'suspended') {
        throw new Error('Cannot add candidates to a suspended organization.');
    }

    const currentSeats = await userModel.countDocuments({ organization: org._id, isDeleted: false });
    if (currentSeats >= org.agreement.maxSeats) {
        throw new Error(`Organization seat limit reached (${org.agreement.maxSeats} seats). Please expand seat quota before adding more candidates.`);
    }

    const user = await userModel.findById(userId);
    if (!user) throw new Error('Candidate account not found.');

    await userModel.findByIdAndUpdate(userId, {
        $set: {
            organization: org._id,
            organizationRole: 'member'
        }
    });

    await Organization.findByIdAndUpdate(orgId, {
        $inc: { 'stats.totalMembers': 1 }
    });

    if (req) {
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'ORG_MEMBER_ADDED',
                category: 'ADMIN',
                severity: 'INFO',
                targetId: org._id,
                targetType: 'Organization',
                targetIdentifier: org.name,
                changeSummary: `Added candidate "${user.username}" (${user.email}) to organization "${org.name}".`
            });
        } catch (_) {}
    }

    return true;
}

/**
 * Remove a member from an organization
 */
async function removeMemberFromOrganization(orgId, userId, context = {}) {
    const { req } = context;

    const org = await Organization.findById(orgId);
    if (!org) throw new Error('Organization not found.');

    const user = await userModel.findById(userId);
    if (!user) throw new Error('User not found.');

    await userModel.findByIdAndUpdate(userId, {
        $set: {
            organization: null,
            organizationRole: null
        }
    });

    // Also remove from orgAdmins if they were an admin
    if (org.orgAdmins.some(id => id.toString() === userId.toString())) {
        org.orgAdmins = org.orgAdmins.filter(id => id.toString() !== userId.toString());
        if (org.adminOwner && org.adminOwner.toString() === userId.toString()) {
            org.adminOwner = org.orgAdmins[0] || null;
        }
        await org.save();
    }

    await Organization.findByIdAndUpdate(orgId, {
        $inc: { 'stats.totalMembers': -1 }
    });

    if (req) {
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'ORG_MEMBER_REMOVED',
                category: 'ADMIN',
                severity: 'INFO',
                targetId: org._id,
                targetType: 'Organization',
                targetIdentifier: org.name,
                changeSummary: `Removed candidate "${user.username}" (${user.email}) from organization "${org.name}".`
            });
        } catch (_) {}
    }

    return true;
}

module.exports = {
    createOrganization,
    updateOrganization,
    setOrganizationStatus,
    assignOrgAdmin,
    removeOrgAdmin,
    getOrganizations,
    getOrganizationById,
    getOrganizationUsageAndStats,
    getOrganizationMembers,
    addMemberToOrganization,
    removeMemberFromOrganization
};

