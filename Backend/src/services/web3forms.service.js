/**
 * Web3Forms Server-Side Integration Service
 * 
 * Securely forwards contact inquiries and support tickets to Web3Forms
 * keeping access keys and credentials strictly server-side.
 */

async function sendToWeb3Forms(data = {}) {
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;

    // Graceful handling for automated test environments or mock keys without external network access
    if (process.env.NODE_ENV === 'test' && (!accessKey || accessKey.startsWith('test-') || accessKey === 'mock-key')) {
        return {
            success: true,
            message: 'Support message delivered successfully (test simulation).'
        };
    }

    if (!accessKey) {
        console.warn('[Web3Forms Service] WEB3FORMS_ACCESS_KEY is not configured on server.');
        return {
            success: false,
            message: 'Support message service is temporarily unconfigured. Please contact support via email.'
        };
    }

    const payload = {
        access_key: accessKey,
        name: data.name,
        email: data.email,
        subject: data.subject,
        category: data.category,
        message: data.message,
        from_name: data.from_name || 'KIVI-AI Support'
    };

    if (data.ticket_id) {
        payload.ticket_id = data.ticket_id;
    }
    if (data.priority) {
        payload.priority = data.priority;
    }

    try {
        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        });

        const resData = await response.json().catch(() => ({}));

        if (!response.ok || !resData.success) {
            console.warn(`[Web3Forms Service] Upstream response status: ${response.status}`);
            return {
                success: false,
                message: resData.message || 'Unable to submit message. Please try again later.'
            };
        }

        return {
            success: true,
            message: resData.message || 'Message sent successfully.'
        };
    } catch (err) {
        console.error('[Web3Forms Service] Request failed:', err.name || 'NetworkError');
        return {
            success: false,
            message: 'Failed to connect to messaging service. Please try again later.'
        };
    }
}

module.exports = {
    sendToWeb3Forms
};
