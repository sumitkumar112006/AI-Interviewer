const dns = require('dns').promises;

async function isEmailDomainReal(email) {
    if (!email || typeof email !== 'string') return false;

    // Check basic email syntax
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return false;
    }

    const domain = email.trim().split('@')[1];
    if (!domain) return false;

    try {
        // Wrap DNS MX lookup in a 2.5 second timeout to prevent cloud container hangs
        const mxRecords = await Promise.race([
            dns.resolveMx(domain),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('DNS lookup timeout')), 2500)
            )
        ]);

        return Array.isArray(mxRecords) && mxRecords.length > 0;
    } catch (err) {
        // If DNS lookup fails or times out in cloud environment, fallback to valid syntax
        console.warn(`[EMAIL VALIDATOR] DNS MX lookup warning for ${domain}: ${err.message}. Falling back to syntax validation.`);
        return true;
    }
}

module.exports = { isEmailDomainReal };