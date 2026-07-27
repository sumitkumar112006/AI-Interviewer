const nodemailer = require('nodemailer');

function createTransporter() {
    const user = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : null;
    const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim() : null;

    if (!user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: user,
            pass: pass
        }
    });
}

async function sendOtpEmail(toEmail, otp) {
    const transporter = createTransporter();

    if (!transporter) {
        console.log(`\n==============================================`);
        console.log(`[DEV MODE - NO EMAIL CREDENTIALS IN .ENV]`);
        console.log(`VERIFICATION OTP FOR ${toEmail}: ${otp}`);
        console.log(`==============================================\n`);
        return true;
    }

    try {
        const mailOptions = {
            from: `"KIVI-AI Support" <${process.env.EMAIL_USER.trim()}>`,
            to: toEmail,
            subject: 'Your KIVI-AI Verification Code (OTP)',
            html: `
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
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL SENT] OTP successfully delivered to ${toEmail}. Message ID: ${info.messageId}`);
        return info;
    } catch (err) {
        console.error(`[EMAIL ERROR] Failed to send email to ${toEmail}:`, err.message);
        console.log(`\n==============================================`);
        console.log(`[FALLBACK OTP] VERIFICATION OTP FOR ${toEmail}: ${otp}`);
        console.log(`==============================================\n`);
        return true;
    }
}

module.exports = { sendOtpEmail };
