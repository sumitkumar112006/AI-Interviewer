require('dotenv').config({ path: '../.env' });
const Groq = require('groq-sdk');
const keysToTest = [
    { name: 'GROQ_API_KEY', key: process.env.GROQ_API_KEY },
    { name: 'PRINCE_GROQ_API', key: process.env.PRINCE_GROQ_API },
    { name: 'SAURABH_GROQ_API', key: process.env.SAURABH_GROQ_API }
];
async function testGroqKeys() {
    for (const item of keysToTest) {
        console.log(`\nTesting Key: [${item.name}]...`);

        if (!item.key) {
            console.error(`❌ FAILED! Key is empty or not found in .env file.`);
            continue;
        }
        try {
            const client = new Groq({ apiKey: item.key });

            // Fast, small request to test the key
            const response = await client.chat.completions.create({
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'user', content: 'Reply with the word "Alive" only.' }],
                max_completion_tokens: 10,
                temperature: 0.1
            });

            console.log(`✅ SUCCESS! Key is active. Model replied: "${response.choices[0].message.content.trim()}"`);

        } catch (error) {
            if (error.status === 429 || error.status === 402) {
                console.error(`❌ FAILED! Rate Limit or Billing Error: ${error.message}`);
            } else if (error.status === 401) {
                console.error(`❌ FAILED! Invalid API Key (Unauthorized).`);
            } else {
                console.error(`❌ FAILED! Error: ${error.message}`);
            }
        }
    }
}
testGroqKeys();