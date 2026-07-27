import React from 'react';
import { Scale, CheckCircle, AlertTriangle, FileCheck, RefreshCw, HelpCircle } from 'lucide-react';
import '../footer.pages.scss';

const TermsOfService = () => {
  return (
    <div className="footer-page-container">
      <div className="footer-page-banner">
        <div className="banner-icon-badge accent-purple">
          <Scale size={32} />
        </div>
        <h1>Terms of Service</h1>
        <p className="subtitle">
          Please review the rules, guidelines, and terms governing your use of KIVI-AI.
        </p>
        <span className="last-updated">Effective Date: July 2026</span>
      </div>

      <div className="footer-page-content">
        <section className="legal-section">
          <div className="section-title">
            <CheckCircle className="section-icon" size={20} />
            <h2>1. Acceptance of Terms</h2>
          </div>
          <p>
            By accessing or using the KIVI-AI platform ("Services"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please discontinue using our platform immediately.
          </p>
        </section>

        <section className="legal-section">
          <div className="section-title">
            <FileCheck className="section-icon" size={20} />
            <h2>2. User Accounts & Responsibilities</h2>
          </div>
          <p>
            To access certain features of KIVI-AI, you must register for an account:
          </p>
          <ul>
            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            <li>You agree to provide accurate and truthful information in your resume uploads and profile descriptions.</li>
            <li>You are solely responsible for all activities that occur under your registered account.</li>
          </ul>
        </section>

        <section className="legal-section">
          <div className="section-title">
            <AlertTriangle className="section-icon" size={20} />
            <h2>3. AI Guidance Disclaimer & Usage</h2>
          </div>
          <p>
            KIVI-AI utilizes advanced artificial intelligence models to assist with interview preparation and career document generation:
          </p>
          <ul>
            <li><strong>Preparation Guidance:</strong> Suggested answers, technical questions, and behavioral advice are for practice and educational purposes.</li>
            <li><strong>No Employment Guarantee:</strong> KIVI-AI does not guarantee specific job offers, interview passes, or hiring outcomes.</li>
            <li><strong>Accuracy Verification:</strong> Users are encouraged to review generated resumes and cover letters for factual accuracy before submitting them to prospective employers.</li>
          </ul>
        </section>

        <section className="legal-section">
          <div className="section-title">
            <RefreshCw className="section-icon" size={20} />
            <h2>4. Intellectual Property & Candidate Rights</h2>
          </div>
          <p>
            You retain full copyright and ownership of the original text, resumes, and personal materials you upload to KIVI-AI. The KIVI-AI brand, design system, proprietary algorithms, and software codebase remain the exclusive intellectual property of KIVI-AI.
          </p>
        </section>

        <section className="legal-section">
          <div className="section-title">
            <HelpCircle className="section-icon" size={20} />
            <h2>5. Service Availability & Modifications</h2>
          </div>
          <p>
            We continuously improve our platform. KIVI-AI reserves the right to modify, update, or temporarily suspend features with or without notice to enhance system performance, security, or feature offerings.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
