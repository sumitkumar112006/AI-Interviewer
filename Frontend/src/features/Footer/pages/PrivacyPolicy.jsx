import React, { useState } from 'react';
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
  Share2,
  Download,
  Printer,
  Scale,
  Clock,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import '../footer.pages.scss';

const PrivacyPolicy = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const handlePrint = () => {
    window.print();
  };

  const sections = [
    { id: 'sec-fiduciary', title: '1. Data Fiduciary & Applicability' },
    { id: 'sec-collection', title: '2. Personal Data We Collect' },
    { id: 'sec-purpose', title: '3. Lawful Grounds & Purpose of Processing' },
    { id: 'sec-processors', title: '4. AI Inference & Sub-Processors' },
    { id: 'sec-security', title: '5. Security Safeguards & Encryption' },
    { id: 'sec-retention', title: '6. Data Retention & Account Deletion' },
    { id: 'sec-rights', title: '7. Statutory Rights of the Data Principal' },
    { id: 'sec-children', title: '8. Protection of Children’s Personal Data' },
    { id: 'sec-breach', title: '9. Data Breach Notification Protocol' },
    { id: 'sec-grievance', title: '10. Grievance Redressal & Board Details' }
  ];

  return (
    <div className="footer-page-container">
      {/* ===== BANNER HEADER ===== */}
      <div className="footer-page-banner">
        <div className="banner-icon-badge">
          <Shield size={32} />
        </div>

        <span className="banner-compliance-pill">
          <Scale size={13} /> DPDP ACT, 2023 & RULES, 2025 COMPLIANT
        </span>

        <h1>Privacy Policy & Data Governance</h1>
        
        <p className="subtitle">
          Transparent, statutory data governance framework. Learn how KIVI-AI protects your candidate profile, uploaded resumes, audio responses, and AI interview evaluations under the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong>, <strong>DPDP Rules, 2025</strong>, and international privacy standards.
        </p>

        <div className="banner-meta-row">
          <div className="meta-item">
            <span>Jurisdiction:</span> <strong>Republic of India</strong>
          </div>
          <div className="meta-item">
            <span>Version:</span> <strong>v2.5 (Statutory Edition)</strong>
          </div>
          <div className="meta-item">
            <span>Effective Date:</span> <strong>September 2026</strong>
          </div>
          <div className="meta-item">
            <span>Classification:</span> <strong>Public Legal Policy</strong>
          </div>
        </div>

        <div className="banner-actions">
          <a 
            href="/DPDP_Privacy_Policy_and_Compliance_Guide.pdf" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn-banner-action primary"
            download
          >
            <Download size={14} />
            <span>Download Official DPDP Guide (PDF)</span>
          </a>
          <button 
            type="button" 
            onClick={handlePrint} 
            className="btn-banner-action"
            title="Print Policy Document"
          >
            <Printer size={14} />
            <span>Print Policy</span>
          </button>
        </div>
      </div>

      {/* ===== CORE STATUTORY PRIVACY GUARANTEES ===== */}
      <div className="legal-highlight-box">
        <div className="highlight-header">
          <div className="highlight-title">
            <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
            <span>Statutory Privacy Guarantees</span>
          </div>
          <span className="highlight-tag">ENFORCEABLE GUARANTEES</span>
        </div>

        <div className="highlight-grid">
          <div className="highlight-item">
            <div className="item-icon-title">
              <Cpu size={18} style={{ color: 'var(--pub-accent)' }} />
              <span>Zero Model Training</span>
            </div>
            <p>
              Your uploaded resumes, cover letters, and interview voice recordings are <strong>NEVER used to train or fine-tune public AI models</strong> (e.g. Groq, OpenAI, Gemini).
            </p>
          </div>

          <div className="highlight-item">
            <div className="item-icon-title">
              <Lock size={18} style={{ color: 'var(--pub-accent)' }} />
              <span>Bank-Grade Encryption</span>
            </div>
            <p>
              All traffic is protected with <strong>TLS 1.3 in-transit</strong> and sensitive career data is encrypted with <strong>AES-256 at-rest</strong> across enterprise cloud databases.
            </p>
          </div>

          <div className="highlight-item">
            <div className="item-icon-title">
              <Shield size={18} style={{ color: 'var(--pub-accent)' }} />
              <span>Zero Data Selling</span>
            </div>
            <p>
              We do not sell, rent, or monetize your candidate profile with recruiters, third-party brokers, or advertisers. You have 100% data ownership.
            </p>
          </div>

          <div className="highlight-item">
            <div className="item-icon-title">
              <Clock size={18} style={{ color: 'var(--pub-accent)' }} />
              <span>30-Day Permanent Purge</span>
            </div>
            <p>
              When you delete your account, all your resumes, audio transcripts, feedback scorecards, and tokens are permanently purged from active systems within 30 days.
            </p>
          </div>
        </div>
      </div>

      {/* ===== QUICK JUMP NAVIGATION ===== */}
      <nav className="legal-toc-bar" aria-label="Privacy Policy Table of Contents">
        <div className="toc-label">
          <FileCheck size={14} /> Jump To:
        </div>
        <div className="toc-pills">
          {sections.map((sec) => (
            <a key={sec.id} href={`#${sec.id}`} className="toc-pill">
              {sec.title}
            </a>
          ))}
        </div>
      </nav>

      {/* ===== LEGAL CONTENT SECTIONS ===== */}
      <div className="footer-page-content">

        {/* Section 1: Data Fiduciary & Applicability */}
        <section id="sec-fiduciary" className="legal-section">
          <div className="section-title">
            <div className="title-left">
              <FileText className="section-icon" size={22} />
              <h2>1. Data Fiduciary & Statutory Scope</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT § 2(i) & § 8(1)</span>
          </div>

          <p>
            This Privacy Policy (the <strong>"Policy"</strong>) sets forth the principles and practices of <strong>KIVI-AI Technologies Inc.</strong> (<strong>"Company"</strong>, <strong>"We"</strong>, <strong>"Us"</strong>, <strong>"Our"</strong>), operating as a <strong>Data Fiduciary</strong> under the <em>Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023, Republic of India)</em> and the <em>DPDP Rules, 2025</em>, in collecting, storing, processing, and safeguarding the digital personal data of registered users, candidates, and visitors (<strong>"Data Principals"</strong>, <strong>"You"</strong>, <strong>"Your"</strong>).
          </p>

          <p>
            This Policy applies to all digital personal data processed via the KIVI-AI web platform, API endpoints, mock interview simulators, resume studio, and career diagnostic tools. Under Section 8(1) of the Act, KIVI-AI remains legally responsible for complying with the provisions of the Act for any processing undertaken by it or on its behalf.
          </p>

          <div className="legal-callout-box">
            <AlertCircle size={18} className="callout-icon" />
            <div>
              <strong>Legal Binding:</strong> By registering an account, checking the consent confirmation box, or using our AI interview features, you acknowledge that you have read and agreed to this statutory policy.
            </div>
          </div>
        </section>

        {/* Section 2: Categories of Personal Data We Collect */}
        <section id="sec-collection" className="legal-section">
          <div className="section-title">
            <div className="title-left">
              <Database className="section-icon" size={22} />
              <h2>2. Categories of Personal Data We Collect</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT § 8(3) & DATA MINIMIZATION</span>
          </div>

          <p>
            In strict compliance with data minimization principles under Section 8(3), we collect only the personal information essential for conducting AI mock interviews, generating ATS resumes, and managing your account:
          </p>

          <div className="legal-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Data Elements Collected</th>
                  <th>DPDP Lawful Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Account Credentials</strong></td>
                  <td>Full Name, Email Address, Salted Password Hash (Bcrypt), Email Verification Status</td>
                  <td>User authentication, identity verification, password reset OTPs, session security.</td>
                </tr>
                <tr>
                  <td><strong>Professional Profile</strong></td>
                  <td>Uploaded PDF/Doc Resumes, Target Job Roles, Target Companies, Experience Level, Skill Tags</td>
                  <td>Tailoring mock interview scenarios, STAR questions, and ATS keyword scoring.</td>
                </tr>
                <tr>
                  <td><strong>Interview Telemetry & Audio</strong></td>
                  <td>Microphone audio streams, voice-to-text transcripts, typed responses, STAR scorecards</td>
                  <td>Real-time speech-to-text transcription, AI communication analysis, and metric reports.</td>
                </tr>
                <tr>
                  <td><strong>Billing & Orders</strong></td>
                  <td>Plan Tier (Free/Pro/Premium), Razorpay/Stripe Order IDs, Tax Invoice History</td>
                  <td>Fulfilling subscription orders, processing payments, and statutory tax accounting.</td>
                </tr>
                <tr>
                  <td><strong>System Telemetry</strong></td>
                  <td>IP Address, Browser User-Agent, Operating System, Timestamp of Consent Checkbox</td>
                  <td>Audit logging, preventing brute-force attacks, and statutory compliance evidence.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Lawful Grounds for Processing */}
        <section id="sec-purpose" className="legal-section">
          <div className="section-title">
            <div className="title-left">
              <CheckCircle2 className="section-icon" size={22} />
              <h2>3. Lawful Grounds & Purpose of Processing</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT § 4 & § 7</span>
          </div>

          <p>
            Under Section 4 and Section 7 of the DPDP Act 2023, digital personal data is processed solely under two lawful grounds:
          </p>

          <ul className="legal-list">
            <li>
              <strong>1. Explicit, Affirmative Consent (Section 6):</strong> Obtained during registration via an unticked, mandatory checkbox. Used for AI mock interview voice recording, resume generation, ATS scoring, and career analytics.
            </li>
            <li>
              <strong>2. Specified Legitimate Uses (Section 7):</strong> For fulfilling transactions voluntarily requested (e.g. issuing payment invoices, delivering transactional OTP emails, account security audits).
            </li>
          </ul>

          <div className="legal-callout-box">
            <Lock size={18} className="callout-icon" />
            <div>
              <strong>Strict Purpose Limitation:</strong> We never repurpose your data for third-party advertising, commercial profiling, or recruiter databases without your explicit, separate opt-in consent.
            </div>
          </div>
        </section>

        {/* Section 4: AI Inference & Sub-Processors */}
        <section id="sec-processors" className="legal-section">
          <div className="section-title">
            <div className="title-left">
              <Cpu className="section-icon" size={22} />
              <h2>4. AI Inference & Third-Party Sub-Processors</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT § 8(2) & RULE 6(1)(f)</span>
          </div>

          <p>
            In accordance with Section 8(2) and Rule 6(1)(f), KIVI-AI executes legally binding <strong>Data Processing Addendums (DPAs)</strong> with all third-party infrastructure providers. These agreements enforce enterprise-grade security and prohibit third parties from training public AI models on your personal data:
          </p>

          <div className="legal-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data Processor</th>
                  <th>Role / Service</th>
                  <th>Data Processed</th>
                  <th>DPA & Training Restrictions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Groq / OpenAI</strong></td>
                  <td>AI LLM Inference Engine</td>
                  <td>Anonymized prompt text & interview answers</td>
                  <td><strong>Zero Data Retention (ZDR)</strong>. Strict contractual ban on model training.</td>
                </tr>
                <tr>
                  <td><strong>MongoDB Atlas</strong></td>
                  <td>Encrypted Cloud Database</td>
                  <td>Encrypted user accounts, reports, resumes</td>
                  <td>AES-256 storage encryption at-rest, SOC-2 Type II & ISO 27001 certified.</td>
                </tr>
                <tr>
                  <td><strong>Razorpay / Stripe</strong></td>
                  <td>PCI-DSS Payment Gateway</td>
                  <td>Billing order info, payment tokens</td>
                  <td>PCI-DSS Level 1 compliant. Raw credit card numbers are never stored on KIVI-AI.</td>
                </tr>
                <tr>
                  <td><strong>Vercel / AWS</strong></td>
                  <td>Global CDN & Compute</td>
                  <td>Encrypted web traffic & SSL certificates</td>
                  <td>TLS 1.3 in-transit encryption, DDoS mitigation, rate-limiting.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Security Safeguards */}
        <section id="sec-security" className="legal-section">
          <div className="section-title">
            <div className="title-left">
              <Lock className="section-icon" size={22} />
              <h2>5. Security Safeguards & Encryption</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT § 8(5) & RULE 6</span>
          </div>

          <p>
            Under Section 8(5) and Rule 6 of the DPDP Rules 2025, KIVI-AI implements state-of-the-art technical, physical, and organizational safeguards:
          </p>

          <ul className="legal-list">
            <li>
              <strong>End-to-End In-Transit Encryption:</strong> All traffic between your browser and our servers is secured via <strong>TLS 1.3</strong> with automated HSTS enforcement.
            </li>
            <li>
              <strong>At-Rest Encryption:</strong> All database clusters, disk volumes, and backups utilize <strong>AES-256</strong> hardware-level encryption.
            </li>
            <li>
              <strong>Role-Based Access Control (RBAC):</strong> Administrative access to user records is strictly partitioned (`user`, `admin`, `super_admin`) and guarded with immutable audit logs.
            </li>
            <li>
              <strong>Credential Security:</strong> User passwords are encrypted using high-cost salted Bcrypt algorithms and are never stored in plaintext.
            </li>
          </ul>
        </section>

        {/* Section 6: Data Retention & Account Deletion */}
        <section id="sec-retention" className="legal-section">
          <div className="section-title">
            <div className="title-left">
              <Clock className="section-icon" size={22} />
              <h2>6. Data Retention & One-Click Erasure</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT § 8(7) & RULE 8</span>
          </div>

          <p>
            We adhere strictly to purpose limitation. Your digital personal data is retained only for as long as your account remains active or as required by law:
          </p>

          <ul className="legal-list">
            <li>
              <strong>One-Click Account Deletion:</strong> You can permanently delete your account at any time via your Profile Settings. Upon initiation, all personal resumes, cover letters, audio transcripts, and interview feedback records are permanently erased within <strong>30 days</strong>.
            </li>
            <li>
              <strong>Statutory Tax Records:</strong> Transaction receipts, GST invoices, and order IDs are retained for the statutory period mandated under Indian Goods and Services Tax (GST) and Income Tax laws before automated purging.
            </li>
          </ul>
        </section>

        {/* Section 7: Rights of the Data Principal */}
        <section id="sec-rights" className="legal-section">
          <div className="section-title">
            <div className="title-left">
              <UserCheck className="section-icon" size={22} />
              <h2>7. Enforceable Rights of the Data Principal</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT CHAPTER III (§ 11–14)</span>
          </div>

          <p>
            As a Data Principal under Indian law, you possess enforceable statutory rights that you may exercise free of charge:
          </p>

          <div className="legal-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Statutory Right</th>
                  <th>Legal Section</th>
                  <th>How to Exercise on KIVI-AI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Right to Access Information</strong></td>
                  <td>DPDP Act § 11</td>
                  <td>View and download your full interview history, ATS resumes, and reports directly from your dashboard or request a machine-readable JSON/PDF export.</td>
                </tr>
                <tr>
                  <td><strong>Right to Correction & Completion</strong></td>
                  <td>DPDP Act § 12</td>
                  <td>Edit, update, or complete your career profile, experience level, target roles, or resume content at any time in the Resume Studio.</td>
                </tr>
                <tr>
                  <td><strong>Right to Withdraw Consent</strong></td>
                  <td>DPDP Act § 6(4)</td>
                  <td>Withdraw consent for processing in Account Settings. Processing ceases immediately upon withdrawal.</td>
                </tr>
                <tr>
                  <td><strong>Right to Nominate</strong></td>
                  <td>DPDP Act § 14, Rule 14(4)</td>
                  <td>Designate an authorized representative in Profile Settings to exercise your data rights in the event of death or permanent incapacity.</td>
                </tr>
                <tr>
                  <td><strong>Right of Grievance Redressal</strong></td>
                  <td>DPDP Act § 13</td>
                  <td>Submit complaints directly to our designated Grievance Officer with guaranteed resolution within 30 days.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 8: Protection of Children */}
        <section id="sec-children" className="legal-section">
          <div className="section-title">
            <div className="title-left">
              <Shield className="section-icon" size={22} />
              <h2>8. Protection of Children’s Personal Data</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT § 9 & RULES 10, 12</span>
          </div>

          <p>
            Under Section 9 of the DPDP Act, processing data of individuals under 18 years of age is subject to verifiable parental consent, and all forms of behavioral tracking, profiling, and targeted advertising directed at children are prohibited by law.
          </p>
          <p>
            <strong>Age Restriction:</strong> KIVI-AI is strictly intended for adult job seekers, university students, and professionals aged <strong>18 and older</strong>. We do not knowingly collect personal data from minors. If you are under 18, you must not use or register on this platform.
          </p>
        </section>

        {/* Section 9: Breach Notification Protocol */}
        <section id="sec-breach" className="legal-section">
          <div className="section-title">
            <div className="title-left">
              <AlertCircle className="section-icon" size={22} />
              <h2>9. Personal Data Breach Notification Protocol</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT § 8(6) & RULE 7</span>
          </div>

          <p>
            In the event of a personal data breach affecting confidentiality or integrity, KIVI-AI maintains an automated Incident Response Protocol adhering to Section 8(6) and Rule 7:
          </p>

          <ul className="legal-list">
            <li>
              <strong>Notification to Affected Users:</strong> We will notify all affected Data Principals via registered email without undue delay, describing the nature of the breach, affected data categories, and recommended safety steps.
            </li>
            <li>
              <strong>Mandatory Notification to the Board:</strong> A formal, detailed security report will be filed with the <strong>Data Protection Board of India</strong> within <strong>72 hours</strong> of confirmation.
            </li>
          </ul>
        </section>

        {/* Section 10: Grievance Officer & Data Protection Board */}
        <section id="sec-grievance" className="legal-section contact-card-section">
          <div className="section-title">
            <div className="title-left">
              <Mail className="section-icon" size={22} />
              <h2>10. Grievance Redressal & Data Protection Board</h2>
            </div>
            <span className="law-cite-badge">DPDP ACT § 13 & § 18</span>
          </div>

          <p>
            Under Section 13 and Rule 9 of the DPDP Rules 2025, you have the right to lodge complaints regarding your personal data. We have appointed a dedicated <strong>Data Grievance Officer</strong>:
          </p>

          <div className="grievance-contact-grid">
            <div className="contact-card">
              <span className="contact-card-label">Designated Grievance Officer</span>
              <span className="contact-card-val">Data Protection & Privacy Lead</span>
              <span className="contact-card-sub">KIVI-AI Technologies Inc.</span>
            </div>

            <div className="contact-card">
              <span className="contact-card-label">Grievance & Legal Email</span>
              <span className="contact-card-val">
                <a href="mailto:grievance@kivi-ai.com">grievance@kivi-ai.com</a>
              </span>
              <span className="contact-card-sub">Monitored 24/7 for privacy inquiries</span>
            </div>

            <div className="contact-card">
              <span className="contact-card-label">Statutory Resolution Window</span>
              <span className="contact-card-val">15 to 30 Business Days</span>
              <span className="contact-card-sub">Acknowledged within 48 hours (DPDP Cap: 90 days)</span>
            </div>

            <div className="contact-card">
              <span className="contact-card-label">Appellate Regulatory Body</span>
              <span className="contact-card-val">Data Protection Board of India</span>
              <span className="contact-card-sub">Statutory authority under Section 18 of DPDP Act</span>
            </div>
          </div>

          <div className="legal-callout-box" style={{ marginTop: '0.75rem' }}>
            <Scale size={18} className="callout-icon" />
            <div>
              <strong>Right to Appeal:</strong> If your grievance is not resolved satisfactorily by our Grievance Officer within the published period, you have the statutory right to escalate the matter to the <strong>Data Protection Board of India</strong>.
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default PrivacyPolicy;
