import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  Send, 
  CheckCircle2, 
  ArrowUp, 
  MessageSquare, 
  Mail, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Bot
} from 'lucide-react';
import '../footer.scss';

// SVG Social Icons
const GithubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const LinkedinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const TwitterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const DiscordIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6h0a14.5 14.5 0 0 0-4-1.5 9.6 9.6 0 0 0-.5 1.5 13.7 13.7 0 0 0-3 0 9.6 9.6 0 0 0-.5-1.5 14.5 14.5 0 0 0-4 1.5C3.5 10 3 14 3.5 18a14.5 14.5 0 0 0 4.5 2.5 10.5 10.5 0 0 0 1-1.5 9.5 9.5 0 0 1-1.5-.75.5.5 0 0 1 .5-.5 11.5 11.5 0 0 0 8 0 .5.5 0 0 1 .5.5 9.5 9.5 0 0 1-1.5.75 10.5 10.5 0 0 0 1 1.5 14.5 14.5 0 0 0 4.5-2.5C21 14 20.5 10 18 6z" />
    <circle cx="8.5" cy="12" r="1.5" />
    <circle cx="15.5" cy="12" r="1.5" />
  </svg>
);

const YoutubeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </svg>
);

const Footer = ({ theme = 'dark' }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubscribed(true);
      setEmail('');
    }, 600);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <footer className={`kivi-footer ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <div className="kivi-footer__container">
        {/* ===== TOP NEWSLETTER & ANNOUNCEMENT BANNER ===== */}
        <div className="kivi-footer__newsletter-card">
          <div className="newsletter-info">
            <span className="newsletter-badge">
              <Sparkles size={14} /> Weekly Career Intelligence
            </span>
            <h3 className="newsletter-heading">Stay Ahead in the Tech Job Market</h3>
            <p className="newsletter-desc">
              Get curated technical interview questions, AI prompt tips, ATS resume hacks, and industry hiring trends delivered weekly.
            </p>
          </div>

          {subscribed ? (
            <div className="newsletter-success">
              <CheckCircle2 size={20} />
              <span>You're subscribed! Welcome to the KIVI-AI Community.</span>
            </div>
          ) : (
            <form className="newsletter-form" onSubmit={handleSubscribe}>
              <div className="newsletter-input-wrap">
                <Mail size={16} className="mail-icon" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work or personal email..."
                  required
                />
              </div>
              <button 
                type="submit" 
                className="newsletter-btn"
                disabled={submitting}
              >
                {submitting ? 'Subscribing...' : 'Subscribe Free'}
                <Send size={15} />
              </button>
            </form>
          )}
        </div>

        {/* ===== 5-COLUMN MAIN NAVIGATION GRID ===== */}
        <div className="kivi-footer__grid">
          {/* Column 1: Brand & Mission */}
          <div className="kivi-footer__brand-col">
            <Link to="/" className="kivi-footer__brand-link">
              <img src="/Logo.png" alt="KIVI-AI Logo" className="brand-logo" />
              <div className="brand-text-wrap">
                <span className="brand-title">KIVI-AI</span>
                <span className="brand-tagline">AI Career Coach</span>
              </div>
            </Link>

            <p className="kivi-footer__brand-sub">
              Empowering developers and professionals to master behavioral and technical interviews, bridge skill gaps, and generate ATS-optimized resumes with cutting-edge AI.
            </p>

            <div className="status-badge" title="AI Model Status: Groq 120B / Gemini 2.5 Active">
              <span className="pulse-dot"></span>
              <span>AI Engine Online · 99.9% Uptime</span>
            </div>

            <div className="kivi-footer__social-links">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="kivi-footer__social-btn" aria-label="GitHub">
                <GithubIcon />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="kivi-footer__social-btn" aria-label="LinkedIn">
                <LinkedinIcon />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="kivi-footer__social-btn" aria-label="Twitter / X">
                <TwitterIcon />
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="kivi-footer__social-btn" aria-label="Discord">
                <DiscordIcon />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="kivi-footer__social-btn" aria-label="YouTube">
                <YoutubeIcon />
              </a>
            </div>
          </div>

          {/* Column 2: Product & AI Tools */}
          <div className="kivi-footer__col">
            <h4 className="kivi-footer__column-title">Product & Tools</h4>
            <ul className="kivi-footer__nav-list">
              <li>
                <Link to="/login" className="kivi-footer__nav-link">
                  AI Mock Interviews <span className="hot-badge">Popular</span>
                </Link>
              </li>
              <li>
                <Link to="/login" className="kivi-footer__nav-link">
                  ATS Resume Studio <span className="new-badge">AI 2.0</span>
                </Link>
              </li>
              <li>
                <Link to="/login" className="kivi-footer__nav-link">
                  Cover Letter Builder
                </Link>
              </li>
              <li>
                <Link to="/login" className="kivi-footer__nav-link">
                  Day-Wise Roadmap
                </Link>
              </li>
              <li>
                <Link to="/login" className="kivi-footer__nav-link">
                  Skill Gap Diagnostics
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="kivi-footer__nav-link">
                  Pricing & Pro Plans
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources & Guides */}
          <div className="kivi-footer__col">
            <h4 className="kivi-footer__column-title">Resources & Guides</h4>
            <ul className="kivi-footer__nav-list">
              <li>
                <Link to="/about-us" className="kivi-footer__nav-link">
                  Behavioral STAR Guide
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="kivi-footer__nav-link">
                  Tech Question Bank
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="kivi-footer__nav-link">
                  ATS Keyword Matching
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="kivi-footer__nav-link">
                  Career Roadmaps
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="kivi-footer__nav-link">
                  Free vs Pro Comparison
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Company & Support */}
          <div className="kivi-footer__col">
            <h4 className="kivi-footer__column-title">Company</h4>
            <ul className="kivi-footer__nav-list">
              <li>
                <Link to="/about-us" className="kivi-footer__nav-link">
                  About KIVI-AI
                </Link>
              </li>
              <li>
                <Link to="/contact-us" className="kivi-footer__nav-link">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link to="/contact-us" className="kivi-footer__nav-link">
                  Help Center & FAQs
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="kivi-footer__nav-link">
                  Careers <span className="new-badge">We're Hiring</span>
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="kivi-footer__nav-link">
                  Wall of Love & Reviews
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Trust & Legal */}
          <div className="kivi-footer__col">
            <h4 className="kivi-footer__column-title">Trust & Legal</h4>
            <ul className="kivi-footer__nav-list">
              <li>
                <Link to="/privacy-policy" className="kivi-footer__nav-link">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="kivi-footer__nav-link">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="kivi-footer__nav-link">
                  Data Security & GDPR
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="kivi-footer__nav-link">
                  AI Ethics Statement
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="kivi-footer__nav-link">
                  Cookie Preferences
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* ===== BOTTOM COPYRIGHT & STATUS BAR ===== */}
        <div className="kivi-footer__bottom">
          <div className="bottom-left">
            <p className="copyright">
              © 2026 KIVI-AI Technologies Inc. All rights reserved.
            </p>
            <div className="system-metrics">
              <span className="dot-sep">·</span>
              <span>Multi-Model AI (Groq + Gemini)</span>
              <span className="dot-sep">·</span>
              <span>Encrypted & Private</span>
            </div>
          </div>

          <div className="bottom-right">
            <button 
              type="button" 
              className="back-to-top-btn" 
              onClick={scrollToTop}
              title="Back to Top"
            >
              <span>Back to Top</span>
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
