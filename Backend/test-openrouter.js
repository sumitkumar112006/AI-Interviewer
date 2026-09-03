require('dotenv').config(); // Load from Backend/.env
const axios = require('axios');
const { getModelForProvider } = require('./src/config/aiModels.config');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

async function testOpenRouter() {
    if (!OPENROUTER_API_KEY) {
        console.error('❌ OPENROUTER_API_KEY is not set in .env');
        return;
    }

    const plans = ['free', 'pro', 'premium'];

    for (const plan of plans) {
        const model = getModelForProvider(plan, 'openrouter');
        console.log(`\nTesting OpenRouter for plan [${plan}] with model [${model}]...`);
        
        try {
            const response = await axios.post(
                OPENROUTER_BASE_URL,
                {
                    model: model,
                    messages: [
                        { role: 'user', content: 'Say "OpenRouter is alive!" and nothing else.' }
                    ],
                    max_tokens: 50
                },
                {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://resumegenerator.app',
                        'X-Title': 'Resume Generator'
                    }
                }
            );
            
            console.log(`✅ Success! Response: "${response.data.choices[0].message.content}"`);
        } catch (err) {
            console.error(`❌ Failed! Error: ${err.response?.data?.error?.message || err.message}`);
        }
    }
}

testOpenRouter();
