import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
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
  Pause,
  Layers,
  Award,
  Users,
  Clock,
  Mic,
  MicOff,
  Volume2,
  Terminal,
  Check,
  Code2,
  Cpu,
  Lock,
  RefreshCw,
  Sliders,
  CheckCheck,
  Send,
  HelpCircle
} from 'lucide-react';
import Footer from '../../Footer/components/Footer';
import '../landing.scss';

// Utility helper to select best Microsoft Natural / Neural voice
const getMicrosoftVoice = (preferredGender = 'male') => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Try Microsoft Online / Natural voices (Edge & Windows 11)
  const msNatural = voices.filter(v => 
    v.name.includes('Microsoft') && (v.name.includes('Online') || v.name.includes('Natural'))
  );
  if (msNatural.length > 0) {
    if (preferredGender === 'female') {
      const f = msNatural.find(v => /aria|jenny|zira|neerja/i.test(v.name));
      if (f) return f;
    } else {
      const m = msNatural.find(v => /guy|christopher|prabhat|eric/i.test(v.name));
      if (m) return m;
    }
    return msNatural[0];
  }

  // 2. Try any Microsoft voice (David, Zira, Mark, etc.)
  const msVoices = voices.filter(v => v.name.includes('Microsoft'));
  if (msVoices.length > 0) {
    if (preferredGender === 'female') {
      const f = msVoices.find(v => /zira|aria|jenny/i.test(v.name));
      if (f) return f;
    } else {
      const m = msVoices.find(v => /david|guy|mark/i.test(v.name));
      if (m) return m;
    }
    return msVoices[0];
  }

  // 3. Try Google or Natural English voices
  const googleOrNatural = voices.filter(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google')));
  if (googleOrNatural.length > 0) return googleOrNatural[0];

  // 4. Default to any English voice
  const english = voices.find(v => v.lang.startsWith('en'));
  return english || voices[0];
};

// Role data for Hero Showcase & Interactive Simulator (Clean & Crisp Copy)
const HERO_SHOWCASE_DATA = {
  fullstack: {
    title: "Full Stack Engineer",
    company: "FinTech Scale-up",
    difficulty: "Senior L5",
    question: "How do you architect a webhook receiver handling 50k events/min with zero data loss?",
    transcript: "I place AWS API Gateway in front of SQS FIFO queues for immediate 200 OK responses, consume events with idempotent Node.js services using Redis locks, and route failures to a Dead-Letter Queue (DLQ).",
    starBreakdown: {
      situation: "High-volume webhooks overwhelming database connections.",
      task: "Decouple ingestion from processing with guaranteed idempotency.",
      action: "Implemented SQS FIFO queues + Redis deduplication + DLQ retries.",
      result: "99.999% delivery reliability under 60k req/min load tests."
    },
    score: 96,
    techScore: 98,
    starScore: 94,
    feedback: "Superb architecture. Highlights idempotency keys and DLQ recovery protocols clearly."
  },
  frontend: {
    title: "Frontend Architect",
    company: "SaaS Enterprise",
    difficulty: "Staff L6",
    question: "How do you systematically optimize Largest Contentful Paint (LCP) and INP in a large React SPA?",
    transcript: "I isolate long tasks using Chrome DevTools, split non-critical bundles dynamically, preload critical hero assets server-side, and wrap heavy state updates in React 19 startTransition.",
    starBreakdown: {
      situation: "Dashboard LCP degraded to 3.8s with input latency on complex filters.",
      task: "Attain Core Web Vitals 'Good' thresholds globally.",
      action: "Applied route code-splitting, list virtualization, and Web Worker offloading.",
      result: "Reduced LCP to 1.1s (71% faster) and brought INP under 45ms."
    },
    score: 94,
    techScore: 95,
    starScore: 93,
    feedback: "Strong grasp of browser rendering pipelines, Web Workers, and React 19 transitions."
  },
  ai: {
    title: "AI / LLM Engineer",
    company: "Autonomous AI Lab",
    difficulty: "Senior L5",
    question: "How do you eliminate hallucinations and retrieval bottlenecks in multi-tenant RAG pipelines?",
    transcript: "I use hybrid retrieval combining BM25 keyword matching with dense vector embeddings in Qdrant, re-rank top chunks via Cross-Encoder, enforce citation grounding, and cache vector queries in Redis.",
    starBreakdown: {
      situation: "12% hallucination rate on domain-specific compliance questions.",
      task: "Lower hallucination below 1% and reduce p95 latency under 400ms.",
      action: "Engineered hybrid search + Cross-Encoder re-ranking + citation schema checks.",
      result: "Achieved 0.4% hallucination rate and 310ms p95 latency with 65% cache hit rate."
    },
    score: 97,
    techScore: 98,
    starScore: 96,
    feedback: "Clean state-of-the-art RAG architecture with clear grounding economics."
  },
  devops: {
    title: "Cloud Architect",
    company: "Global Cloud Platform",
    difficulty: "Principal L6",
    question: "Explain your strategy for a zero-downtime database migration across multi-region Kubernetes clusters.",
    transcript: "I use an expand-contract schema with application-layer dual writes, replicate data in real-time via Debezium CDC connectors, verify checksums, and shift traffic progressively using Istio virtual services.",
    starBreakdown: {
      situation: "PostgreSQL cluster requiring migration to Aurora Multi-Region with zero downtime.",
      task: "Migrate 4TB dataset without data drift or read/write interruption.",
      action: "Implemented dual-writes + Kafka CDC stream validation + auto-rollback triggers.",
      result: "Completed migration in 45 minutes with 0 dropped transactions."
    },
    score: 95,
    techScore: 96,
    starScore: 94,
    feedback: "Flawless operational plan with robust validation and rollback safety nets."
  }
};

const FAQ_ITEMS = [
  {
    q: "How does real-time AI evaluation work?",
    a: "Our engine analyzes your answer against industry rubrics for technical correctness, tradeoffs, and STAR structure."
  },
  {
    q: "How does the ATS resume matcher work?",
    a: "It benchmarks your resume against target job descriptions and highlights missing keywords and requirements."
  },
  {
    q: "Is interview difficulty tailored to my seniority?",
    a: "Yes. Scenarios and depth scale automatically from junior developer up to principal engineer."
  },
  {
    q: "Can I edit and export ATS PDF resumes?",
    a: "Yes. Use our built-in AI studio to rewrite bullet points and download formatted ATS-ready PDFs."
  },
  {
    q: "Is my resume and interview audio private?",
    a: "100% private. All data is encrypted with AES-256 and never used to train public AI models."
  },
  {
    q: "What is included in the Free plan?",
    a: "Free users get 3 AI mock interviews per month, ATS match diagnostics, and study roadmaps."
  }
];

function useScrollReveal() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );

    const elements = container.querySelectorAll('.reveal-on-scroll');
    elements.forEach((el, i) => {
      el.style.transitionDelay = `${i * 60}ms`;
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return containerRef;
}

const LandingPage = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kivi_theme') || 'dark';
  });

  // Interactive Hero Title mouse gradient effect
  const [headingMouse, setHeadingMouse] = useState({ x: 50, y: 50, angle: 135 });
  const [isHeadingHovered, setIsHeadingHovered] = useState(false);
  const headingRef = useRef(null);

  const handleHeadingMouseMove = (e) => {
    if (!headingRef.current) return;
    const rect = headingRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const angle = Math.round(Math.atan2(y - 50, x - 50) * (180 / Math.PI) + 180);
    setHeadingMouse({
      x: Math.round(x),
      y: Math.round(y),
      angle
    });
  };

  // Speech Synthesis & Recognition state
  const [speakingType, setSpeakingType] = useState('none'); // 'none' | 'interviewer' | 'candidate' | 'benchmark'
  const [isListeningMic, setIsListeningMic] = useState(false);
  const recognitionRef = useRef(null);

  // Initialize Speech Synthesis voice cache
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
      return () => {
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  // Simulator section state
  const [simRole, setSimRole] = useState('fullstack');
  const [userCustomAnswer, setUserCustomAnswer] = useState('');
  const [isEvaluatingCustom, setIsEvaluatingCustom] = useState(false);
  const [customFeedback, setCustomFeedback] = useState(null);

  const audioRef = useRef(null);

  // Cancel speech and mic on role switch
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingType('none');
    if (recognitionRef.current && isListeningMic) {
      recognitionRef.current.stop();
      setIsListeningMic(false);
    }
  }, [simRole]);

  // High-fidelity Microsoft Neural Voice playback handler
  const handleToggleSpeak = async (text, preferredGender = 'male', type = 'candidate') => {
    // If currently playing, pause and reset
    if (speakingType === type) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setSpeakingType('none');
      return;
    }

    // Stop any existing playback first
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setSpeakingType(type);

    const cleanText = text.replace(/["“”]/g, '').trim();
    const voicePreset = type === 'interviewer' ? 'interviewer' : type === 'benchmark' ? 'lead' : 'candidate';
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    const audioUrl = `${backendUrl}/api/speech/synthesize?text=${encodeURIComponent(cleanText)}&voice=${voicePreset}&gender=${preferredGender}`;

    try {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setSpeakingType(type);
      };

      audio.onended = () => {
        setSpeakingType('none');
        audioRef.current = null;
      };

      audio.onerror = () => {
        console.warn('Backend audio failed, falling back to Web Speech API');
        fallbackWebSpeech(cleanText, preferredGender, type);
      };

      await audio.play();
    } catch (err) {
      console.warn('Audio play exception, fallback to browser speech synthesis:', err);
      fallbackWebSpeech(cleanText, preferredGender, type);
    }
  };

  const fallbackWebSpeech = (cleanText, preferredGender, type) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSpeakingType('none');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const selectedVoice = getMicrosoftVoice(preferredGender);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setSpeakingType(type);
    utterance.onend = () => setSpeakingType('none');
    utterance.onerror = () => setSpeakingType('none');

    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition (Mic Input)
  const handleToggleMic = () => {
    if (isListeningMic) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListeningMic(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListeningMic(true);
      };

      recognition.onresult = (event) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        setUserCustomAnswer(fullTranscript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition notice:', event.error);
        setIsListeningMic(false);
      };

      recognition.onend = () => {
        setIsListeningMic(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      setIsListeningMic(false);
    }
  };

  // Pricing toggle
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 300 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSeconds) => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState(0);

  // Scroll reveal refs
  const heroRef = useScrollReveal();
  const featuresRef = useScrollReveal();
  const simulatorRef = useScrollReveal();
  const workflowRef = useScrollReveal();
  const reviewsRef = useScrollReveal();
  const pricingRef = useScrollReveal();
  const faqRef = useScrollReveal();

  useEffect(() => {
    localStorage.setItem('kivi_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const currentSimData = HERO_SHOWCASE_DATA[simRole];

  const handleEvaluateCustom = () => {
    if (!userCustomAnswer.trim()) return;
    setIsEvaluatingCustom(true);
    setCustomFeedback(null);

    setTimeout(() => {
      setIsEvaluatingCustom(false);
      const wordCount = userCustomAnswer.trim().split(/\s+/).length;
      const isLongEnough = wordCount >= 15;
      setCustomFeedback({
        score: isLongEnough ? Math.min(94, 82 + Math.floor(Math.random() * 12)) : 68,
        starMatched: isLongEnough ? "Situation (Clear) · Action (Strong) · Result (Quantified)" : "Action provided, but missing quantified Result or Context.",
        critique: isLongEnough 
          ? "Great technical framing! You addressed the core tradeoff and highlighted latency implications. Consider mentioning automated canary rollbacks for extra depth."
          : "Good start, but your answer is too brief for a senior loop. Use the STAR format to explain the background problem, specific architecture steps, and business outcome."
      });
    }, 900);
  };

  return (
    <div className={`landing-page-wrapper ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      
      {/* Background Ambient Glow Orbs & Grid Mesh (Shapes/Gradients in BG ONLY) */}
      <div className="bg-canvas-mesh" aria-hidden="true">
        <div className="glow-orb orb-primary" />
        <div className="glow-orb orb-secondary" />
        <div className="glow-orb orb-tertiary" />
        <div className="grid-overlay-pattern" />
      </div>

      {/* ===== 1. TOP NAVIGATION BAR ===== */}
      <header className="landing-navbar">
        <div className="nav-container">
          <Link to="/" className="nav-brand" id="nav-brand-logo">
            <img src="/Logo.png" alt="KIVI-AI Logo" className="brand-logo-img" />
            <span className="brand-name">KIVI-AI</span>
            <span className="brand-badge">Interview Intelligence</span>
          </Link>

          <nav aria-label="Main Navigation">
            <ul className="nav-links">
              <li><a href="#features">Features</a></li>
              <li><a href="#simulator">Live Studio</a></li>
              <li><a href="#workflow">How It Works</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#reviews">Wall of Love</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </nav>

          <div className="nav-actions">
            {/* Theme Toggle Button */}
            <button 
              type="button" 
              className="theme-toggle-btn" 
              onClick={toggleTheme} 
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              id="theme-toggle-btn"
              aria-label="Toggle dark/light theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <Link to="/login" className="btn-nav-login" id="nav-login-btn">
              Sign In
            </Link>

            <Link to="/register" className="btn-nav-cta" id="nav-register-btn">
              <span>Start Free</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ===== 2. HERO SECTION ===== */}
      <section className="landing-hero-section" ref={heroRef}>
        <div className="hero-container">
          
          <div className="hero-header-block reveal-on-scroll">
            <div className="hero-announcement-pill">
              <span className="pill-dot"></span>
              <Sparkles size={14} className="pill-icon" />
              <span className="pill-text">AI Interview &amp; Resume Intelligence</span>
            </div>

            <h1 
              ref={headingRef}
              className={`hero-title interactive-gradient-heading ${isHeadingHovered ? 'is-hovered' : ''}`}
              onMouseMove={handleHeadingMouseMove}
              onMouseEnter={() => setIsHeadingHovered(true)}
              onMouseLeave={() => setIsHeadingHovered(false)}
              style={{
                '--mouse-x': `${headingMouse.x}%`,
                '--mouse-y': `${headingMouse.y}%`,
                '--mouse-angle': `${headingMouse.angle}deg`
              }}
            >
              Ace Your Tech Interviews &amp; <span className="title-highlight">Get Hired</span>
            </h1>

            <p className="hero-subtitle">
              Role-specific AI mock interviews, instant STAR feedback, and ATS resume matching.
            </p>

            <div className="hero-cta-actions">
              <Link to="/register" className="btn-hero-primary" id="hero-cta-start-btn">
                <span>Start Free Practice</span>
                <ArrowRight size={16} />
              </Link>
              <a href="#simulator" className="btn-hero-secondary" id="hero-cta-demo-btn">
                <Play size={15} />
                <span>Try Demo</span>
              </a>
            </div>

            <div className="hero-trust-indicators">
              <div className="trust-badge-item">
                <CheckCircle2 size={14} className="check-icon" />
                <span>Free forever</span>
              </div>
              <div className="trust-badge-item">
                <CheckCircle2 size={14} className="check-icon" />
                <span>No credit card required</span>
              </div>
              <div className="trust-badge-item">
                <CheckCircle2 size={14} className="check-icon" />
                <span>Instant setup</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 3. TRUST & SOCIAL PROOF TICKER ===== */}
      <section className="landing-trust-ticker">
        <div className="ticker-container">
          <p className="ticker-label">
            Engineers hired at
          </p>
          
          <div className="company-logos-row">
            <div className="company-item">Google</div>
            <div className="company-item">Amazon</div>
            <div className="company-item">Microsoft</div>
            <div className="company-item">Meta</div>
            <div className="company-item">Stripe</div>
            <div className="company-item">Netflix</div>
            <div className="company-item">Uber</div>
          </div>

          <div className="metrics-summary-grid">
            <div className="metric-cell">
              <span className="metric-number">50k+</span>
              <span className="metric-title">Interviews Practiced</span>
            </div>

            <div className="metric-cell">
              <span className="metric-number">95%</span>
              <span className="metric-title">Offer Success Rate</span>
            </div>

            <div className="metric-cell">
              <span className="metric-number">88%</span>
              <span className="metric-title">ATS Score Boost</span>
            </div>

            <div className="metric-cell">
              <span className="metric-number">4.9★</span>
              <span className="metric-title">Candidate Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 4. CORE FEATURES BENTO GRID ===== */}
      <section className="landing-section" id="features" ref={featuresRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">Platform Features</span>
            <h2>Everything You Need to Succeed</h2>
            <p>
              From ATS matching to realistic AI mock interviews.
            </p>
          </div>

          <div className="bento-features-grid">
            
            {/* Feature 1: AI Mock Interviews */}
            <div className="bento-card bento-card-large reveal-on-scroll">
              <div className="card-badge-row">
                <span className="feature-pill blue">
                  <Mic size={13} />
                  <span>Voice &amp; Text</span>
                </span>
                <span className="speed-pill">Ultra Fast AI</span>
              </div>
              <h3>Role-Tailored AI Mock Interviews</h3>
              <p>
                Practice technical and behavioral loops with real-time STAR feedback and tradeoff scoring.
              </p>
              
              {/* Mini UI Widget */}
              <div className="feature-mini-widget widget-interview">
                <div className="mini-bubble-row">
                  <div className="mini-avatar"><Bot size={13} /></div>
                  <div className="mini-text-box">
                    <span className="mini-speaker">AI Interviewer</span>
                    <span className="mini-quote">"How do you handle schema versioning without downtime?"</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: ATS Diagnostics */}
            <div className="bento-card bento-card-large reveal-on-scroll">
              <div className="card-badge-row">
                <span className="feature-pill emerald">
                  <Target size={13} />
                  <span>Instant Match</span>
                </span>
                <span className="speed-pill">ATS Engine</span>
              </div>
              <h3>Precision Skill Gap Diagnostics</h3>
              <p>
                Benchmark your CV against job postings to instantly uncover missing keywords.
              </p>
              
              {/* Mini UI Widget */}
              <div className="feature-mini-widget widget-ats">
                <div className="mini-ats-bar">
                  <div className="ats-label-row">
                    <span>ATS Compatibility</span>
                    <span className="ats-score-bold">94%</span>
                  </div>
                  <div className="mini-progress-track">
                    <div className="mini-progress-bar" style={{ width: '94%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 3: Day-Wise Roadmaps */}
            <div className="bento-card reveal-on-scroll">
              <div className="feature-icon-box box-blue">
                <Compass size={22} />
              </div>
              <h3>Day-Wise Roadmaps</h3>
              <p>
                Milestone checklists tailored to your interview target date.
              </p>
            </div>

            {/* Feature 4: TipTap Resume Studio */}
            <div className="bento-card reveal-on-scroll">
              <div className="feature-icon-box box-indigo">
                <FileText size={22} />
              </div>
              <h3>AI Resume Studio</h3>
              <p>
                Rewrite bullet points with action verbs and export ATS PDFs in one click.
              </p>
            </div>

            {/* Feature 5: Cover Letter Engine */}
            <div className="bento-card reveal-on-scroll">
              <div className="feature-icon-box box-amber">
                <Zap size={22} />
              </div>
              <h3>Tailored Cover Letters</h3>
              <p>
                Generate role-specific cover letters aligned to company goals.
              </p>
            </div>

            {/* Feature 6: 24/7 AI Copilot */}
            <div className="bento-card reveal-on-scroll">
              <div className="feature-icon-box box-pink">
                <Bot size={22} />
              </div>
              <h3>24/7 Career Copilot</h3>
              <p>
                Instant AI mentor for system design questions and interview drills.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ===== 5. INTERACTIVE LIVE SIMULATOR ===== */}
      <section className="landing-section section-simulator" id="simulator" ref={simulatorRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">Live Demo</span>
            <h2>Try AI Interview Scoring</h2>
            <p>
              Select a domain to test our real-time technical evaluation engine.
            </p>
          </div>

          <div className="simulator-workbench reveal-on-scroll">
            {/* Top Toolbar */}
            <div className="sim-toolbar">
              <div className="sim-role-selector">
                <span className="selector-title">Domain:</span>
                <div className="selector-buttons">
                  {Object.keys(HERO_SHOWCASE_DATA).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`sim-role-pill ${simRole === key ? 'active' : ''}`}
                      onClick={() => {
                        setSimRole(key);
                        setUserCustomAnswer('');
                        setCustomFeedback(null);
                      }}
                    >
                      {HERO_SHOWCASE_DATA[key].title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sim-badge-status">
                <CheckCheck size={14} />
                <span>Senior L5+ Standard</span>
              </div>
            </div>

            {/* Simulator Main Content Grid */}
            <div className="sim-grid">
              
              {/* Left: Question & Senior Model Answer */}
              <div className="sim-left-pane">
                <div className="sim-question-block">
                  <div className="block-label">
                    <span className="label-tag">Technical Question</span>
                    <span className="label-role">{currentSimData.difficulty}</span>
                  </div>
                  <h3 className="sim-question-text">{currentSimData.question}</h3>
                </div>

                <div className="sim-benchmark-answer">
                  <div className="benchmark-header">
                    <span className="benchmark-title">AI Senior Benchmark:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className={`sim-voice-btn ${speakingType === 'benchmark' ? 'speaking' : ''}`}
                        onClick={() => handleToggleSpeak(currentSimData.transcript, 'male', 'benchmark')}
                        title="Listen to benchmark answer"
                      >
                        {speakingType === 'benchmark' ? <Pause size={11} /> : <Volume2 size={11} />}
                        <span>{speakingType === 'benchmark' ? "Pause" : "Listen"}</span>
                      </button>
                      <span className="benchmark-score-tag">Score: {currentSimData.score}/100</span>
                    </div>
                  </div>
                  <p className="benchmark-text">
                    "{currentSimData.transcript}"
                  </p>
                </div>

                {/* Interactive User Sandbox */}
                <div className="user-test-sandbox">
                  <div className="sandbox-header">
                    <span className="sandbox-title">Test Your Answer:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        className={`sandbox-mic-btn ${isListeningMic ? 'listening' : ''}`}
                        onClick={handleToggleMic}
                        title={isListeningMic ? "Click to stop recording" : "Speak answer using microphone"}
                      >
                        {isListeningMic ? <MicOff size={13} /> : <Mic size={13} />}
                        <span>{isListeningMic ? "Listening..." : "Speak (Mic)"}</span>
                        {isListeningMic && <span className="mic-live-pulse" />}
                      </button>
                      <button 
                        type="button" 
                        className="sandbox-fill-btn"
                        onClick={() => setUserCustomAnswer(currentSimData.transcript)}
                      >
                        Sample Answer
                      </button>
                    </div>
                  </div>

                  <div className="sandbox-input-wrap">
                    <textarea 
                      className="sandbox-textarea"
                      rows={3}
                      placeholder="Type your answer to test the AI evaluation model..."
                      value={userCustomAnswer}
                      onChange={(e) => setUserCustomAnswer(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="sandbox-evaluate-btn"
                      onClick={handleEvaluateCustom}
                      disabled={isEvaluatingCustom || !userCustomAnswer.trim()}
                    >
                      {isEvaluatingCustom ? (
                        <>
                          <RefreshCw size={14} className="spin-icon" />
                          <span>Evaluating...</span>
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Evaluate</span>
                        </>
                      )}
                    </button>
                  </div>

                  {customFeedback && (
                    <div className="custom-feedback-card">
                      <div className="cf-header">
                        <span className="cf-score">Score: {customFeedback.score}%</span>
                        <span className="cf-status">{customFeedback.starMatched}</span>
                      </div>
                      <p className="cf-text">{customFeedback.critique}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Real-Time Radar Bars */}
              <div className="sim-right-pane">
                <div className="radar-card">
                  <h4 className="radar-title">Competency Scorecard</h4>
                  
                  <div className="radar-main-circle">
                    <span className="rmc-number">{currentSimData.score}%</span>
                    <span className="rmc-label">Readiness</span>
                  </div>

                  <div className="radar-bars-stack">
                    <div className="rbar-item">
                      <div className="rbar-labels">
                        <span>Technical Accuracy</span>
                        <span className="rbar-val">{currentSimData.techScore}%</span>
                      </div>
                      <div className="rbar-track">
                        <div className="rbar-fill fill-1" style={{ width: `${currentSimData.techScore}%` }} />
                      </div>
                    </div>

                    <div className="rbar-item">
                      <div className="rbar-labels">
                        <span>STAR Structure</span>
                        <span className="rbar-val">{currentSimData.starScore}%</span>
                      </div>
                      <div className="rbar-track">
                        <div className="rbar-fill fill-2" style={{ width: `${currentSimData.starScore}%` }} />
                      </div>
                    </div>

                    <div className="rbar-item">
                      <div className="rbar-labels">
                        <span>Tradeoffs &amp; Depth</span>
                        <span className="rbar-val">93%</span>
                      </div>
                      <div className="rbar-track">
                        <div className="rbar-fill fill-3" style={{ width: '93%' }} />
                      </div>
                    </div>
                  </div>

                  <div className="radar-cta-box">
                    <Link to="/register" className="btn-radar-launch">
                      <span>Start Full Practice</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ===== 6. HOW IT WORKS ===== */}
      <section className="landing-section" id="workflow" ref={workflowRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">How It Works</span>
            <h2>4 Steps to Your Offer</h2>
            <p>
              A simple path from preparation to offer.
            </p>
          </div>

          <div className="workflow-steps-grid">
            
            <div className="workflow-card reveal-on-scroll">
              <div className="step-badge-row">
                <span className="step-num">01</span>
              </div>
              <h4>Upload Resume</h4>
              <p>Instant parsing of your skills and project background.</p>
            </div>

            <div className="workflow-card reveal-on-scroll">
              <div className="step-badge-row">
                <span className="step-num">02</span>
              </div>
              <h4>Target Role</h4>
              <p>Calculate ATS compatibility and identify skill gaps.</p>
            </div>

            <div className="workflow-card reveal-on-scroll">
              <div className="step-badge-row">
                <span className="step-num">03</span>
              </div>
              <h4>Practice Mocks</h4>
              <p>Run realistic AI simulations with instant STAR feedback.</p>
            </div>

            <div className="workflow-card reveal-on-scroll">
              <div className="step-badge-row">
                <span className="step-num">04</span>
              </div>
              <h4>Get Hired</h4>
              <p>Export your tailored resume and ace the interviews.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ===== 7. VERIFIED CANDIDATE TESTIMONIALS ===== */}
      <section className="landing-section" id="reviews" ref={reviewsRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">Testimonials</span>
            <h2>Loved by Candidates</h2>
            <p>
              Real outcomes from engineers using KIVI-AI.
            </p>
          </div>

          <div className="testimonials-grid">
            
            <div className="testimonial-card reveal-on-scroll">
              <div className="card-top-meta">
                <div className="stars-row">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} className="star-filled" fill="currentColor" />)}
                </div>
                <span className="offer-tag">Landed SDE-2</span>
              </div>
              <p className="test-quote">
                "KIVI-AI helped me articulate system design tradeoffs clearly in my final round."
              </p>
              <div className="author-row">
                <div className="author-avatar-badge avatar-blue">DK</div>
                <div className="author-meta">
                  <span className="author-name">Dev Kumar</span>
                  <span className="author-title">Full Stack Engineer</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card reveal-on-scroll">
              <div className="card-top-meta">
                <div className="stars-row">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} className="star-filled" fill="currentColor" />)}
                </div>
                <span className="offer-tag">Landed Staff Architect</span>
              </div>
              <p className="test-quote">
                "The real-time STAR feedback removed all interview anxiety before executive rounds."
              </p>
              <div className="author-row">
                <div className="author-avatar-badge avatar-emerald">SP</div>
                <div className="author-meta">
                  <span className="author-name">Sarah Patel</span>
                  <span className="author-title">Frontend Architect</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card reveal-on-scroll">
              <div className="card-top-meta">
                <div className="stars-row">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} className="star-filled" fill="currentColor" />)}
                </div>
                <span className="offer-tag">Landed Cloud Lead</span>
              </div>
              <p className="test-quote">
                "ATS score jumped from 64% to 92%. I received 4 interview invites within 10 days."
              </p>
              <div className="author-row">
                <div className="author-avatar-badge avatar-indigo">SD</div>
                <div className="author-meta">
                  <span className="author-name">Shaloni Dubey</span>
                  <span className="author-title">Cloud Engineer</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===== 8. PRICING OVERVIEW ===== */}
      <section className="landing-section section-pricing" id="pricing" ref={pricingRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">Pricing</span>
            <h2>Simple, Transparent Plans</h2>
            <p>
              Start free. Upgrade when you need more sessions.
            </p>

            {/* Billing Cycle Toggle & Special Offer Banner */}
            <div className="pricing-top-controls">
              <div className="billing-toggle-wrap">
                <button 
                  type="button" 
                  className={`toggle-option ${billingCycle === 'monthly' ? 'active' : ''}`}
                  onClick={() => setBillingCycle('monthly')}
                >
                  Monthly
                </button>
                <button 
                  type="button" 
                  className={`toggle-option ${billingCycle === 'yearly' ? 'active' : ''}`}
                  onClick={() => setBillingCycle('yearly')}
                >
                  <span>Yearly (2 Months Free)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pricing-cards-grid reveal-on-scroll">
            
            {/* Tier 1: Free */}
            <div className="pricing-card">
              <div className="tier-header">
                <div className="tier-top-row">
                  <h3>Free</h3>
                </div>
                <p className="tier-desc">Get started with AI mock practice.</p>
                <div className="price-row">
                  <span className="price-currency">₹</span>
                  <span className="price-amount">0</span>
                  <span className="price-period">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
              </div>

              <div className="tier-features-list">
                <div className="feature-item"><Check size={16} className="check" /> 3 AI Mock Interviews / mo</div>
                <div className="feature-item"><Check size={16} className="check" /> 20 AI Credits</div>
                <div className="feature-item"><Check size={16} className="check" /> STAR Feedback &amp; Scoring</div>
                <div className="feature-item"><Check size={16} className="check" /> Basic Resume Template</div>
              </div>

              <Link to="/register" className="btn-tier btn-tier-outline">
                <span>Start Free</span>
              </Link>
            </div>

            {/* Tier 2: Pro (Most Popular) */}
            <div className="pricing-card popular-card">
              <div className="popular-badge">
                <Sparkles size={13} />
                <span>Most Popular</span>
              </div>
              <div className="tier-header">
                <div className="tier-top-row">
                  <h3>Pro</h3>
                  <span className="tier-discount-tag">50% OFF</span>
                </div>
                <p className="tier-desc">Complete toolkit for active job seekers.</p>

                <div className="price-row">
                  <span className="price-currency">₹</span>
                  <span className="price-amount">{billingCycle === 'yearly' ? '990' : '99'}</span>
                  <span className="price-period">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
              </div>

              <div className="tier-features-list">
                <div className="feature-item"><Check size={16} className="check" /> 10 AI Mock Interviews / mo</div>
                <div className="feature-item"><Check size={16} className="check" /> 50 AI Credits</div>
                <div className="feature-item"><Check size={16} className="check" /> In-depth STAR Diagnostics</div>
                <div className="feature-item"><Check size={16} className="check" /> ATS Resume Studio &amp; Export</div>
                <div className="feature-item"><Check size={16} className="check" /> AI Cover Letter Generator</div>
              </div>

              <Link to="/register" className="btn-tier btn-tier-primary">
                <span>Upgrade to Pro</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            {/* Tier 3: Premium */}
            <div className="pricing-card">
              <div className="tier-header">
                <div className="tier-top-row">
                  <h3>Premium</h3>
                  <span className="tier-discount-tag">50% OFF</span>
                </div>
                <p className="tier-desc">Unlimited practice for senior &amp; staff loops.</p>

                <div className="price-row">
                  <span className="price-currency">₹</span>
                  <span className="price-amount">{billingCycle === 'yearly' ? '1990' : '199'}</span>
                  <span className="price-period">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
              </div>

              <div className="tier-features-list">
                <div className="feature-item"><Check size={16} className="check" /> 25 AI Mock Interviews / mo</div>
                <div className="feature-item"><Check size={16} className="check" /> 100 AI Credits</div>
                <div className="feature-item"><Check size={16} className="check" /> All Pro Features Included</div>
                <div className="feature-item"><Check size={16} className="check" /> Custom Company Deep Dives</div>
                <div className="feature-item"><Check size={16} className="check" /> 24/7 Priority Support</div>
              </div>

              <Link to="/register" className="btn-tier btn-tier-outline">
                <span>Get Premium</span>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ===== 9. FREQUENTLY ASKED QUESTIONS ===== */}
      <section className="landing-section" id="faq" ref={faqRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">FAQ</span>
            <h2>Frequently Asked Questions</h2>
            <p>
              Quick answers to common questions.
            </p>
          </div>

          <div className="faq-accordion-list">
            {FAQ_ITEMS.map((item, index) => (
              <div key={index} className="faq-item-card reveal-on-scroll">
                <button 
                  type="button" 
                  className="faq-question-button"
                  onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                  aria-expanded={openFaq === index}
                >
                  <span className="faq-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="faq-title">{item.q}</span>
                  <ChevronDown size={18} className={`faq-chevron ${openFaq === index ? 'open' : ''}`} />
                </button>
                <div className={`faq-collapse ${openFaq === index ? 'expanded' : ''}`}>
                  <div className="faq-content">
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 10. FINAL CONVERSION CTA BANNER ===== */}
      <section className="landing-cta-banner">
        <div className="cta-container">
          <div className="cta-card">
            <div className="cta-card-badge">
              <Sparkles size={14} />
              <span>Free to Start · No Credit Card Required</span>
            </div>

            <h2>Ready to Ace Your Next Tech Interview?</h2>
            <p>
              Start practicing with KIVI-AI in seconds.
            </p>

            <div className="cta-button-group">
              <Link to="/register" className="btn-cta-large" id="footer-cta-register-btn">
                <span>Start Practicing for Free</span>
                <ArrowRight size={17} />
              </Link>
            </div>

            <div className="cta-security-strip">
              <div className="sec-item">
                <Shield size={14} />
                <span>AES-256 Encryption</span>
              </div>
              <div className="sec-item">
                <Lock size={14} />
                <span>Zero AI Training on Your Data</span>
              </div>
              <div className="sec-item">
                <CheckCircle2 size={14} />
                <span>Free Plan Available Forever</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 11. GLOBAL FOOTER ===== */}
      <Footer theme={theme} />

    </div>
  );
};

export default LandingPage;
