import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 20 },  // Ramp up to 20 users
        { duration: '1m', target: 50 },   // Stress test at 50 users
        { duration: '30s', target: 0 },   // Ramp down to 0
    ],
    thresholds: {
        http_req_duration: ['p(95)<3000'], // 95% of requests should complete under 3s
        http_req_failed: ['rate<0.05'],     // Error rate less than 5%
    },
};

const BASE_URL = 'http://localhost:3000'; // Replace with Staging Backend URL

export default function () {
    // Test Health / Model Info Endpoint
    const res1 = http.get(`${BASE_URL}/api/interview/model-info`);
    check(res1, { 'status is 200': (r) => r.status === 200 });

    sleep(1);
}
