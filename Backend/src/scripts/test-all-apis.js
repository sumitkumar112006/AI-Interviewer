require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const userModel = require('../models/user.model');
const interviewReportModel = require('../models/interviewReport.model');

const BASE_URL = 'http://localhost:3000';

async function runApiTests() {
    console.log('====================================================');
    console.log('🚀 STARTING COMPREHENSIVE END-TO-END API TEST SUITE');
    console.log('====================================================\n');

    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully.');

    // 2. Setup or find test user
    const testEmail = 'api_tester_demo@kiviai.test';
    let user = await userModel.findOne({ email: testEmail });
    if (!user) {
        user = await userModel.create({
            username: 'ApiTesterDemo',
            email: testEmail,
            password: 'hashed_dummy_password_for_test',
            isVerified: true,
            plan: 'free',
            role: 'user',
            careerProfile: {
                targetRole: 'Full Stack Engineer',
                selfDescription: 'Experienced developer building scalable web apps with React and Node.js.'
            }
        });
        console.log(`✅ Created test user: ${user.username} (${user.email})`);
    } else {
        console.log(`✅ Found existing test user: ${user.username} (${user.email})`);
    }

    // 3. Generate Auth JWT Token
    const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    const client = axios.create({
        baseURL: BASE_URL,
        headers: {
            Cookie: `token=${token}`
        },
        validateStatus: () => true // Allow handling all status codes in assertions
    });

    const results = [];

    function record(name, endpoint, method, status, expectedStatus, details, passed) {
        results.push({ name, endpoint, method, status, expectedStatus, details, passed });
        const icon = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${icon} | [${method}] ${endpoint} (Status: ${status}) -> ${details}`);
    }

    // -------------------------------------------------------------
    // TEST 1: Model Info
    // -------------------------------------------------------------
    try {
        const res = await client.get('/api/interview/model-info');
        const passed = res.status === 200 && res.data?.status === 'online';
        record(
            'AI Engine Model Status',
            '/api/interview/model-info',
            'GET',
            res.status,
            200,
            `Active Model: ${res.data?.primaryModel || 'N/A'}, Provider: ${res.data?.provider || 'N/A'}`,
            passed
        );
    } catch (err) {
        record('AI Engine Model Status', '/api/interview/model-info', 'GET', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // TEST 2: User Usage & Credit Limits (100 Gens / 500 AI)
    // -------------------------------------------------------------
    try {
        const res = await client.get('/api/auth/usage');
        const fullGens = res.data?.fullGenerations;
        const aiCredits = res.data?.aiAssistant;
        const passed = res.status === 200 &&
            fullGens?.limit === 100 &&
            aiCredits?.limit === 500;

        record(
            'User Usage & Free Tier 100/500 Credits Check',
            '/api/auth/usage',
            'GET',
            res.status,
            200,
            `Generations Limit: ${fullGens?.limit}/100, AI Assistant Limit: ${aiCredits?.limit}/500, Plan: ${res.data?.userPlan}`,
            passed
        );
    } catch (err) {
        record('User Usage & Credits', '/api/auth/usage', 'GET', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // TEST 3: Get Logged In User Info
    // -------------------------------------------------------------
    try {
        const res = await client.get('/api/auth/get-me');
        const passed = res.status === 200 && res.data?.user?.email === testEmail;
        record(
            'Get Current User Session (get-me)',
            '/api/auth/get-me',
            'GET',
            res.status,
            200,
            `User: ${res.data?.user?.username} (${res.data?.user?.plan || 'free'})`,
            passed
        );
    } catch (err) {
        record('Get Current User Session', '/api/auth/get-me', 'GET', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // TEST 4: Get All Interview Reports
    // -------------------------------------------------------------
    try {
        const res = await client.get('/api/interview');
        const passed = res.status === 200 && Array.isArray(res.data?.interviewReports);
        record(
            'Get All Interview Reports',
            '/api/interview',
            'GET',
            res.status,
            200,
            `Total Interviews: ${res.data?.totalInterviews ?? 0}, Reports Array Length: ${res.data?.interviewReports?.length ?? 0}`,
            passed
        );
    } catch (err) {
        record('Get All Interview Reports', '/api/interview', 'GET', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // TEST 5: Skill Analytics
    // -------------------------------------------------------------
    try {
        const res = await client.get('/api/interview/skill-analytics');
        const passed = res.status === 200 && typeof res.data?.skillAnalytics === 'object';
        record(
            'Skill Analytics Aggregation',
            '/api/interview/skill-analytics',
            'GET',
            res.status,
            200,
            `Top Skills: ${res.data?.skillAnalytics?.topSkills?.length || 0}, Target Role: ${res.data?.careerTarget?.targetRole || 'N/A'}`,
            passed
        );
    } catch (err) {
        record('Skill Analytics', '/api/interview/skill-analytics', 'GET', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // TEST 6: AI Assistant History
    // -------------------------------------------------------------
    try {
        const res = await client.get('/api/assistant/history');
        const passed = res.status === 200 && Array.isArray(res.data?.history);
        record(
            'AI Assistant Chat History (Redis)',
            '/api/assistant/history',
            'GET',
            res.status,
            200,
            `Retrieved ${res.data?.history?.length || 0} historical chat turns`,
            passed
        );
    } catch (err) {
        record('AI Assistant History', '/api/assistant/history', 'GET', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // TEST 7: AI Assistant Copilot Direct Chat (JSON Mode)
    // -------------------------------------------------------------
    try {
        const res = await client.post('/api/assistant/chat', {
            message: 'Hello KIVI AI, explain what a REST API is in 1 brief sentence.',
            stream: false
        });
        const reply = res.data?.reply || res.data?.replyText || '';
        const passed = res.status === 200 && reply.length > 10;
        record(
            'AI Assistant Chat (Direct JSON)',
            '/api/assistant/chat',
            'POST',
            res.status,
            200,
            `AI Replied (${reply.length} chars): "${reply.slice(0, 60)}..."`,
            passed
        );
    } catch (err) {
        record('AI Assistant Chat', '/api/assistant/chat', 'POST', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // TEST 8: AI Assistant SSE Token Streaming
    // -------------------------------------------------------------
    try {
        const res = await axios.post(
            `${BASE_URL}/api/assistant/chat`,
            {
                message: 'Give 3 bullet points for a Senior React Developer resume summary.',
                stream: true
            },
            {
                headers: { Cookie: `token=${token}` },
                responseType: 'stream',
                validateStatus: () => true
            }
        );

        let sseChunks = 0;
        let receivedText = '';

        await new Promise((resolve) => {
            res.data.on('data', (chunk) => {
                sseChunks++;
                receivedText += chunk.toString();
            });
            res.data.on('end', resolve);
            res.data.on('error', resolve);
            setTimeout(resolve, 8000); // 8s timeout safeguard
        });

        const passed = res.status === 200 && sseChunks > 0 && receivedText.includes('data: ');
        record(
            'AI Assistant Real-Time SSE Token Streaming',
            '/api/assistant/chat (stream: true)',
            'POST',
            res.status,
            200,
            `Received ${sseChunks} SSE chunks with tokens and done event`,
            passed
        );
    } catch (err) {
        record('AI Assistant SSE Stream', '/api/assistant/chat', 'POST', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // TEST 9: Get All Cover Letters
    // -------------------------------------------------------------
    try {
        const res = await client.get('/api/cover-letter');
        const passed = res.status === 200 && Array.isArray(res.data?.coverLetters || res.data);
        record(
            'Get All Cover Letters',
            '/api/cover-letter',
            'GET',
            res.status,
            200,
            `Cover letters retrieved successfully (Count: ${res.data?.coverLetters?.length ?? 0})`,
            passed
        );
    } catch (err) {
        record('Get All Cover Letters', '/api/cover-letter', 'GET', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // TEST 9: Create a Sample Interview Report & Test Update Endpoints
    // -------------------------------------------------------------
    let sampleReportId = null;
    try {
        const sampleReport = await interviewReportModel.create({
            user: user._id,
            developerTitle: 'Full Stack Node.js Developer',
            resume: 'John Doe Full Stack Developer with 3 years Node.js and React.',
            selfDescription: 'Full Stack engineer with strong backend and database skills.',
            jobDescription: 'Looking for a Node.js developer with REST APIs and MongoDB.',
            matchScore: 88,
            generatedResumeHtml: '<p><strong>John Doe</strong> - Senior Engineer</p>',
            technicalQuestions: [
                { question: 'What is event loop in Node.js?', answer: 'It allows non-blocking I/O operations.' }
            ],
            skillGaps: []
        });
        sampleReportId = sampleReport._id.toString();

        // Test GET /api/interview/report/:id
        const getRes = await client.get(`/api/interview/report/${sampleReportId}`);
        const getPassed = getRes.status === 200 && getRes.data?.interviewReport?.developerTitle === 'Full Stack Node.js Developer';
        record(
            'Get Interview Report By ID',
            `/api/interview/report/${sampleReportId}`,
            'GET',
            getRes.status,
            200,
            `Fetched report for: ${getRes.data?.interviewReport?.developerTitle}`,
            getPassed
        );

        // Test PUT /api/interview/resume/:id (Resume HTML update)
        const updateHtmlRes = await client.put(`/api/interview/resume/${sampleReportId}`, {
            generatedResumeHtml: '<p><strong>John Doe</strong> - Lead Full Stack Engineer (Updated ATS Resume)</p>'
        });
        const updatePassed = updateHtmlRes.status === 200;
        record(
            'Update ATS Resume HTML',
            `/api/interview/resume/${sampleReportId}`,
            'PUT',
            updateHtmlRes.status,
            200,
            `Updated resume HTML successfully`,
            updatePassed
        );

        // Test PUT /api/interview/progress/:id
        const progressRes = await client.put(`/api/interview/progress/${sampleReportId}`, {
            technicalQuestions: [
                { question: 'What is event loop in Node.js?', answer: 'It allows non-blocking I/O operations.', userRating: 5 }
            ],
            completedTasks: ['task_1']
        });
        const progressPassed = progressRes.status === 200;
        record(
            'Update Interview Progress',
            `/api/interview/progress/${sampleReportId}`,
            'PUT',
            progressRes.status,
            200,
            `Progress saved successfully`,
            progressPassed
        );

        // Clean up sample report
        await interviewReportModel.findByIdAndDelete(sampleReportId);
    } catch (err) {
        record('Report CRUD & Update', `/api/interview/report`, 'VARIOUS', 500, 200, err.message, false);
    }

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n====================================================');
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('====================================================');
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total APIs Tested : ${totalTests}`);
    console.log(`Passed            : ${passedTests} ✅`);
    console.log(`Failed            : ${failedTests} ${failedTests === 0 ? '🎉' : '❌'}\n`);

    await mongoose.disconnect();
    process.exit(failedTests === 0 ? 0 : 1);
}

runApiTests().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
});
