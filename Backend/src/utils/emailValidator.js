const dns = require('dns').promises;
async function isEmailDomainReal(email) {
    try {
        const domain = email.split('@')[1];
        if (!domain) return false;
        // Look up Mail Exchange (MX) records
        const mxRecords = await dns.resolveMx(domain);
        return mxRecords && mxRecords.length > 0;
    } catch (err) {
        // Domain has no mail server or does not exist
        return false;
    }
}
module.exports = { isEmailDomainReal };