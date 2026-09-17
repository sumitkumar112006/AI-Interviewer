import React from 'react';
import { 
  Shield, 
  Lock, 
  Eye, 
  FileText, 
  UserCheck, 
  Mail, 
  Cpu, 
  Server, 
  Database, 
  AlertCircle, 
  CheckCircle2, 
  Globe,
  Share2
} from 'lucide-react';
import '../footer.pages.scss';

const PrivacyPolicy = () => {
  return (
    <div className="footer-page-container">
      {/* Banner Header */}
      <div className="footer-page-banner">
        <div className="banner-icon-badge">
          <Shield size={32} />
        </div>
        <h1>Privacy Policy & Data Protection</h1>
        <p className="subtitle">
          Transparent, government-compliant data governance. Learn how KIVI-AI protects your personal resumes, interview audio, and account information under international data protection laws (DPDP Act, GDPR, and CCPA).
        </p>
        <span className="last-updated">Last Updated: September 2026 · Version 2.4</span>
      </div>

      <div className="footer-page-content">
        {/* Core Principles Summary Box */}
        <div className="legal-highlight-box">
          <div className="highlight-header">
            <CheckCircle2 size={20} className="text-emerald" />
            <h3>Our Core Privacy Guarantees</h3>
          </div>
          <div className="highlight-grid">
            <div className="highlight-item">
              <strong>🔒 Zero Public Model Training</strong>
              <p>Your uploaded resumes, cover letters, and interview voice recordings are NEVER used to train public AI foundation models.</p>
            </div>
            <div className="highlight-item">
              <strong>🛡️ Bank-Grade Encryption</strong>
              <p>All data is encrypted with TLS 1.3 in transit and AES-256 at rest across secure cloud infrastructure.</p>
            </div>
            <div className="highlight-item">
              <strong>🚫 No Selling or Renting</strong>
              <p>We do not monetize, sell, or share your candidate profile with recruiters, advertisers, or third-party brokers.</p>
            </div>
            <div className="highlight-item">
              <strong>⚡ 100% User Data Ownership</strong>
              <p>You can export, download, or permanently delete your resumes, interview transcripts, and account anytime.</p>
            </div>
          </div>
        </div>

        {/* Section 1: Information We Collect */}
        <section className="legal-section">
          <div className="section-title">
            <FileText className="section-icon" size={20} />
            <h2>1. Information We Collect</h2>
          </div>
          <p>
            In accordance with digital data minimization principles, KIVI-AI collects only the information strictly required to provide personalized AI mock interviews, resume matching, and career preparation tools:
          </p>
          <ul className="legal-list">
            <li>
              <strong>Account & Profile Information:</strong> When you register via email or Google OAuth, we collect your full name, email address, password hash (salted and encrypted), and Google avatar (if using Google Sign-In).
            </li>
            <li>
              <strong>Resume & Professional Background:</strong> PDF resumes uploaded, self-description summaries, educational history, work experience, skill tags, and targeted job descriptions you submit for analysis.
            </li>
            <li>
              <strong>AI Interview Simulations & Audio:</strong> Spoken audio inputs recorded during voice simulations (processed in temporary memory buffers for speech-to-text), typed interview responses, performance metrics, STAR breakdown evaluations, and AI scorecards.
            </li>
            <li>
              <strong>Technical, Device & Usage Data:</strong> Anonymized IP addresses, browser user-agents, operating systems, and authentication session tokens used strictly to safeguard your account against unauthorized access and brute-force attacks.
            </li>
          </ul>
        </section>

        {/* Section 2: How We Use Your Data */}
        <section className="legal-section">
          <div className="section-title">
            <Eye className="section-icon" size={20} />
            <h2>2. Purpose & How We Use Your Data</h2>
          </div>
          <p>
            We process your personal information strictly under legal bases of contract performance and explicit user consent:
          </p>
          <ul className="legal-list">
            <li>
              <strong>AI Mock Interview Evaluation:</strong> To generate relevant technical questions, conduct voice/text interview loops, and provide real-time STAR scoring and tradeoff analysis.
            </li>
            <li>
              <strong>ATS Resume Match Scoring:</strong> To parse and benchmark your qualifications against job specifications and generate ATS-friendly resumes and cover letters in the TipTap Resume Studio.
            </li>
            <li>
              <strong>Personalized Study Roadmaps:</strong> To create day-wise structured study plans tailored to your upcoming interview dates and target seniority levels.
            </li>
            <li>
              <strong>Account Security & Authentication:</strong> To verify your identity, send one-time verification codes (OTP), handle password resets, and secure session states.
            </li>
          </ul>
        </section>

        {/* Section 3: AI Processing & Third-Party Processors */}
        <section className="legal-section">
          <div className="section-title">
            <Cpu className="section-icon" size={20} />
            <h2>3. AI Architecture & Third-Party Processors</h2>
          </div>
          <p>
            KIVI-AI utilizes industry-leading enterprise cloud APIs (such as Groq LPU inference, Google Gemini API, and Supabase) to deliver real-time career intelligence:
          </p>
          <ul className="legal-list">
            <li>
              <strong>Enterprise Zero-Retention Processing:</strong> Data transmitted to our AI model providers (Groq and Google Gemini) is processed over secure TLS 1.3 connections under strict enterprise agreements where your prompts and outputs are <em>stateless</em> and are <strong>never retained or used for foundation model training</strong>.
            </li>
            <li>
              <strong>Google OAuth Protocol:</strong> When you choose "Continue with Google", we only request standard openid profile scopes (Name and Email). We never request access to your Google Drive, emails, or personal contacts.
            </li>
            <li>
              <strong>No Advertising Trackers:</strong> We do not deploy third-party advertising cookies or cross-site tracking pixels on our platform.
            </li>
          </ul>
        </section>

        {/* Section 4: Data Security & Storage */}
        <section className="legal-section">
          <div className="section-title">
            <Server className="section-icon" size={20} />
            <h2>4. Data Storage, Security & Retention</h2>
          </div>
          <p>
            We implement comprehensive technical and organizational safeguards conforming to ISO 27001 and SOC 2 standards:
          </p>
          <ul className="legal-list">
            <li>
              <strong>Cryptographic Storage:</strong> User credentials and generated career reports are encrypted at rest using AES-256 and transmitted with end-to-end TLS 1.3 encryption.
            </li>
            <li>
              <strong>Retention Schedule:</strong> Your resume versions and interview reports are maintained only for as long as your account remains active.
            </li>
            <li>
              <strong>Instant Erasure:</strong> When you delete an individual resume or interview session, it is immediately expunged from primary application databases.
            </li>
          </ul>
        </section>

        {/* Section 5: Your Statutory Legal Rights */}
        <section className="legal-section">
          <div className="section-title">
            <UserCheck className="section-icon" size={20} />
            <h2>5. Your Statutory Legal Rights (DPDP, GDPR & CCPA)</h2>
          </div>
          <p>
            Regardless of your geographical location, KIVI-AI provides all users with universal data rights:
          </p>
          <ul className="legal-list">
            <li>
              <strong>Right to Access & Portability:</strong> You can view and download all generated resumes, cover letters, and interview evaluation reports in standard PDF or text formats at any time.
            </li>
            <li>
              <strong>Right to Rectification:</strong> You can edit and update your profile, resume content, and preferences whenever you wish.
            </li>
            <li>
              <strong>Right to Erasure ("Right to be Forgotten"):</strong> You have the absolute right to delete individual reports or submit an account deletion request to purge all personal records completely.
            </li>
            <li>
              <strong>Right to Withdraw Consent:</strong> You may revoke OAuth access or withdraw consent for data processing by notifying our Data Protection team.
            </li>
          </ul>
        </section>

        {/* Section 6: Data Protection Officer & Grievance Contact */}
        <section className="legal-section contact-card-section">
          <div className="section-title">
            <Mail className="section-icon" size={20} />
            <h2>6. Data Protection Officer & Grievance Redressal</h2>
          </div>
          <p>
            In compliance with government data protection regulations, we have appointed a dedicated Grievance & Data Protection Officer (DPO) to handle any questions or concerns regarding your privacy:
          </p>
          
          <div className="compliance-contact-card">
            <div className="contact-row">
              <span className="label">Compliance Officer:</span>
              <span className="value">KIVI-AI Data Governance Team</span>
            </div>
            <div className="contact-row">
              <span className="label">Official Email:</span>
              <span className="value"><a href="mailto:privacy@kivi-ai.com">privacy@kivi-ai.com</a></span>
            </div>
            <div className="contact-row">
              <span className="label">Support Inquiries:</span>
              <span className="value"><a href="mailto:support@kivi-ai.com">support@kivi-ai.com</a></span>
            </div>
            <div className="contact-row">
              <span className="label">Response Timeframe:</span>
              <span className="value">All privacy requests are resolved within 48 to 72 business hours.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
