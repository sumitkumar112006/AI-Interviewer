/**
 * organizationManagement.test.js — B2B Partner & Organization Management Test Suite
 *
 * Tests:
 * 1. Organization Model Schema and Defaults.
 * 2. Organization Service CRUD, Slugging, and Status Toggles.
 * 3. Organization Admin Assignment and Role Synchronization.
 * 4. Seat Limit Enforcement and Candidate Management.
 * 5. Tenant Isolation and Cross-Tenant Shielding (`requireOrgAccess`).
 * 6. Aggregated Metrics & ATS Analytics.
 * 7. Audit Trail Integration.
 */

'use strict';

jest.mock('../jobs/aiQueue', () => ({
    aiQueue: {
        getJob: jest.fn().mockResolvedValue(null),
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
        getWorkers: jest.fn().mockResolvedValue([])
    },
    enqueueAiJob: jest.fn().mockResolvedValue({ id: 'bull-job-test' })
}));

const mongoose = require('mongoose');
const Organization = require('../models/organization.model');
const userModel = require('../models/user.model');
const interviewReportModel = require('../models/interviewReport.model');
const coverLetterModel = require('../models/coverLetter.model');
const organizationService = require('../services/organization.service');
const { requireOrgAccess } = require('../middleware/auth.middleware');
const auditLogService = require('../services/auditLog.service');

describe('B2B Organization & Partner Management Test Suite', () => {
    let mockAuditSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue(true);
    });

    afterEach(() => {
        mockAuditSpy.mockRestore();
    });

    describe('1. Organization Creation & Slugs', () => {
        it('requires an organization name and contact email', async () => {
            await expect(
                organizationService.createOrganization({ name: '', contact: { email: 'test@example.com' } })
            ).rejects.toThrow('Organization name is required.');

            await expect(
                organizationService.createOrganization({ name: 'Valid Org', contact: { email: '' } })
            ).rejects.toThrow('Primary contact email is required.');
        });

        it('creates an organization with formatted slug, default agreement and audit log', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const createdOrg = {
                _id: orgId,
                name: 'Apex Institute of Technology',
                slug: 'apex-institute-of-technology',
                type: 'college',
                contact: { email: 'partners@apex.edu' },
                status: 'active',
                agreement: { tier: 'standard', maxSeats: 50 },
                toObject: () => ({ name: 'Apex Institute of Technology', slug: 'apex-institute-of-technology' })
            };

            jest.spyOn(Organization, 'findOne').mockResolvedValue(null);
            jest.spyOn(Organization, 'create').mockResolvedValue(createdOrg);

            const mockReq = { user: { _id: 'admin1', role: 'super_admin' }, ip: '127.0.0.1' };
            const result = await organizationService.createOrganization(
                {
                    name: 'Apex Institute of Technology',
                    type: 'college',
                    contact: { email: 'partners@apex.edu' }
                },
                { actorId: 'admin1', req: mockReq }
            );

            expect(result.slug).toBe('apex-institute-of-technology');
            expect(mockAuditSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'ORGANIZATION_CREATED',
                    targetIdentifier: 'Apex Institute of Technology'
                })
            );

            Organization.findOne.mockRestore();
            Organization.create.mockRestore();
        });
    });

    describe('2. Organization Lifecycle & Status Management', () => {
        it('prevents renaming to an existing organization name', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const existingOrg = {
                _id: orgId,
                name: 'Tech University',
                toObject: () => ({ _id: orgId, name: 'Tech University' }),
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Organization, 'findById').mockResolvedValue(existingOrg);
            jest.spyOn(Organization, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId(), name: 'Conflict University' });

            await expect(
                organizationService.updateOrganization(orgId, { name: 'Conflict University' })
            ).rejects.toThrow('An organization named "Conflict University" already exists.');

            Organization.findById.mockRestore();
            Organization.findOne.mockRestore();
        });

        it('changes organization status with appropriate audit severity', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const orgInstance = {
                _id: orgId,
                name: 'Acme Corp',
                status: 'active',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Organization, 'findById').mockResolvedValue(orgInstance);

            const mockReq = { user: { _id: 'admin1', role: 'admin' }, ip: '127.0.0.1' };
            await organizationService.setOrganizationStatus(orgId, 'suspended', 'Contract breached', { req: mockReq });

            expect(orgInstance.status).toBe('suspended');
            expect(mockAuditSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'ORGANIZATION_STATUS_CHANGED',
                    severity: 'WARN',
                    changeSummary: expect.stringContaining('suspended')
                })
            );

            Organization.findById.mockRestore();
        });

        it('rejects invalid organization status values', async () => {
            await expect(
                organizationService.setOrganizationStatus('123', 'invalid_status')
            ).rejects.toThrow('Invalid organization status.');
        });
    });

    describe('3. Admin Assignment & Role Synchronization', () => {
        it('assigns user as organization admin and syncs user model', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const userId = new mongoose.Types.ObjectId();

            const orgInstance = {
                _id: orgId,
                name: 'Engineering College',
                orgAdmins: [],
                adminOwner: null,
                save: jest.fn().mockResolvedValue(true)
            };

            const userInstance = {
                _id: userId,
                username: 'prof_sharma',
                email: 'sharma@college.edu'
            };

            jest.spyOn(Organization, 'findById').mockResolvedValue(orgInstance);
            jest.spyOn(userModel, 'findById').mockResolvedValue(userInstance);
            const userUpdateSpy = jest.spyOn(userModel, 'findByIdAndUpdate').mockResolvedValue(true);

            await organizationService.assignOrgAdmin(orgId, userId);

            expect(orgInstance.orgAdmins).toContainEqual(userId);
            expect(orgInstance.adminOwner).toEqual(userId);
            expect(userUpdateSpy).toHaveBeenCalledWith(
                userId,
                { $set: { organization: orgId, organizationRole: 'admin' } }
            );

            Organization.findById.mockRestore();
            userModel.findById.mockRestore();
            userUpdateSpy.mockRestore();
        });

        it('removes organization admin and demotes role to member', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const adminId = new mongoose.Types.ObjectId();

            const orgInstance = {
                _id: orgId,
                name: 'Engineering College',
                orgAdmins: [adminId],
                adminOwner: adminId,
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Organization, 'findById').mockResolvedValue(orgInstance);
            const userUpdateSpy = jest.spyOn(userModel, 'findByIdAndUpdate').mockResolvedValue(true);

            await organizationService.removeOrgAdmin(orgId, adminId);

            expect(orgInstance.orgAdmins).toHaveLength(0);
            expect(orgInstance.adminOwner).toBeNull();
            expect(userUpdateSpy).toHaveBeenCalledWith(
                adminId,
                { $set: { organizationRole: 'member' } }
            );

            Organization.findById.mockRestore();
            userUpdateSpy.mockRestore();
        });
    });

    describe('4. Seat Limit Enforcement & Member Management', () => {
        it('blocks adding members when the organization is suspended', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const suspendedOrg = {
                _id: orgId,
                status: 'suspended',
                agreement: { maxSeats: 100 }
            };

            jest.spyOn(Organization, 'findById').mockResolvedValue(suspendedOrg);

            await expect(
                organizationService.addMemberToOrganization(orgId, new mongoose.Types.ObjectId())
            ).rejects.toThrow('Cannot add candidates to a suspended organization.');

            Organization.findById.mockRestore();
        });

        it('enforces seat limit quota when adding members', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const activeOrg = {
                _id: orgId,
                status: 'active',
                agreement: { maxSeats: 2 }
            };

            jest.spyOn(Organization, 'findById').mockResolvedValue(activeOrg);
            // Already 2 active members enrolled
            jest.spyOn(userModel, 'countDocuments').mockResolvedValue(2);

            await expect(
                organizationService.addMemberToOrganization(orgId, new mongoose.Types.ObjectId())
            ).rejects.toThrow(/Organization seat limit reached \(2 seats\)/);

            Organization.findById.mockRestore();
            userModel.countDocuments.mockRestore();
        });

        it('successfully adds candidate when seats are available', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const userId = new mongoose.Types.ObjectId();
            const activeOrg = {
                _id: orgId,
                name: 'Tech Campus',
                status: 'active',
                agreement: { maxSeats: 50 }
            };

            jest.spyOn(Organization, 'findById').mockResolvedValue(activeOrg);
            jest.spyOn(userModel, 'countDocuments').mockResolvedValue(10);
            jest.spyOn(userModel, 'findById').mockResolvedValue({ _id: userId, username: 'student_1', email: 's1@tech.edu' });
            const userUpdateSpy = jest.spyOn(userModel, 'findByIdAndUpdate').mockResolvedValue(true);
            const orgUpdateSpy = jest.spyOn(Organization, 'findByIdAndUpdate').mockResolvedValue(true);

            const result = await organizationService.addMemberToOrganization(orgId, userId);
            expect(result).toBe(true);
            expect(userUpdateSpy).toHaveBeenCalledWith(
                userId,
                { $set: { organization: orgId, organizationRole: 'member' } }
            );
            expect(orgUpdateSpy).toHaveBeenCalledWith(
                orgId,
                { $inc: { 'stats.totalMembers': 1 } }
            );

            Organization.findById.mockRestore();
            userModel.countDocuments.mockRestore();
            userModel.findById.mockRestore();
            userUpdateSpy.mockRestore();
            orgUpdateSpy.mockRestore();
        });

        it('removes member and unlinks organization and role', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const userId = new mongoose.Types.ObjectId();

            const orgInstance = {
                _id: orgId,
                name: 'Tech Campus',
                orgAdmins: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Organization, 'findById').mockResolvedValue(orgInstance);
            jest.spyOn(userModel, 'findById').mockResolvedValue({ _id: userId, username: 'student_1', email: 's1@tech.edu' });
            const userUpdateSpy = jest.spyOn(userModel, 'findByIdAndUpdate').mockResolvedValue(true);
            const orgUpdateSpy = jest.spyOn(Organization, 'findByIdAndUpdate').mockResolvedValue(true);

            const result = await organizationService.removeMemberFromOrganization(orgId, userId);
            expect(result).toBe(true);
            expect(userUpdateSpy).toHaveBeenCalledWith(
                userId,
                { $set: { organization: null, organizationRole: null } }
            );

            Organization.findById.mockRestore();
            userModel.findById.mockRestore();
            userUpdateSpy.mockRestore();
            orgUpdateSpy.mockRestore();
        });
    });

    describe('5. Tenant Isolation & Access Middleware (`requireOrgAccess`)', () => {
        const middleware = requireOrgAccess('orgId');

        it('returns 401 if user is not authenticated', () => {
            const req = { user: null };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('allows platform administrators global cross-tenant access', () => {
            const req = {
                user: { _id: 'admin1', role: 'super_admin' },
                params: { orgId: 'org_any_123' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('allows organization admin to access their own organization', () => {
            const ownOrgId = '660000000000000000000001';
            const req = {
                user: {
                    _id: 'orgAdmin1',
                    role: 'user',
                    organization: ownOrgId,
                    organizationRole: 'admin'
                },
                params: { orgId: ownOrgId }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('shields cross-tenant access when org admin attempts to access another org (403)', () => {
            const ownOrgId = '660000000000000000000001';
            const otherOrgId = '660000000000000000000002';
            const req = {
                user: {
                    _id: 'orgAdmin1',
                    role: 'user',
                    organization: ownOrgId,
                    organizationRole: 'admin'
                },
                params: { orgId: otherOrgId }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('rejects regular members from administrative organization endpoints (403)', () => {
            const ownOrgId = '660000000000000000000001';
            const req = {
                user: {
                    _id: 'student1',
                    role: 'user',
                    organization: ownOrgId,
                    organizationRole: 'member' // not admin
                },
                params: { orgId: ownOrgId }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('6. Organization Aggregated Metrics & ATS Analytics', () => {
        it('computes correct seat utilization, interview volume, and cohort ATS scores', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const mockOrg = {
                _id: orgId,
                name: 'National University',
                type: 'college',
                status: 'active',
                agreement: {
                    maxSeats: 100,
                    monthlyInterviewQuota: 500,
                    monthlyResumeQuota: 300
                }
            };

            jest.spyOn(Organization, 'findById').mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockOrg)
            });

            // Mock counts and aggregations
            jest.spyOn(userModel, 'countDocuments').mockResolvedValue(40); // 40 members
            jest.spyOn(interviewReportModel, 'countDocuments')
                .mockResolvedValueOnce(150) // monthly interviews
                .mockResolvedValueOnce(820); // all-time interviews
            jest.spyOn(coverLetterModel, 'countDocuments').mockResolvedValue(60); // monthly resumes

            jest.spyOn(interviewReportModel, 'aggregate').mockResolvedValue([
                {
                    avgScore: 78.4,
                    highestScore: 94,
                    lowestScore: 52
                }
            ]);

            const stats = await organizationService.getOrganizationUsageAndStats(orgId.toString());

            expect(stats.seats.used).toBe(40);
            expect(stats.seats.total).toBe(100);
            expect(stats.seats.available).toBe(60);
            expect(stats.seats.usagePercent).toBe(40);

            expect(stats.interviews.monthlyUsed).toBe(150);
            expect(stats.interviews.monthlyQuota).toBe(500);
            expect(stats.interviews.usagePercent).toBe(30);
            expect(stats.interviews.allTimeTotal).toBe(820);

            expect(stats.resumes.monthlyUsed).toBe(60);
            expect(stats.resumes.monthlyQuota).toBe(300);
            expect(stats.resumes.usagePercent).toBe(20);

            expect(stats.atsPerformance.averageScore).toBe(78);
            expect(stats.atsPerformance.highestScore).toBe(94);
            expect(stats.atsPerformance.lowestScore).toBe(52);

            Organization.findById.mockRestore();
            userModel.countDocuments.mockRestore();
            interviewReportModel.countDocuments.mockRestore();
            coverLetterModel.countDocuments.mockRestore();
            interviewReportModel.aggregate.mockRestore();
        });

        it('handles zero activity gracefully without crashing', async () => {
            const orgId = new mongoose.Types.ObjectId();
            const mockOrg = {
                _id: orgId,
                name: 'New Partner',
                type: 'corporate_partner',
                status: 'active',
                agreement: {
                    maxSeats: 10,
                    monthlyInterviewQuota: 0,
                    monthlyResumeQuota: 0
                }
            };

            jest.spyOn(Organization, 'findById').mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockOrg)
            });

            jest.spyOn(userModel, 'countDocuments').mockResolvedValue(0);
            jest.spyOn(interviewReportModel, 'countDocuments')
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(0);
            jest.spyOn(coverLetterModel, 'countDocuments').mockResolvedValue(0);
            jest.spyOn(interviewReportModel, 'aggregate').mockResolvedValue([]);

            const stats = await organizationService.getOrganizationUsageAndStats(orgId.toString());

            expect(stats.seats.used).toBe(0);
            expect(stats.seats.usagePercent).toBe(0);
            expect(stats.interviews.usagePercent).toBe(0);
            expect(stats.atsPerformance.averageScore).toBe(0);

            Organization.findById.mockRestore();
            userModel.countDocuments.mockRestore();
            interviewReportModel.countDocuments.mockRestore();
            coverLetterModel.countDocuments.mockRestore();
            interviewReportModel.aggregate.mockRestore();
        });
    });
});

