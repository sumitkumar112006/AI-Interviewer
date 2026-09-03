import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Bot, 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare, 
  BarChart3, 
  TrendingUp, 
  Briefcase, 
  Compass, 
  FileText, 
  Zap, 
  Shield, 
  Target, 
  Star, 
  ChevronDown, 
  Sun, 
  Moon, 
  Play,
  Layers,
  Award,
  Users,
  Clock
} from 'lucide-react';
import Footer from '../../Footer/components/Footer';
import '../landing.scss';

// Import 4 core background images for reliable Vite resolution
import heroDark from '../../../assets/landing/landing-bg-dark.png';
import heroLight from '../../../assets/landing/landing-bg-light.png';
import mobileDark from '../../../assets/landing/landing-mobile-dark.png';
import mobileLight from '../../../assets/landing/landing-mobile-light.png';

const SIMULATOR_DATA = {
  fullstack: {
    shortLabel: "Full Stack",
    role: "Full Stack Engineer (Node + React)",
    question: "How do you optimize server-side database query bottlenecks during peak traffic?",
    sampleAnswer: "I profile slow queries using EXPLAIN ANALYZE, implement Redis caching for high-read endpoints, configure connection pooling, and use database indexing on high-cardinality search columns.",
    score: 94,
    skills: ["PostgreSQL", "Redis Caching", "Node.js Architecture", "Query Optimization"],
    radar: { tech: 95, comm: 90, sysDesign: 92 }
  },
  frontend: {
    shortLabel: "Frontend",
    role: "Senior React Developer",
    question: "How do you diagnose and eliminate unnecessary re-renders in large React applications?",
    sampleAnswer: "I utilize React DevTools Profiler to identify culprit components, wrap computationally expensive calculations in useMemo, stabilize callback references with useCallback, and split monolithic contexts into atomic state slices.",
    score: 92,
    skills: ["React 19", "State Architecture", "Web Vitals", "Component Profiling"],
    radar: { tech: 94, comm: 91, sysDesign: 88 }
  },
  ai: {
    shortLabel: "AI / LLM",
    role: "AI / LLM Engineer",
    question: "What strategies do you use to mitigate hallucination in retrieval-augmented generation (RAG) pipelines?",
    sampleAnswer: "I use hybrid semantic & keyword search (BM25 + vector embeddings), strict chunk re-ranking via Cross-Encoders, context citation constraints in the prompt schema, and automated ground-truth evaluation metrics.",
    score: 96,
    skills: ["Vector DBs", "RAG Pipelines", "Prompt Engineering", "Evaluation Frameworks"],
    radar: { tech: 97, comm: 94, sysDesign: 95 }
  },
  devops: {
    shortLabel: "DevOps & Cloud",
    role: "DevOps & Cloud Engineer",
    question: "How do you design a zero-downtime canary deployment pipeline in Kubernetes?",
    sampleAnswer: "I configure ArgoCD with progressive traffic splitting using Istio Service Mesh, monitor Prometheus error rates and latency SLOs, and trigger automated rollbacks if threshold anomalies occur.",
    score: 91,
    skills: ["Kubernetes", "CI/CD GitOps", "Prometheus/Grafana", "Traffic Routing"],
    radar: { tech: 92, comm: 89, sysDesign: 93 }
  }
};

const FAQ_ITEMS = [
  {
    q: "How does KIVI-AI analyze my resume against job descriptions?",
    a: "KIVI-AI utilizes advanced LLM models (Groq GPT-OSS 120B & Google Gemini 2.5 Flash) to parse your resume, compare keyword semantics, identify missing technical and behavioral skills, and compute an ATS-compliant match score in seconds."
  },
  {
    q: "Are the mock interview questions personalized to my experience?",
    a: "Yes! KIVI-AI customizes both technical and behavioral questions specifically to the intersection between your resume and the target company's job posting, simulating real-world interview loops."
  },
  {
    q: "Can I export my generated resume and cover letter?",
    a: "Absolutely. Our built-in Resume Studio features a rich TipTap editor where you can customize every section with AI assistance and export high-fidelity PDF documents formatted for ATS parsers."
  },
  {
    q: "Is my personal data and resume secure?",
    a: "100%. We employ enterprise-grade TLS encryption in transit and AES-256 at rest. Your resumes and interview transcripts are strictly private and never used to train public AI models."
  },
  {
    q: "How does the Free plan compare to Pro?",
    a: "The Free plan gives you complete access to explore mock interview generation, skill gap analysis, and ATS scoring. Pro unlocks unlimited interview simulations, AI assistant rewrites, and prioritized model inference."
  }
];

const LandingPage = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kivi_theme') || 'dark';
  });

  const [activeRoleKey, setActiveRoleKey] = useState('fullstack');
  const [openFaq, setOpenFaq] = useState(0);
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('kivi_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const currentSim = SIMULATOR_DATA[activeRoleKey];

  const activeHeroImage = isMobile
    ? (theme === 'light' ? mobileLight : mobileDark)
    : (theme === 'light' ? heroLight : heroDark);

  return (
    <div className={`landing-page-wrapper ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      
      {/* ===== 1. TOP NAVIGATION BAR ===== */}
      <header className="landing-navbar">
        <div className="nav-container">
          <Link to="/" className="nav-brand">
            <img src="/Logo.png" alt="KIVI-AI Logo" className="brand-logo-img" />
            <span className="brand-name">KIVI-AI</span>
            <span className="brand-badge">Interview Intelligence</span>
          </Link>

          <nav>
            <ul className="nav-links">
              <li><a href="#features">Features</a></li>
              <li><a href="#workflow">How It Works</a></li>
              <li><a href="#simulator">Live Demo</a></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><a href="#reviews">Reviews</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </nav>

          <div className="nav-actions">
            {/* Light / Dark Mode Toggle */}
            <button 
              type="button" 
              className="theme-toggle-btn" 
              onClick={toggleTheme} 
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              id="theme-toggle-btn"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <Link to="/login" className="btn-nav-login" id="nav-login-btn">
              Sign In
            </Link>

            <Link to="/register" className="btn-nav-cta" id="nav-register-btn">
              <span>Get Started</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* ===== 2. HERO SECTION WITH CRISP HD IMAGE & 10px MARGIN LEFT OVERLAY CARD ===== */}
      <section className="landing-hero-section">
        <div className="hero-viewport-container">
          {/* High-Resolution Crisp Artwork with Butter-Smooth Crossfade */}
          <img 
            src={isMobile ? mobileDark : heroDark}
            alt="KIVI-AI Dark Workspace"
            className={`hero-bg-image hero-bg-dark ${theme === 'dark' ? 'active' : ''}`}
            loading="eager"
            decoding="async"
          />
          <img 
            src={isMobile ? mobileLight : heroLight}
            alt="KIVI-AI Light Workspace"
            className={`hero-bg-image hero-bg-light ${theme === 'light' ? 'active' : ''}`}
            loading="eager"
            decoding="async"
          />

          {/* Left Hero Card with 10px Left Margin, Full Image Height & Circular Transparent Fade */}
          <div className="hero-left-overlay-card">
            <div className="hero-card-inner">
              <div className="hero-pill-badge">
                <Sparkles size={15} className="badge-sparkle" />
                <span>Next-Gen AI Interview Intelligence · Groq 120B & Gemini 2.5</span>
              </div>

              <h1 className="hero-headline">
                Land Your Dream Tech Job <span className="gradient-text">Faster with KIVI-AI</span>
              </h1>

              <p className="hero-subheadline">
                Simulate role-specific AI mock interviews, benchmark your resume against job descriptions with instant match scoring, follow day-wise prep roadmaps, and generate ATS-ready CVs.
              </p>

              <div className="hero-cta-group">
                <Link to="/register" className="btn-hero-primary" id="hero-start-free-btn">
                  <span>Start Practicing Free</span>
                  <Zap size={18} />
                </Link>
                <a href="#simulator" className="btn-hero-secondary" id="hero-demo-btn">
                  <Play size={16} />
                  <span>Try Live Demo</span>
                </a>
              </div>

              <div className="hero-trust-strip">
                <div className="trust-item">
                  <CheckCircle2 size={16} />
                  <span>No Credit Card Required</span>
                </div>
                <div className="trust-item">
                  <CheckCircle2 size={16} />
                  <span>Free Tier Available</span>
                </div>
                <div className="trust-item">
                  <CheckCircle2 size={16} />
                  <span>Instant ATS Feedback</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 3. METRICS TICKER STRIP ===== */}
      <section className="landing-stats-ticker">
        <div className="stats-container">
          <div className="stat-box">
            <span className="stat-number">50,000+</span>
            <span className="stat-label">Interviews Simulated</span>
            <span className="stat-sub">Across 120+ tech specialties</span>
          </div>

          <div className="stat-box">
            <span className="stat-number">95%+</span>
            <span className="stat-label">Readiness Score Boost</span>
            <span className="stat-sub">Average candidate confidence jump</span>
          </div>

          <div className="stat-box">
            <span className="stat-number">88%</span>
            <span className="stat-label">Faster Offer Rate</span>
            <span className="stat-sub">From first mock to signing letter</span>
          </div>

          <div className="stat-box">
            <span className="stat-number">4.9 / 5.0</span>
            <span className="stat-label">Candidate Satisfaction</span>
            <span className="stat-sub">Over 10,000+ active candidates</span>
          </div>
        </div>
      </section>

      {/* ===== 4. CORE FEATURES DEEP-DIVE ===== */}
      <section className="landing-section" id="features">
        <div className="section-header">
          <span className="section-badge">All-In-One Career Engine</span>
          <h2>Everything You Need to Get Hired in 2026</h2>
          <p>
            Stop guessing what interviewers want. KIVI-AI equips you with precision diagnostics, smart roadmaps, and generative CV tailoring.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrap grad-indigo">
              <MessageSquare size={26} />
            </div>
            <h3>AI Mock Interviews</h3>
            <p>
              Practice role-specific technical deep-dives and behavioral questions scored against the STAR method (Situation, Task, Action, Result).
            </p>
            <div className="feature-tags">
              <span className="tag">Live Voice/Text</span>
              <span className="tag">STAR Scoring</span>
              <span className="tag">Model Feedback</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap grad-cyan">
              <Target size={26} />
            </div>
            <h3>Skill Gap Diagnostics</h3>
            <p>
              Compare your resume directly against any Job Description to uncover missing keywords, experience mismatches, and prioritized prep areas.
            </p>
            <div className="feature-tags">
              <span className="tag">Match Score %</span>
              <span className="tag">ATS Keywords</span>
              <span className="tag">Gap Analysis</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap grad-emerald">
              <Compass size={26} />
            </div>
            <h3>Day-Wise Roadmaps</h3>
            <p>
              Get a structured milestone study schedule with interactive task checklists tailored specifically to your upcoming interview date.
            </p>
            <div className="feature-tags">
              <span className="tag">Milestone Plan</span>
              <span className="tag">Daily Tasks</span>
              <span className="tag">Study Guides</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap grad-purple">
              <FileText size={26} />
            </div>
            <h3>AI Resume Studio</h3>
            <p>
              Generate and fine-tune ATS-optimized resumes using a rich TipTap editor with instant AI section rewrites and one-click PDF downloads.
            </p>
            <div className="feature-tags">
              <span className="tag">Rich TipTap Editor</span>
              <span className="tag">ATS Layout</span>
              <span className="tag">PDF Export</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap grad-amber">
              <Zap size={26} />
            </div>
            <h3>Cover Letter Generator</h3>
            <p>
              Produce compelling, personalized cover letters that weave your actual project achievements into the company’s specific mission.
            </p>
            <div className="feature-tags">
              <span className="tag">Job-Tailored</span>
              <span className="tag">Tone Control</span>
              <span className="tag">Instant Copy</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap grad-pink">
              <Bot size={26} />
            </div>
            <h3>KIVI AI Copilot</h3>
            <p>
              Your floating AI career assistant ready to answer questions, practice quick problem drills, and offer on-demand guidance anytime.
            </p>
            <div className="feature-tags">
              <span className="tag">Groq 120B</span>
              <span className="tag">24/7 Available</span>
              <span className="tag">Multi-Turn Chat</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 5. 4-STEP HOW IT WORKS WORKFLOW ===== */}
      <section className="landing-section" id="workflow">
        <div className="section-header">
          <span className="section-badge">Simple 4-Step Process</span>
          <h2>From Resume Upload to Final Offer</h2>
          <p>
            Our streamlined intelligent workflow transforms candidate preparation into an exact science.
          </p>
        </div>

        <div className="workflow-grid">
          <div className="step-card">
            <span className="step-number">1</span>
            <h4>Upload Your Resume</h4>
            <p>Upload your existing PDF/Word resume or paste your technical background and career experiences.</p>
          </div>

          <div className="step-card">
            <span className="step-number">2</span>
            <h4>Paste Job Description</h4>
            <p>Provide the job specification from LinkedIn, Indeed, or Greenhouse for direct alignment analysis.</p>
          </div>

          <div className="step-card">
            <span className="step-number">3</span>
            <h4>Practice & Close Gaps</h4>
            <p>Simulate mock interviews, follow your day-wise prep plan, and sharpen weak areas with instant feedback.</p>
          </div>

          <div className="step-card">
            <span className="step-number">4</span>
            <h4>Generate ATS CV & Ace It</h4>
            <p>Export a polished, high-scoring ATS resume and walk into your interviews with 100% confidence.</p>
          </div>
        </div>
      </section>

      {/* ===== 6. LIVE INTERACTIVE SIMULATOR WIDGET ===== */}
      <section className="landing-section" id="simulator">
        <div className="landing-simulator">
          <div className="sim-header">
            <div className="sim-title-wrap">
              <h3>⚡ Live Interview & Match Simulator</h3>
              <p>Select a tech role below to see how KIVI-AI evaluates readiness in real-time:</p>
            </div>

            <div className="sim-role-pills">
              {Object.keys(SIMULATOR_DATA).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`role-pill ${activeRoleKey === key ? 'active' : ''}`}
                  onClick={() => setActiveRoleKey(key)}
                >
                  {SIMULATOR_DATA[key].shortLabel || SIMULATOR_DATA[key].role}
                </button>
              ))}
            </div>
          </div>

          <div className="sim-body">
            {/* Left: QA Sample */}
            <div className="sim-qa-box">
              <div className="qa-header">
                <Sparkles size={14} />
                <span>Target Role: {currentSim.role}</span>
              </div>
              <p className="sim-question">
                "{currentSim.question}"
              </p>
              <div className="sim-ideal-answer">
                <strong>AI Model Feedback & STAR Breakdown:</strong><br />
                {currentSim.sampleAnswer}
              </div>
            </div>

            {/* Right: Score Metrics */}
            <div className="sim-score-box">
              <div className="score-circle-wrap">
                <div className="score-circle">
                  <span className="score-val">{currentSim.score}%</span>
                  <span className="score-lbl">Match</span>
                </div>
                <div className="score-detail">
                  <h5>High Readiness Rating</h5>
                  <p>Matches 95% of core technical competencies</p>
                </div>
              </div>

              <div className="match-bars">
                <div className="bar-row">
                  <div className="bar-info">
                    <span>Technical Accuracy</span>
                    <span>{currentSim.radar.tech}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill grad-1" style={{ width: `${currentSim.radar.tech}%` }}></div>
                  </div>
                </div>

                <div className="bar-row">
                  <div className="bar-info">
                    <span>Communication & STAR</span>
                    <span>{currentSim.radar.comm}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill grad-2" style={{ width: `${currentSim.radar.comm}%` }}></div>
                  </div>
                </div>

                <div className="bar-row">
                  <div className="bar-info">
                    <span>System Design / Problem Solving</span>
                    <span>{currentSim.radar.sysDesign}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill grad-3" style={{ width: `${currentSim.radar.sysDesign}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 7. TESTIMONIALS & REVIEWS ===== */}
      <section className="landing-section" id="reviews">
        <div className="section-header">
          <span className="section-badge">Success Stories</span>
          <h2>Loved by 10,000+ Engineers & Candidates</h2>
          <p>
            Here is what professionals say after landing offers at top tech companies using KIVI-AI.
          </p>
        </div>

        <div className="testimonials-grid">
          <div className="testimonial-card">
            <div className="stars-row">
              {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
            </div>
            <p className="test-quote">
              "KIVI-AI caught skill gaps I didn't even realize were listed on the JD. The day-wise roadmap kept my prep structured, and I landed my Senior Full Stack offer in 3 weeks!"
            </p>
            <div className="author-info">
              <div className="author-avatar">AK</div>
              <div className="author-details">
                <span className="author-name">Alex Kumar</span>
                <span className="author-role">Senior Software Engineer @ FinTech</span>
              </div>
            </div>
          </div>

          <div className="testimonial-card">
            <div className="stars-row">
              {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
            </div>
            <p className="test-quote">
              "The STAR behavioral scoring is incredible. Practicing real answers against the AI simulated loop removed 90% of my interview anxiety before the actual onsite."
            </p>
            <div className="author-info">
              <div className="author-avatar">SP</div>
              <div className="author-details">
                <span className="author-name">Sarah Patel</span>
                <span className="author-role">Product Manager @ SaaS Unicorn</span>
              </div>
            </div>
          </div>

          <div className="testimonial-card">
            <div className="stars-row">
              {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
            </div>
            <p className="test-quote">
              "The TipTap Resume Studio + AI Section Rewriter is a game changer. My resume score jumped from 68% to 94% on ATS tests, leading to 4 interviews in one week."
            </p>
            <div className="author-info">
              <div className="author-avatar">MR</div>
              <div className="author-details">
                <span className="author-name">Marcus Rodriguez</span>
                <span className="author-role">DevOps & Cloud Architect</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 8. FREQUENTLY ASKED QUESTIONS ===== */}
      <section className="landing-section" id="faq">
        <div className="section-header">
          <span className="section-badge">Got Questions?</span>
          <h2>Frequently Asked Questions</h2>
          <p>
            Everything you need to know about KIVI-AI and our interview prep platform.
          </p>
        </div>

        <div className="faq-accordion">
          {FAQ_ITEMS.map((item, index) => (
            <div key={index} className="faq-item">
              <button 
                type="button" 
                className="faq-question-btn"
                onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
              >
                <span>{item.q}</span>
                <ChevronDown size={18} className={`chevron-icon ${openFaq === index ? 'open' : ''}`} />
              </button>
              {openFaq === index && (
                <p className="faq-answer">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== 9. HIGH-CONVERSION CTA BANNER ===== */}
      <section className="landing-cta-banner">
        <div className="cta-inner-card">
          <h2>Ready to Ace Your Next Interview?</h2>
          <p>
            Join over 10,000+ ambitious developers and candidates practicing with KIVI-AI today. Create your free account in 60 seconds.
          </p>
          <Link to="/register" className="btn-cta-launch" id="bottom-cta-register-btn">
            <span>Get Started for Free</span>
            <ArrowRight size={18} />
          </Link>
          <div className="cta-guarantee">
            <Shield size={14} />
            <span>Free Tier Available · No Credit Card Required · Cancel Anytime</span>
          </div>
        </div>
      </section>

      {/* ===== 10. COMPREHENSIVE GLOBAL FOOTER ===== */}
      <Footer theme={theme} />

    </div>
  );
};

export default LandingPage;
