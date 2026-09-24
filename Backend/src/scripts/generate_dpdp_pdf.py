import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "AI Interviewer & Resume Generator — DPDP Compliance & Privacy Policy Guide")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)
        
        # Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 45, 558, 45)
        self.drawString(54, 32, "Confidential — Prepared under Digital Personal Data Protection (DPDP) Act, 2023 & Rules 2025")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 32, page_text)
        self.restoreState()


def build_dpdp_pdf(output_paths):
    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#0F172A")    # Deep Navy / Charcoal
    secondary_color = colors.HexColor("#1E40AF")  # Deep Blue
    accent_color = colors.HexColor("#0284C7")     # Ocean Blue
    dark_text = colors.HexColor("#1E293B")        # Slate 800
    muted_text = colors.HexColor("#475569")       # Slate 600
    light_bg = colors.HexColor("#F8FAFC")         # Slate 50
    border_color = colors.HexColor("#CBD5E1")     # Slate 300

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=primary_color,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=secondary_color,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=secondary_color,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=dark_text,
        spaceAfter=5
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=dark_text,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=dark_text,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    box_title = ParagraphStyle(
        'BoxTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=secondary_color,
        spaceAfter=4
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=dark_text
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=dark_text
    )

    def create_callout(title, text, bg=light_bg, stroke=border_color):
        content = [
            Paragraph(title, box_title),
            Paragraph(text, body_style)
        ]
        t = Table([[content]], colWidths=[504])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), bg),
            ('BOX', (0,0), (-1,-1), 1, stroke),
            ('TOPPADDING', (0,0), (-1,-1), 7),
            ('BOTTOMPADDING', (0,0), (-1,-1), 7),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ]))
        return t

    for out_path in output_paths:
        doc = SimpleDocTemplate(
            out_path,
            pagesize=letter,
            leftMargin=54,
            rightMargin=54,
            topMargin=54,
            bottomMargin=54
        )

        story = []

        # ==========================================
        # COVER / HEADER BANNER
        # ==========================================
        story.append(Paragraph("DIGITAL PERSONAL DATA PROTECTION (DPDP) COMPLIANCE & PRIVACY POLICY", title_style))
        story.append(Paragraph("Comprehensive 20-Point Analysis, Ready-to-Use Privacy Policy & User Consent Architecture for AI Interviewer & Resume Generator", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=secondary_color, spaceBefore=2, spaceAfter=12))

        # Metadata Table
        meta_data = [
            [
                Paragraph("<b>Document Version:</b> 1.0", table_cell),
                Paragraph("<b>Applicable Law:</b> DPDP Act 2023 & Rules 2025", table_cell)
            ],
            [
                Paragraph("<b>Application:</b> AI Interviewer & Resume Generator", table_cell),
                Paragraph("<b>Classification:</b> Legal & Compliance Framework", table_cell)
            ]
        ]
        meta_table = Table(meta_data, colWidths=[250, 254])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), light_bg),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 10))

        # Executive Summary Callout
        story.append(create_callout(
            "Executive Overview",
            "This document provides an exhaustive breakdown of all <b>20 core DPDP principles</b> outlined in the <i>Digital Personal Data Protection Act, 2023</i> and <i>DPDP Rules, 2025</i>. It translates statutory mandates directly into operational requirements for the <b>AI Mock Interview & Resume Generator Platform</b>, followed by a complete legal draft of the <b>Privacy Policy</b>, exact <b>Consent Checkbox specifications</b> for user registration, and a technical implementation checklist."
        ))
        story.append(Spacer(1, 12))

        # ==========================================
        # PART I: THE 20 DPDP FOUNDER POINTS EXPLAINED
        # ==========================================
        story.append(Paragraph("PART I: Exhaustive Breakdown of 20 DPDP Principles for Our Application", h1_style))
        story.append(Paragraph("How each statutory provision of the DPDP Act 2023 & Rules 2025 applies directly to AI voice interviews, resume creation, AI feedback generation, and payment handling:", body_style))
        story.append(Spacer(1, 6))

        dpdp_points = [
            (
                "1. Grounds for Processing (Sections 4 & 7)",
                "<b>Statutory Requirement:</b> Digital personal data can only be processed based on clear, affirmative consent from the Data Principal or for specified legitimate uses.<br/>"
                "<b>Application to Our Platform:</b> We collect user emails, passwords, resumes, voice/audio answers, career goals, and interview feedback. Every user must provide explicit, itemized consent during registration before any data processing begins."
            ),
            (
                "2. Certain Legitimate Uses (Section 7)",
                "<b>Statutory Requirement:</b> Narrowly defined exceptions where data may be processed without explicit consent (e.g., fulfilling voluntary requests, order receipts, statutory compliance).<br/>"
                "<b>Application to Our Platform:</b> Sending transactional payment invoices/receipts (via Razorpay/Stripe), password reset OTPs, and maintaining billing tax records are processed as legitimate uses under Section 7."
            ),
            (
                "3. General Duties of the Data Fiduciary (Section 8(1))",
                "<b>Statutory Requirement:</b> The platform remains legally responsible for DPDP compliance, even when downstream third-party vendors (cloud, LLMs, STT/TTS) process the data.<br/>"
                "<b>Application to Our Platform:</b> Even if user audio is transcribed via an external STT service or resumes are analyzed using Groq / OpenAI LLMs, our company remains solely accountable for protecting user rights and confidentiality."
            ),
            (
                "4. Data Processors & Binding Contracts (Section 8(2), Rule 6(1)(f))",
                "<b>Statutory Requirement:</b> Data Fiduciaries can only engage Data Processors under a valid, written legal contract that mandates strict security standards.<br/>"
                "<b>Application to Our Platform:</b> We must maintain Data Processing Addendums (DPAs) with MongoDB Atlas, Groq/OpenAI, Razorpay, and hosting providers (Vercel/AWS), ensuring zero unauthorized retention or model training on user interview data."
            ),
            (
                "5. Data Accuracy & Integrity (Section 8(3))",
                "<b>Statutory Requirement:</b> Ensure personal data is accurate, complete, and consistent whenever it is used to make decisions affecting the person or shared externally.<br/>"
                "<b>Application to Our Platform:</b> When generating career profiles, ATS scores, and AI interview evaluations, users must have full in-app capabilities to review, edit, update, or correct their career information and interview records."
            ),
            (
                "6. Reasonable Security Safeguards (Section 8(5), Rule 6)",
                "<b>Statutory Requirement:</b> Implement robust safeguards including encryption at rest & in transit, granular access controls, security monitoring, backups, and audit logs.<br/>"
                "<b>Application to Our Platform:</b> Enforce HTTPS/TLS 1.3 for all web traffic, Bcrypt/Argon2 password hashing, encrypted database storage, JWT authentication with token expiry, and dedicated Admin audit logs for all data access."
            ),
            (
                "7. Technical & Organisational Measures (Section 8(4), Rule 6(1)(g))",
                "<b>Statutory Requirement:</b> Put structured internal workflows, staff access boundaries, and incident response protocols in place.<br/>"
                "<b>Application to Our Platform:</b> Restrict Admin Panel access using Role-Based Access Control (RBAC: `user`, `admin`, `super_admin`). Only authorized personnel can access user evaluation logs for support or troubleshooting."
            ),
            (
                "8. Personal Data Breach Notification (Section 8(6), Rule 7)",
                "<b>Statutory Requirement:</b> In the event of a personal data breach, notify affected individuals without undue delay and notify the Data Protection Board of India within 72 hours.<br/>"
                "<b>Application to Our Platform:</b> We maintain an Incident Response Protocol to immediately detect token leaks, unauthorized database queries, or server exposure, notify users via broadcast email, and file formal reports with the Board."
            ),
            (
                "9. Retention & Purpose Limitation (Section 8(7), Rule 8)",
                "<b>Statutory Requirement:</b> Personal data must not be retained indefinitely once the stated purpose has been fulfilled, unless required by tax or corporate laws.<br/>"
                "<b>Application to Our Platform:</b> Provide users with a one-click 'Delete Account' feature that permanently purges all resumes, interview audio, feedback scores, and tokens, while keeping only minimal invoice records required by Indian financial laws."
            ),
            (
                "10. Children's Personal Data (Section 9, Rules 10 & 12)",
                "<b>Statutory Requirement:</b> Processing data of individuals under 18 requires verifiable parental consent. Behavioral tracking, profiling, and targeted advertising directed at children are prohibited.<br/>"
                "<b>Application to Our Platform:</b> The service is strictly intended for job seekers and students aged 18 and older. Registration includes an age-confirmation affirmation: <i>'I confirm I am at least 18 years of age.'</i>"
            ),
            (
                "11. Right to Access Information (Section 11)",
                "<b>Statutory Requirement:</b> Users have the legal right to obtain a summary of their personal data processed and a list of all Data Processors who have received their data.<br/>"
                "<b>Application to Our Platform:</b> Users can view all generated resumes, cover letters, and interview evaluation reports in their profile dashboard, and can request a full machine-readable JSON/PDF export of their data at any time."
            ),
            (
                "12. Grievance Redressal Mechanism (Section 13, Rules 9 & 14(3))",
                "<b>Statutory Requirement:</b> Publish clear contact info of a Grievance Officer and resolve data complaints within a published window (statutory maximum is 90 days, target: 15–30 days).<br/>"
                "<b>Application to Our Platform:</b> Designate a Data Grievance Officer with a dedicated support email (e.g., <code>privacy@yourdomain.com</code>) accessible from the footer and settings page."
            ),
            (
                "13. Right to Nominate (Section 14, Rule 14(4))",
                "<b>Statutory Requirement:</b> Enable the Data Principal to nominate another person to exercise their data rights in case of death or permanent incapacity.<br/>"
                "<b>Application to Our Platform:</b> Provide an optional 'Data Nominee' field in Profile Settings allowing users to name a trusted contact to manage or delete their account data if needed."
            ),
            (
                "14. Consent Manager Integration (Sections 2(g), 6(7)-(9), Rule 4)",
                "<b>Statutory Requirement:</b> Support interoperability with registered Consent Managers as the ecosystem rolls out under the DPDP Rules.<br/>"
                "<b>Application to Our Platform:</b> Maintain an accessible 'Consent & Privacy' management tab where users can view granted consents, adjust preferences, or withdraw consent at any time."
            ),
            (
                "15. Cross-Border Data Processing (Section 16, Rules 13(4) & 15)",
                "<b>Statutory Requirement:</b> Personal data can be transferred outside India unless specifically restricted to blacklisted jurisdictions by the Central Government.<br/>"
                "<b>Application to Our Platform:</b> Clarify in the Privacy Policy that AI LLM inference (e.g. Groq/OpenAI cloud servers) and global CDN delivery may process data securely across international servers adhering to enterprise encryption standards."
            ),
            (
                "16. Significant Data Fiduciary (SDF) Provisions (Section 10)",
                "<b>Statutory Requirement:</b> Entities classified as SDFs by the government based on volume, sensitivity, or risk are subject to enhanced obligations.<br/>"
                "<b>Application to Our Platform:</b> As a fast-growing career platform, we build security controls upfront so that if scale warrants SDF designation, mandatory compliance systems are already active."
            ),
            (
                "17. Data Protection Officer (DPO) (Section 10(2)(a))",
                "<b>Statutory Requirement:</b> Mandatory India-based DPO who reports directly to executive leadership and acts as the official liaison for the Data Protection Board.<br/>"
                "<b>Application to Our Platform:</b> Formally designate an India-based privacy lead / DPO with contact information published directly inside the Privacy Policy."
            ),
            (
                "18. Data Protection Impact Assessment (DPIA) (Section 10(2)(c), Rule 13(1))",
                "<b>Statutory Requirement:</b> Periodic assessments of data processing risks, especially before launching new profiling or automated scoring systems.<br/>"
                "<b>Application to Our Platform:</b> Perform annual risk reviews of automated AI scoring algorithms (technical score, communication score) to ensure unbiased evaluation, data safety, and zero leakage."
            ),
            (
                "19. Independent Data Audits (Section 10(2)(b)-(c), Rule 13(1))",
                "<b>Statutory Requirement:</b> Periodic audits by independent cybersecurity / compliance auditors to verify that security controls operate effectively.<br/>"
                "<b>Application to Our Platform:</b> Conduct annual code vulnerability scans, penetration testing, and database access log reviews across Backend API and Admin endpoints."
            ),
            (
                "20. Data Protection Board of India & Penalties (Sections 18, 27, 33)",
                "<b>Statutory Requirement:</b> The Board investigates violations and can levy statutory penalties up to ₹250 crore for severe security failures or failure to notify breaches.<br/>"
                "<b>Application to Our Platform:</b> Demonstrable compliance, rigorous audit logging, clear consent flows, and proactive security safeguards protect the company against liability."
            )
        ]

        for title, desc in dpdp_points:
            p_title = Paragraph(title, h2_style)
            p_desc = Paragraph(desc, body_style)
            story.append(p_title)
            story.append(p_desc)
            story.append(Spacer(1, 4))

        story.append(PageBreak())

        # ==========================================
        # PART II: COMPLETE PRIVACY POLICY DRAFT
        # ==========================================
        story.append(Paragraph("PART II: Ready-to-Use Privacy Policy for Our Web Application", title_style))
        story.append(Paragraph("A production-ready legal draft compliant with the DPDP Act 2023, drafted specifically for your AI Interviewer & Resume Generator Platform.", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1, color=secondary_color, spaceBefore=2, spaceAfter=10))

        policy_sections = [
            (
                "1. Introduction & Scope",
                "This Privacy Policy ('Policy') explains how <b>AI Interviewer & Resume Generator</b> ('Company', 'We', 'Us', 'Our'), acting as a <b>Data Fiduciary</b> under the <i>Digital Personal Data Protection Act, 2023 (DPDP Act)</i> and the <i>DPDP Rules, 2025</i>, collects, uses, stores, processes, and safeguards the digital personal data of its users ('Data Principals', 'You', 'Your').<br/>"
                "By creating an account, accessing our platform, generating resumes, or participating in AI mock interviews, you acknowledge and agree to the practices outlined in this Policy."
            ),
            (
                "2. Personal Data We Collect",
                "We collect only the minimum personal data required to deliver high-quality career preparation tools:<br/>"
                "• <b>Account Identification:</b> Full name, username, email address, password (stored strictly as salted hashes), and email verification status.<br/>"
                "• <b>Career & Professional Profile:</b> Uploaded resumes, target job roles, target companies, experience level (Fresher/Mid/Senior), skills, projects, and work history.<br/>"
                "• <b>Mock Interview Content:</b> Audio/speech recordings, voice-to-text transcripts, questions answered, technical answers, AI scores, and generated feedback reports.<br/>"
                "• <b>Billing & Transaction Details:</b> Subscription tier (Free, Pro, Premium), payment order IDs, invoice history (processed securely via PCI-DSS compliant gateways like Razorpay/Stripe; we do not store raw card/banking numbers).<br/>"
                "• <b>Technical & Device Telemetry:</b> IP address, browser type, device operating system, login timestamps, and usage tracking (interview quota, AI credits consumed)."
            ),
            (
                "3. Purpose of Data Processing",
                "Your personal data is processed strictly for specified, lawful purposes based on your explicit consent:<br/>"
                "• Conducting dynamic AI mock interview simulations tailored to your target job profile.<br/>"
                "• Providing AI-powered resume enhancement, ATS scoring, and tailored cover letter generation.<br/>"
                "• Generating personalized interview performance metrics (Technical, Communication, and Confidence scores).<br/>"
                "• Managing your account, authenticating sessions, tracking monthly usage quotas, and processing billing transactions.<br/>"
                "• Complying with statutory legal obligations and preventing platform abuse or fraud."
            ),
            (
                "4. AI Processing & Third-Party Data Processors",
                "To deliver state-of-the-art AI features, we partner with reputable Data Processors under strict Data Processing Agreements (DPAs):<br/>"
                "• <b>AI Inference Providers (e.g., Groq, OpenAI):</b> Process interview questions and resume text via encrypted API calls. We enforce zero-retention policies ensuring your data is not used to train public AI models.<br/>"
                "• <b>Cloud & Database Hosting (e.g., MongoDB Atlas, AWS, Vercel):</b> Enterprise-grade encrypted database and server infrastructure.<br/>"
                "• <b>Payment Gateways (e.g., Razorpay, Stripe):</b> Direct processing of subscription payments under PCI-DSS compliance."
            ),
            (
                "5. Data Security Safeguards",
                "In compliance with Section 8(5) of the DPDP Act, we implement rigorous technical and organizational security measures:<br/>"
                "• End-to-end TLS 1.3 encryption for all data in transit.<br/>"
                "• Industry-standard AES-256 encryption for sensitive database records at rest.<br/>"
                "• Role-Based Access Controls (RBAC) ensuring only authorized administrative personnel can access troubleshooting logs.<br/>"
                "• Continuous audit logging, brute-force protection, rate-limiting, and routine automated vulnerability scans."
            ),
            (
                "6. Data Retention & Account Deletion Policy",
                "We adhere strictly to purpose limitation. Your personal data, resumes, and interview records are retained only as long as your account remains active or as required to fulfill the service.<br/>"
                "• <b>Right to Erasure:</b> You may delete your account at any time through your Profile Settings. Upon deletion, all personal data, resumes, cover letters, and interview recordings are permanently purged from our active databases within 30 days.<br/>"
                "• <b>Tax/Legal Records:</b> Minimal transaction and tax invoice records are retained solely for the statutory period mandated under applicable Indian tax laws."
            ),
            (
                "7. Rights of the Data Principal",
                "Under Chapter III of the DPDP Act, 2023, you have enforceable statutory rights:<br/>"
                "• <b>Right to Access:</b> View and download a summary of all personal data, reports, and resumes processed by us.<br/>"
                "• <b>Right to Correction & Completion:</b> Update or edit any inaccurate career details, resumes, or profile data.<br/>"
                "• <b>Right to Withdraw Consent:</b> Withdraw previously granted consent at any time; upon withdrawal, processing is halted (this may affect service availability).<br/>"
                "• <b>Right of Grievance Redressal:</b> Lodge a grievance directly with our designated Grievance Officer.<br/>"
                "• <b>Right to Nominate:</b> Designate an authorized representative to exercise your data rights in the event of death or incapacity."
            ),
            (
                "8. Protection of Children's Data",
                "Our platform is designed strictly for adults, students, and professionals seeking employment. We do not knowingly collect personal data from individuals under 18 years of age. All users must confirm that they are at least 18 years of age during registration."
            ),
            (
                "9. Grievance Redressal & Contact Details",
                "If you have any questions, concerns, complaints, or wish to exercise your statutory data rights, you may contact our designated <b>Data Grievance Officer</b>:<br/>"
                "• <b>Grievance Officer:</b> Data Protection Lead<br/>"
                "• <b>Email Address:</b> <code>privacy@yourdomain.com</code> / <code>grievance@yourdomain.com</code><br/>"
                "• <b>Physical Address:</b> AI Interviewer & Resume Generator Labs, India<br/>"
                "• <b>Statutory Response Window:</b> We acknowledge all grievances within 48 hours and resolve them within 15–30 business days (well within the DPDP statutory 90-day ceiling)."
            )
        ]

        for sec_title, sec_body in policy_sections:
            story.append(Paragraph(sec_title, h2_style))
            story.append(Paragraph(sec_body, body_style))
            story.append(Spacer(1, 4))

        story.append(PageBreak())

        # ==========================================
        # PART III: REGISTRATION CHECKBOX SPECIFICATION
        # ==========================================
        story.append(Paragraph("PART III: Registration Page Consent Checkbox Architecture", title_style))
        story.append(Paragraph("Exact UI/UX wording, technical validation, and database audit logging requirements under DPDP Section 6.", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1, color=secondary_color, spaceBefore=2, spaceAfter=10))

        story.append(Paragraph("1. Legally Valid Consent Rules under DPDP Act 2023", h1_style))
        story.append(Paragraph("Under Section 6 of the DPDP Act, consent is valid <b>only</b> if it meets the following four statutory criteria:", body_style))
        story.append(Paragraph("• <b>Free:</b> User cannot be coerced. No hidden pre-ticked checkboxes are permitted.", bullet_style))
        story.append(Paragraph("• <b>Specific & Informed:</b> User must clearly understand what data is collected (resume, voice, career info) and why.", bullet_style))
        story.append(Paragraph("• <b>Unconditional:</b> Consent cannot bundle unrelated marketing permissions with core platform functionality.", bullet_style))
        story.append(Paragraph("• <b>Clear Affirmative Action:</b> The user must actively click the checkbox before the 'Sign Up' button unlocks.", bullet_style))
        story.append(Spacer(1, 6))

        story.append(Paragraph("2. Exact UI Checkbox Text & Layout Specification", h1_style))
        
        box_spec_html = (
            "<b>Implemented UI Checkbox Layout:</b><br/><br/>"
            "<font color='#0284C7'>[ &#9633; ]</font> &nbsp; <b>I agree to the <font color='#1E40AF'>Terms of Service</font> and <font color='#1E40AF'>Privacy Policy</font></b>"
        )
        story.append(create_callout("Registration Checkbox UI Component", box_spec_html, bg=colors.HexColor("#EFF6FF"), stroke=colors.HexColor("#93C5FD")))
        story.append(Spacer(1, 10))

        story.append(Paragraph("3. Technical Audit Trail: What to Store in Database", h1_style))
        story.append(Paragraph("To prove compliance before the Data Protection Board in case of inquiry, the user document in MongoDB should store the consent event timestamp and IP address upon registration:", body_style))

        audit_schema_data = [
            [Paragraph("<b>Field Name</b>", table_header), Paragraph("<b>Type</b>", table_header), Paragraph("<b>Description & DPDP Purpose</b>", table_header)],
            [Paragraph("<code>consentGiven</code>", table_cell_bold), Paragraph("Boolean", table_cell), Paragraph("Must be <code>true</code>. Registration fails if not checked.", table_cell)],
            [Paragraph("<code>consentTimestamp</code>", table_cell_bold), Paragraph("Date", table_cell), Paragraph("Exact ISO timestamp when the user checked the box and submitted.", table_cell)],
            [Paragraph("<code>consentVersion</code>", table_cell_bold), Paragraph("String", table_cell), Paragraph("Version of the Privacy Policy consented to (e.g., <code>'v1.0-dpdp-2026'</code>).", table_cell)],
            [Paragraph("<code>consentIp</code>", table_cell_bold), Paragraph("String", table_cell), Paragraph("Client IP address at registration for evidentiary audit trail.", table_cell)],
            [Paragraph("<code>ageConfirmed18Plus</code>", table_cell_bold), Paragraph("Boolean", table_cell), Paragraph("Confirmation of legal age under Section 9.", table_cell)]
        ]
        audit_table = Table(audit_schema_data, colWidths=[120, 74, 310])
        audit_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), secondary_color),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(audit_table)
        story.append(Spacer(1, 12))

        # ==========================================
        # PART IV: COMPLIANCE CHECKLIST FOR FOUNDERS
        # ==========================================
        story.append(Paragraph("PART IV: Actionable DPDP Implementation Checklist", h1_style))
        
        checklist_items = [
            ("Frontend Register Page", "Add unticked consent checkbox with clickable links to Privacy Policy modal/page. Prevent form submit unless checked."),
            ("Backend Auth Controller", "Validate <code>consentGiven: true</code> in <code>registerController</code> and persist consent timestamp + IP."),
            ("Privacy Policy Page", "Publish full Privacy Policy on <code>/privacy-policy</code> with Grievance Officer details."),
            ("Account Deletion API", "Ensure <code>DELETE /api/users/me</code> or Admin delete completely deletes user resumes, cover letters, and reports."),
            ("Vendor DPA Agreements", "Verify that Groq, OpenAI, and MongoDB Atlas DPAs prohibit training on customer data."),
            ("Data Breach Protocol", "Maintain an internal 72-hour incident response template to notify the Data Protection Board of India.")
        ]

        chk_data = [
            [Paragraph("<b>Component / Area</b>", table_header), Paragraph("<b>Action Required</b>", table_header)]
        ]
        for area, action in checklist_items:
            chk_data.append([
                Paragraph(f"<b>{area}</b>", table_cell_bold),
                Paragraph(action, table_cell)
            ])

        chk_table = Table(chk_data, colWidths=[140, 364])
        chk_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), primary_color),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(chk_table)
        story.append(Spacer(1, 14))

        # Concluding note
        story.append(create_callout(
            "Founder Advisory Note",
            "This document provides a comprehensive operational and legal blueprint under India's DPDP Act, 2023 & DPDP Rules, 2025. You can review the PDF in detail, share it with legal counsel if required, and subsequently activate the Privacy Policy and registration checkbox in the web application."
        ))

        # Build document with custom numbered canvas
        doc.build(story, canvasmaker=NumberedCanvas)
        print(f"Successfully generated PDF at: {out_path}")

if __name__ == "__main__":
    base_dir = r"c:\Users\Sumit\Desktop\Sumit_Data\Resume Generator"
    artifact_dir = r"C:\Users\Sumit\.gemini\antigravity-ide\brain\67ae2437-fe15-4268-8044-be4486f8e51d"
    public_dir = os.path.join(base_dir, "Frontend", "public")
    
    os.makedirs(artifact_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)
    
    targets = [
        os.path.join(base_dir, "DPDP_Privacy_Policy_and_Compliance_Guide.pdf"),
        os.path.join(artifact_dir, "DPDP_Privacy_Policy_and_Compliance_Guide.pdf"),
        os.path.join(public_dir, "DPDP_Privacy_Policy_and_Compliance_Guide.pdf")
    ]
    
    build_dpdp_pdf(targets)
