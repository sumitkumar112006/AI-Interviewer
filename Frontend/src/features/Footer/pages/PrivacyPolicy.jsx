import React from 'react';
import { Shield, Lock, Eye, FileText, UserCheck, Mail } from 'lucide-react';
import '../footer.pages.scss';

const PrivacyPolicy = () => {
  return (
    <div className="footer-page-container">
      <div className="footer-page-banner">
        <div className="banner-icon-badge">
          <Shield size={32} />
        </div>
        <h1>Privacy Policy</h1>
        <p className="subtitle">
          Your privacy matters to us. Learn how KIVI-AI protects, uses, and safeguards your personal data.
        </p>
        <span className="last-updated">Last Updated: July 2026</span>
      </div>

      <div className="footer-page-content">
        <section className="legal-section">
          <div className="section-title">
            <FileText className="section-icon" size={20} />
            <h2>1. Information We Collect</h2>
          </div>
          <p>
            When you use KIVI-AI, we collect information necessary to deliver personalized interview intelligence, resume building, and report generation:
          </p>
          <ul>
            <li><strong>Account Information:</strong> Your username, email address, and encrypted credentials.</li>
            <li><strong>Application Profiles:</strong> Resume PDF files uploaded, self-description summaries, and targeted job descriptions.</li>
            <li><strong>Generated Content & Progress:</strong> AI interview reports, response drafts, completed roadmap tasks, and generated CV templates.</li>
            <li><strong>Technical Usage:</strong> Browser types, session cookies, and anonymized activity logs for security and analytics.</li>
          </ul>
        </section>

        <section className="legal-section">
          <div className="section-title">
            <Eye className="section-icon" size={20} />
            <h2>2. How We Use Your Information</h2>
          </div>
          <p>
            We process your information strictly to provide and improve KIVI-AI features:
          </p>
          <ul>
            <li>To generate tailored technical and behavioral interview questions using AI.</li>
            <li>To construct custom PDF resumes and cover letters aligned with specific job descriptions.</li>
            <li>To save your preparation progress, roadmap task completion, and customized answer drafts.</li>
            <li>To secure your account, prevent unauthorized access, and handle authentication via session tokens.</li>
          </ul>
        </section>

        <section className="legal-section">
          <div className="section-title">
            <Lock className="section-icon" size={20} />
            <h2>3. Data Protection & AI Privacy</h2>
          </div>
          <p>
            We prioritize industry-standard security protocols to keep your professional details safe:
          </p>
          <ul>
            <li><strong>No Data Monetization:</strong> We never sell, rent, or trade your resumes, job descriptions, or personal data to third parties or recruiters.</li>
            <li><strong>Encrypted Connections:</strong> All data transmissions are encrypted using SSL/TLS protocols.</li>
            <li><strong>AI Model Usage:</strong> Your resume and job description text sent to Google GenAI API services are processed securely and strictly used for generating your immediate reports.</li>
          </ul>
        </section>

        <section className="legal-section">
          <div className="section-title">
            <UserCheck className="section-icon" size={20} />
            <h2>4. Your Rights & Control</h2>
          </div>
          <p>
            You retain full ownership and control over your candidate profile and data:
          </p>
          <ul>
            <li><strong>Access & Export:</strong> You can view and export all generated reports and PDF files at any time.</li>
            <li><strong>Deletion:</strong> You can delete individual interview reports or request full account deletion via settings.</li>
            <li><strong>Cookies Control:</strong> You can configure your browser to manage or disable authentication cookies, though some persistent features may require active sessions.</li>
          </ul>
        </section>

        <section className="legal-section contact-card-section">
          <div className="section-title">
            <Mail className="section-icon" size={20} />
            <h2>5. Contact Our Privacy Team</h2>
          </div>
          <p>
            If you have questions or concerns regarding this Privacy Policy or your data rights, please reach out to us at:
          </p>
          <div className="contact-chip">
            <span>privacy@kivi.ai</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
