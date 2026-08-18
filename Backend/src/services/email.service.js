const nodemailer = require('nodemailer');
const axios = require('axios');

/**
 * ── SOLID EMAIL PROVIDER SYSTEM ──
 * 
 * SRP (Single Responsibility Principle): Each class manages exactly one email delivery mechanism.
 * OCP (Open-Closed Principle): Easily extendable for new email providers (e.g. Resend, Mailgun)
 *     without modifying existing providers or caller code.
 * DIP (Dependency Inversion Principle): The main EmailService relies on the EmailProvider abstraction.
 */

// 1. Abstract Base Class for Email Providers
class EmailProvider {
    async sendOtp(toEmail, otp) {
        throw new Error("Method 'sendOtp()' must be implemented.");
    }

    getHtmlTemplate(otp) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #0f1322; color: #ffffff; border-radius: 12px; border: 1px solid #1c2338;">
                <h2 style="color: #7ddfff; margin-top: 0;">Verify Your Email Address</h2>
                <p style="color: #8f9cae; font-size: 0.95rem; line-height: 1.5;">
                    Thank you for signing up for KIVI-AI. Please use the following 6-digit One-Time Password (OTP) to complete your verification:
                </p>
                <div style="background: rgba(99, 102, 241, 0.15); border: 1px dashed #6366f1; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 2.2rem; font-weight: 800; letter-spacing: 6px; color: #a78bfa;">${otp}</span>
                </div>
                <p style="color: #8f9cae; font-size: 0.85rem;">
                    This code is valid for <strong>10 minutes</strong>. If you did not request this code, please ignore this email.
                </p>
                <hr style="border: 0; border-top: 1px solid #1c2338; margin-top: 20px;" />
                <p style="color: #627285; font-size: 0.75rem; text-align: center;">© 2026 KIVI-AI Interview Intelligence. All rights reserved.</p>
            </div>
        `;
    }
}

// 2. Gmail SMTP Provider Implementation
class GmailSmtpProvider extends EmailProvider {
    constructor(user, pass) {
        super();
        this.user = user;
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: user,
                pass: pass
            },
            connectionTimeout: 4000,
            greetingTimeout: 4000,
            socketTimeout: 5000
        });
    }

    async sendOtp(toEmail, otp) {
        const mailOptions = {
            from: `"KIVI-AI Support" <${this.user}>`,
            to: toEmail,
            subject: 'Your KIVI-AI Verification Code (OTP)',
            html: this.getHtmlTemplate(otp)
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[GMAIL SMTP] OTP successfully delivered to ${toEmail}. Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    }
}

// 3. Brevo HTTP API Provider Implementation
class BrevoApiProvider extends EmailProvider {
    constructor(apiKey, senderEmail, senderName = "KIVI-AI Support") {
        super();
        this.apiKey = apiKey;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
        this.apiUrl = 'https://api.brevo.com/v3/smtp/email';
    }

    async sendOtp(toEmail, otp) {
        const payload = {
            sender: {
                name: this.senderName,
                email: this.senderEmail
            },
            to: [
                {
                    email: toEmail
                }
            ],
            subject: 'Your KIVI-AI Verification Code (OTP)',
            htmlContent: this.getHtmlTemplate(otp)
        };

        try {
            const response = await axios.post(this.apiUrl, payload, {
                headers: {
                    'api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                }
            });

            console.log(`[BREVO API] OTP successfully delivered to ${toEmail}. Message ID: ${response.data?.messageId}`);
            return { success: true, messageId: response.data?.messageId };
        } catch (err) {
            if (err.response && err.response.data) {
                console.error("[BREVO API ERROR DETAILS]:", JSON.stringify(err.response.data));
            }
            throw err;
        }
    }
}

// 4. Console Fallback Provider (Dev/Local fallback)
class ConsoleFallbackProvider extends EmailProvider {
    async sendOtp(toEmail, otp) {
        console.log(`\n==============================================`);
        console.log(`[DEV MODE - CONSOLE] VERIFICATION OTP FOR ${toEmail}: ${otp}`);
        console.log(`==============================================\n`);
        return { success: false, fallbackOtp: otp, reason: "No email credentials configured. Console print." };
    }
}

// 5. Manager Class to resolve active provider based on environment variables
class EmailService {
    constructor() {
        this.provider = this._resolveProvider();
    }

    _resolveProvider() {
        const brevoApiKey = process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.trim() : null;
        const gmailUser = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : null;
        const gmailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim() : null;

        if (brevoApiKey) {
            console.log("[EMAIL SERVICE] Initializing Brevo API Provider...");
            const senderEmail = gmailUser || 'info@kivi-ai.com';
            return new BrevoApiProvider(brevoApiKey, senderEmail);
        }

        if (gmailUser && gmailPass) {
            console.log("[EMAIL SERVICE] Initializing Gmail SMTP Provider...");
            return new GmailSmtpProvider(gmailUser, gmailPass);
        }

        console.log("[EMAIL SERVICE] Initializing Console Fallback Provider...");
        return new ConsoleFallbackProvider();
    }

    async sendOtpEmail(toEmail, otp) {
        try {
            return await this.provider.sendOtp(toEmail, otp);
        } catch (err) {
            console.error(`[EMAIL SERVICE ERROR] Active provider failed:`, err.message);
            return { success: false, error: err.message };
        }
    }
}

const emailServiceInstance = new EmailService();

module.exports = {
    sendOtpEmail: (toEmail, otp) => emailServiceInstance.sendOtpEmail(toEmail, otp)
};
