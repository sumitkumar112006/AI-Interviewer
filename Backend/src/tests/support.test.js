const { contactUsController, supportTicketController, newsletterSubscriptionController } = require('../controller/support.controller');
const { sendToWeb3Forms } = require('../services/web3forms.service');
const { createRateLimiter } = require('../middleware/rateLimiter.middleware');

// Helper to construct mock Express req/res
function createMockReqRes({ body = {}, headers = {}, ip = '127.0.0.1' } = {}) {
    const req = {
        body,
        headers,
        ip,
        user: null
    };

    const res = {
        statusCode: 200,
        headers: {},
        jsonData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.jsonData = data;
            return this;
        },
        setHeader(key, val) {
            this.headers[key] = val;
            return this;
        }
    };

    return { req, res };
}

describe('Support & Web3Forms Security Tests', () => {
    const originalEnv = process.env.WEB3FORMS_ACCESS_KEY;
    const originalNodeEnv = process.env.NODE_ENV;

    beforeAll(() => {
        process.env.WEB3FORMS_ACCESS_KEY = 'test-secret-web3forms-key-12345';
        process.env.NODE_ENV = 'test';
    });

    afterAll(() => {
        process.env.WEB3FORMS_ACCESS_KEY = originalEnv;
        process.env.NODE_ENV = originalNodeEnv;
    });

    describe('1. Input Validation for Contact Us', () => {
        test('Rejects request with missing name', async () => {
            const { req, res } = createMockReqRes({
                body: { name: '', email: 'alice@example.com', message: 'Hello support' }
            });

            await contactUsController(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.jsonData.success).toBe(false);
            expect(res.jsonData.message).toMatch(/name is required/i);
        });

        test('Rejects request with invalid email format', async () => {
            const { req, res } = createMockReqRes({
                body: { name: 'Alice', email: 'not-an-email', message: 'Hello support' }
            });

            await contactUsController(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.jsonData.success).toBe(false);
            expect(res.jsonData.message).toMatch(/valid email/i);
        });

        test('Rejects request with message that is too short', async () => {
            const { req, res } = createMockReqRes({
                body: { name: 'Alice', email: 'alice@example.com', message: 'hi' }
            });

            await contactUsController(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.jsonData.success).toBe(false);
            expect(res.jsonData.message).toMatch(/between 3 and 5,000 characters/i);
        });

        test('Accepts valid Contact Us submission and returns 200 without exposing access key', async () => {
            const { req, res } = createMockReqRes({
                body: {
                    name: 'Alice Developer',
                    email: 'alice@example.com',
                    category: 'Billing Question',
                    message: 'I have a question regarding invoice exports.'
                }
            });

            await contactUsController(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.jsonData.success).toBe(true);
            expect(res.jsonData.message).toMatch(/sent successfully/i);
            // Verify access key is NEVER exposed in the JSON response
            expect(JSON.stringify(res.jsonData)).not.toContain('test-secret-web3forms-key-12345');
            expect(JSON.stringify(res.jsonData)).not.toContain('access_key');
        });
    });

    describe('2. Input Validation & Data Stripping for Support Tickets', () => {
        test('Rejects ticket with missing required fields', async () => {
            const { req, res } = createMockReqRes({
                body: { name: 'Bob', email: '', message: '' }
            });

            await supportTicketController(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.jsonData.success).toBe(false);
        });

        test('Accepts valid ticket, generates ticketId, and strictly strips sensitive identifiers', async () => {
            const { req, res } = createMockReqRes({
                body: {
                    name: 'Bob Tester',
                    email: 'bob@example.com',
                    category: 'Technical Bug / Issue',
                    priority: 'Urgent',
                    subject: 'ATS Parser Edge Case',
                    message: 'When uploading a multi-page PDF, ATS score takes 10 seconds.',
                    // Malicious or excessive payloads that MUST NOT be forwarded
                    _id: '67c13db45f1023a88b560123',
                    id: 'internal-id-999',
                    user_id: '67c13db45f1023a88b560123',
                    user_plan: 'Lifetime Enterprise',
                    plan: 'Pro'
                }
            });

            await supportTicketController(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.jsonData.success).toBe(true);
            expect(res.jsonData.ticketId).toMatch(/^KIVI-SUP-\d{6}$/);

            // Crucially ensure no secrets or unnecessary IDs leaked in response
            const stringified = JSON.stringify(res.jsonData);
            expect(stringified).not.toContain('test-secret-web3forms-key-12345');
            expect(stringified).not.toContain('67c13db45f1023a88b560123');
            expect(stringified).not.toContain('Lifetime Enterprise');
        });
    });

    describe('3. Newsletter Subscription Security', () => {
        test('Rejects invalid email format for newsletter', async () => {
            const { req, res } = createMockReqRes({
                body: { email: 'invalid-email-address' }
            });

            await newsletterSubscriptionController(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.jsonData.success).toBe(false);
            expect(res.jsonData.message).toMatch(/valid email/i);
        });

        test('Accepts valid email for newsletter and confirms subscription', async () => {
            const { req, res } = createMockReqRes({
                body: { email: 'subscriber@example.com' }
            });

            await newsletterSubscriptionController(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.jsonData.success).toBe(true);
            expect(res.jsonData.message).toMatch(/thank you for subscribing/i);
            expect(JSON.stringify(res.jsonData)).not.toContain('test-secret-web3forms-key-12345');
        });
    });

    describe('4. Web3Forms Service Security', () => {
        test('sendToWeb3Forms does not leak secret key on errors', async () => {
            const result = await sendToWeb3Forms({
                name: 'Test',
                email: 'test@example.com',
                subject: 'Test',
                message: 'Testing service'
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('message');
            expect(JSON.stringify(result)).not.toContain('test-secret-web3forms-key-12345');
        });
    });

    describe('5. Rate Limiting Protection', () => {
        test('Blocks excessive rapid submissions with 429 status', async () => {
            const limiter = createRateLimiter({
                prefix: 'ratelimit:test-support',
                windowSeconds: 60,
                maxRequests: 3,
                message: 'Too many requests. Please wait.'
            });

            const ip = '192.168.1.100';
            const mockNext = jest.fn();

            // First 3 requests should pass
            for (let i = 0; i < 3; i++) {
                const { req, res } = createMockReqRes({ ip });
                await limiter(req, res, mockNext);
                expect(res.statusCode).toBe(200);
            }
            expect(mockNext).toHaveBeenCalledTimes(3);

            // 4th request should trigger 429
            const { req, res } = createMockReqRes({ ip });
            let calledNextOn4th = false;
            await limiter(req, res, () => { calledNextOn4th = true; });

            expect(res.statusCode).toBe(429);
            expect(res.jsonData.message).toMatch(/too many requests/i);
            expect(calledNextOn4th).toBe(false);
        });
    });
});
