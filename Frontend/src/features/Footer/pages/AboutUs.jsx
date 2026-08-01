import React from 'react';
import { Sparkles, Target, Zap, Cpu, Award, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../footer.pages.scss';

const AboutUs = () => {
  return (
    <div className="footer-page-container">
      <div className="footer-page-banner">
        <div className="banner-icon-badge accent-pink">
          <Sparkles size={32} />
        </div>
        <h1>About KIVI-AI</h1>
        <p className="subtitle">
          Next-Gen AI Interview Intelligence & Career Optimization Platform.
        </p>
      </div>

      <div className="footer-page-content">
        {/* Mission Statement Card */}
        <section className="about-hero-card">
          <div className="hero-card-left">
            <span className="eyebrow-tag">OUR MISSION</span>
            <h2>Empowering Candidates to Ace Every Interview</h2>
            <p>
              KIVI-AI was built to bridge the gap between job requirements and candidate preparation. By analyzing your resume against target job descriptions, our platform delivers actionable skill gap analysis, curated technical & behavioral practice questions, day-wise roadmaps, and instant CV generation.
            </p>
          </div>
          <div className="hero-card-right">
            <div className="ai-stat-box">
              <span className="stat-number">95%+</span>
              <span className="stat-label">Candidate Readiness Boost</span>
            </div>
          </div>
        </section>

        {/* Core Pillars */}
        <section className="about-pillars-section">
          <h2 className="section-heading">Why Choose KIVI-AI?</h2>
          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-icon">
                <Target size={24} />
              </div>
              <h3>Targeted Skill Gap Analysis</h3>
              <p>
                Identifies missing technical and soft skills by benchmarking your resume directly against real-world job requirements.
              </p>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">
                <Zap size={24} />
              </div>
              <h3>Smart Day-Wise Roadmaps</h3>
              <p>
                Structured, step-by-step milestone plans that guide your daily preparation with interactive task checklists.
              </p>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">
                <Cpu size={24} />
              </div>
              <h3>Automated Resume & Cover Letter Studio</h3>
              <p>
                Instantly generates job-aligned resumes and customized cover letters formatted cleanly for ATS systems.
              </p>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">
                <Award size={24} />
              </div>
              <h3>Curated Questions & Answers</h3>
              <p>
                Deep-dive technical questions and behavioral STAR-framework questions with sample answers and user practice areas.
              </p>
            </div>
          </div>
        </section>

        {/* Technology Highlights */}
        <section className="tech-highlights-card">
          <h2>Powered by Cutting-Edge AI</h2>
          <p>
            Built on top of Groq (Llama 3.3 70B) with OpenRouter as fallback, React 19, Node.js, and MongoDB, KIVI-AI delivers sub-second insights and continuous intelligence for modern software developers and job seekers.
          </p>
          <div className="tech-tags-list">
            <span className="tech-tag">Groq AI</span>
            <span className="tech-tag">React 19</span>
            <span className="tech-tag">Express.js</span>
            <span className="tech-tag">MongoDB</span>
            <span className="tech-tag">Vite</span>
            <span className="tech-tag">Puppeteer PDF</span>
          </div>
        </section>

        {/* CTA Banner */}
        <div className="about-cta-banner">
          <div className="cta-text">
            <h3>Ready to Boost Your Interview Readiness?</h3>
            <p>Generate your first report today and start practicing!</p>
          </div>
          <Link to="/" className="cta-button">
            <span>Go to Dashboard</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
