/**
 * organization.controller.js — Controller for B2B Partner & Organization Management
 */

'use strict';

const organizationService = require('../services/organization.service');

async function getOrganizationsController(req, res) {
    try {
        const { search, type, status, page, limit } = req.query;
        const result = await organizationService.getOrganizations({
            search,
            type,
            status,
            page,
            limit
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error('getOrganizationsController error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve organizations.'
        });
    }
}

async function getOrganizationByIdController(req, res) {
    try {
        const { orgId } = req.params;
        const organization = await organizationService.getOrganizationById(orgId);

        return res.status(200).json({
            success: true,
            organization
        });
    } catch (err) {
        console.error('getOrganizationByIdController error:', err.message);
        return res.status(404).json({
            success: false,
            message: err.message || 'Organization not found.'
        });
    }
}

async function createOrganizationController(req, res) {
    try {
        const organization = await organizationService.createOrganization(req.body, {
            actorId: req.user?.id || req.user?._id,
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(201).json({
            success: true,
            message: `Organization "${organization.name}" created successfully.`,
            organization
        });
    } catch (err) {
        console.error('createOrganizationController error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to create organization.'
        });
    }
}

async function updateOrganizationController(req, res) {
    try {
        const { orgId } = req.params;
        const organization = await organizationService.updateOrganization(orgId, req.body, {
            actorId: req.user?.id || req.user?._id,
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(200).json({
            success: true,
            message: `Organization "${organization.name}" updated successfully.`,
            organization
        });
    } catch (err) {
        console.error('updateOrganizationController error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to update organization.'
        });
    }
}

async function setOrganizationStatusController(req, res) {
    try {
        const { orgId } = req.params;
        const { status, reason } = req.body;

        const organization = await organizationService.setOrganizationStatus(orgId, status, reason, {
            actorId: req.user?.id || req.user?._id,
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(200).json({
            success: true,
            message: `Organization status updated to "${status}".`,
            organization
        });
    } catch (err) {
        console.error('setOrganizationStatusController error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to update organization status.'
        });
    }
}

async function assignOrgAdminController(req, res) {
    try {
        const { orgId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required.' });
        }

        const organization = await organizationService.assignOrgAdmin(orgId, userId, {
            actorId: req.user?.id || req.user?._id,
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(200).json({
            success: true,
            message: 'Organization administrator assigned successfully.',
            organization
        });
    } catch (err) {
        console.error('assignOrgAdminController error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to assign organization administrator.'
        });
    }
}

async function removeOrgAdminController(req, res) {
    try {
        const { orgId, userId } = req.params;

        const organization = await organizationService.removeOrgAdmin(orgId, userId, {
            actorId: req.user?.id || req.user?._id,
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(200).json({
            success: true,
            message: 'Organization administrator removed successfully.',
            organization
        });
    } catch (err) {
        console.error('removeOrgAdminController error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to remove organization administrator.'
        });
    }
}

async function getOrganizationStatsController(req, res) {
    try {
        const { orgId } = req.params;
        const stats = await organizationService.getOrganizationUsageAndStats(orgId);

        return res.status(200).json({
            success: true,
            stats
        });
    } catch (err) {
        console.error('getOrganizationStatsController error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to retrieve organization statistics.'
        });
    }
}

async function getOrganizationMembersController(req, res) {
    try {
        const { orgId } = req.params;
        const { search, page, limit } = req.query;

        const result = await organizationService.getOrganizationMembers(orgId, {
            search,
            page,
            limit
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error('getOrganizationMembersController error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve organization members.'
        });
    }
}

async function addOrgMemberController(req, res) {
    try {
        const { orgId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required.' });
        }

        await organizationService.addMemberToOrganization(orgId, userId, {
            actorId: req.user?.id || req.user?._id,
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(200).json({
            success: true,
            message: 'Candidate added to organization successfully.'
        });
    } catch (err) {
        console.error('addOrgMemberController error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to add candidate to organization.'
        });
    }
}

async function removeOrgMemberController(req, res) {
    try {
        const { orgId, userId } = req.params;

        await organizationService.removeMemberFromOrganization(orgId, userId, {
            actorId: req.user?.id || req.user?._id,
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(200).json({
            success: true,
            message: 'Candidate removed from organization successfully.'
        });
    } catch (err) {
        console.error('removeOrgMemberController error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to remove candidate from organization.'
        });
    }
}

module.exports = {
    getOrganizationsController,
    getOrganizationByIdController,
    createOrganizationController,
    updateOrganizationController,
    setOrganizationStatusController,
    assignOrgAdminController,
    removeOrgAdminController,
    getOrganizationStatsController,
    getOrganizationMembersController,
    addOrgMemberController,
    removeOrgMemberController
};

