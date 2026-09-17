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

// Role data for Hero Showcase & Interactive Simulator
const HERO_SHOWCASE_DATA = {
  fullstack: {
    title: "Full Stack Engineer",
    company: "FinTech Scale-up",
    difficulty: "Senior L5",
    question: "How would you architect a resilient payment webhook receiver handling 50k events/min with zero data loss?",
    transcript: "I'd place an AWS API Gateway in front of SQS FIFO queues for immediate 200 OK acknowledgment and rate smoothing, consume events with idempotent Node.js microservices using Redis distributed locks, and persist processed events into PostgreSQL with automated dead-letter queue (DLQ) retry handlers.",
    starBreakdown: {
      situation: "High-throughput webhook bursts causing database connection exhaustion.",
      task: "Decouple ingestion from processing with guaranteed idempotency.",
      action: "Implemented SQS FIFO queue + Redis deduplication hash + DLQ.",
      result: "99.999% delivery reliability and eliminated database spikes under 60k req/min load tests."
    },
    score: 96,
    techScore: 98,
    starScore: 94,
    feedback: "Exceptional architecture design. Clearly highlighted idempotency keys and DLQ recovery protocols."
  },
  frontend: {
    title: "Staff Frontend Architect",
    company: "SaaS Enterprise",
    difficulty: "Staff L6",
    question: "How do you systematically profile and optimize Largest Contentful Paint (LCP) and INP in a large React SPA?",
    transcript: "I isolate long tasks using the Chrome DevTools Performance panel, defer non-critical scripts with code-splitting and dynamic imports, optimize critical hero rendering with server-side preloading, and replace heavy synchronous state updates with React 19 startTransition.",
    starBreakdown: {
      situation: "Complex dashboard LCP degraded to 3.8s with noticeable input latency on complex filters.",
      task: "Achieve Core Web Vitals 'Good' thresholds across all global regions.",
      action: "Applied atomic component chunking, virtualized heavy lists, and offloaded filter calculations to Web Workers.",
      result: "Reduced LCP to 1.1s (71% improvement) and brought INP under 45ms across 98% of users."
    },
    score: 94,
    techScore: 95,
    starScore: 93,
    feedback: "Strong grasp of browser rendering pipelines, Web Workers, and contemporary React 19 transition primitives."
  },
  ai: {
    title: "AI / LLM Systems Engineer",
    company: "Autonomous AI Lab",
    difficulty: "Senior L5",
    question: "How do you eliminate hallucination and latency bottlenecks in multi-tenant RAG pipelines?",
    transcript: "I implement a two-stage hybrid retrieval combining BM25 keyword matching with dense vector embeddings via Qdrant, pass the top 30 chunks through a Cross-Encoder re-ranker, apply prompt constraints requiring explicit citation grounding, and cache vector queries in Redis Semantic Cache.",
    starBreakdown: {
      situation: "Enterprise knowledge agent producing 12% hallucination rate on domain-specific compliance questions.",
      task: "Lower hallucination below 1% while reducing p95 retrieval latency from 1.4s to under 400ms.",
      action: "Engineered hybrid search + Cross-Encoder re-ranking + deterministic JSON schema output with citation checks.",
      result: "Achieved 0.4% hallucination rate and 310ms p95 latency with a 65% Redis semantic cache hit rate."
    },
    score: 97,
    techScore: 98,
    starScore: 96,
    feedback: "State-of-the-art approach to RAG architecture. Clear understanding of re-ranking economics and semantic caching."
  },
  devops: {
    title: "DevOps & Cloud Architect",
    company: "Global Cloud Platform",
    difficulty: "Principal L6",
    question: "Explain your strategy for conducting a zero-downtime database migration across multi-region Kubernetes clusters.",
    transcript: "I execute an expand-contract database schema pattern with dual-writing at the application layer, utilize Debezium CDC connectors to stream real-time replication to the target database, verify checksum equality, and switch traffic progressively using Istio virtual services.",
    starBreakdown: {
      situation: "Monolithic PostgreSQL cluster requiring migration to Aurora Multi-Region with zero customer downtime.",
      task: "Migrate 4TB dataset without data drift or read/write service interruption.",
      action: "Implemented dual-write application logic + Kafka CDC stream validation + automated rollback triggers.",
      result: "Completed migration in 45 minutes with 0 dropped transactions and zero service downtime."
    },
    score: 95,
    techScore: 96,
    starScore: 94,
    feedback: "Flawless operational plan. Dual-write validation and automated rollback safety nets demonstrated deep enterprise maturity."
  }
};

const FAQ_ITEMS = [
  {
    q: "How does KIVI-AI evaluate my answers in real-time?",
    a: "KIVI-AI utilizes low-latency Groq 120B inference and Google Gemini 2.5 Flash to analyze your spoken or typed responses against real industry rubrics. It evaluates technical correctness, system design tradeoffs, problem-solving depth, and adherence to the STAR (Situation, Task, Action, Result) methodology."
  },
  {
    q: "How does the ATS Resume Matcher analyze job descriptions?",
    a: "Our ATS Engine parses your resume's structured experience and compares semantic keywords against target job descriptions. It uncovers missing technical skills, analyzes keyword frequency, flags layout compliance issues, and scores your resume with high accuracy."
  },
  {
    q: "Is KIVI-AI personalized to my specific experience level?",
    a: "Yes! When you input your resume and target role, KIVI-AI calibrates interview difficulty, scenario depth, and architectural expectations (from Junior L3 up to Staff/Principal L6) specifically tailored to your target company and seniority."
  },
  {
    q: "Can I edit and export my resume directly within KIVI-AI?",
    a: "Absolutely. Our built-in Resume Studio features a rich TipTap editor with instant AI section rewrites, action-verb suggestions, and single-click ATS-compliant PDF downloads."
  },
  {
    q: "Is my personal resume and interview audio private?",
    a: "100% confidential. Your data is encrypted with TLS 1.3 in transit and AES-256 at rest. We never share your data with recruiters or third parties, nor do we use your private resumes to train public AI models."
  },
  {
    q: "What is included in the Free tier versus Pro?",
    a: "The Free plan grants full access to test AI mock interview loops, resume match diagnostics, and roadmap planners. Pro unlocks unlimited voice/text interview simulations, full TipTap Resume Studio rewrites, and prioritized high-speed AI inference."
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

  // Hero interactive state
  const [heroTab, setHeroTab] = useState('interview'); // 'interview' | 'ats' | 'roadmap'
  const [heroRole, setHeroRole] = useState('fullstack');

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

  // Cancel speech and mic on tab or role switch
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
  }, [heroRole, heroTab, simRole]);

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

  const currentHeroData = HERO_SHOWCASE_DATA[heroRole];
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

      {/* ===== 2. HERO SECTION — Pure UI Showcase (No Cartoon Images) ===== */}
      <section className="landing-hero-section" ref={heroRef}>
        <div className="hero-container">
          
          {/* Hero Header & Value Proposition */}
          <div className="hero-header-block reveal-on-scroll">
            <div className="hero-announcement-pill">
              <span className="pill-dot"></span>
              <Sparkles size={14} className="pill-icon" />
              <span className="pill-text">KIVI AI 2.0 Engine · Groq 120B & Gemini 2.5 Flash</span>
              <span className="pill-tag">New</span>
            </div>

            <h1 className="hero-title">
              Master Tech Interviews & <span className="title-highlight">Land Your Dream Offer</span>
            </h1>

            <p className="hero-subtitle">
              Simulate role-specific AI mock interviews, benchmark your resume against target job descriptions with instant ATS match scoring, and follow day-wise prep roadmaps with zero guesswork.
            </p>

            <div className="hero-cta-actions">
              <Link to="/register" className="btn-hero-primary" id="hero-cta-start-btn">
                <span>Start Practicing for Free</span>
                <ArrowRight size={16} />
              </Link>
              <a href="#simulator" className="btn-hero-secondary" id="hero-cta-demo-btn">
                <Play size={15} />
                <span>Try Live Studio</span>
              </a>
            </div>

            <div className="hero-trust-indicators">
              <div className="trust-badge-item">
                <CheckCircle2 size={15} className="check-icon" />
                <span>Free Forever Tier</span>
              </div>
              <div className="trust-badge-item">
                <CheckCircle2 size={15} className="check-icon" />
                <span>No Credit Card Needed</span>
              </div>
              <div className="trust-badge-item">
                <CheckCircle2 size={15} className="check-icon" />
                <span>Real-Time STAR Feedback</span>
              </div>
              <div className="trust-badge-item">
                <CheckCircle2 size={15} className="check-icon" />
                <span>ATS Match Diagnostics</span>
              </div>
            </div>
          </div>

          {/* Interactive Hero SaaS Product Showcase (Pure Code UI Mockup) */}
          <div className="hero-showcase-wrapper reveal-on-scroll">
            <div className="showcase-window">
              
              {/* Window Header */}
              <div className="window-topbar">
                <div className="window-dots">
                  <span className="dot dot-close" />
                  <span className="dot dot-minimize" />
                  <span className="dot dot-expand" />
                </div>

                {/* Interactive Mode Tabs */}
                <div className="window-tabs">
                  <button 
                    type="button"
                    className={`win-tab ${heroTab === 'interview' ? 'active' : ''}`}
                    onClick={() => setHeroTab('interview')}
                  >
                    <Mic size={13} />
                    <span>AI Mock Interview</span>
                  </button>
                  <button 
                    type="button"
                    className={`win-tab ${heroTab === 'ats' ? 'active' : ''}`}
                    onClick={() => setHeroTab('ats')}
                  >
                    <Target size={13} />
                    <span>ATS Resume Match</span>
                  </button>
                  <button 
                    type="button"
                    className={`win-tab ${heroTab === 'roadmap' ? 'active' : ''}`}
                    onClick={() => setHeroTab('roadmap')}
                  >
                    <Compass size={13} />
                    <span>14-Day Roadmap</span>
                  </button>
                </div>

                <div className="window-status-pill">
                  <span className="live-ping" />
                  <span>Interactive Preview</span>
                </div>
              </div>

              {/* Role Switcher Filter Bar */}
              <div className="showcase-role-bar">
                <span className="role-bar-label">Target Specialty:</span>
                <div className="role-bar-pills">
                  {Object.keys(HERO_SHOWCASE_DATA).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`role-btn ${heroRole === key ? 'active' : ''}`}
                      onClick={() => setHeroRole(key)}
                    >
                      {HERO_SHOWCASE_DATA[key].title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Showcase Body Content (Switches by Tab) */}
              <div className="showcase-body">
                {heroTab === 'interview' && (
                  <div className="showcase-view-interview">
                    {/* Left Column: Live Conversation Loop */}
                    <div className="interview-left-pane">
                      {/* Interviewer Message */}
                      <div className="chat-bubble bubble-ai">
                        <div className="bubble-header">
                          <div className="bubble-avatar ai-avatar">
                            <Bot size={14} />
                          </div>
                          <span className="bubble-author">KIVI Interviewer (Staff Lead)</span>
                          <span className="bubble-tag">{currentHeroData.difficulty}</span>
                          <button
                            type="button"
                            className={`audio-sim-btn mini-voice-btn ${speakingType === 'interviewer' ? 'speaking' : ''}`}
                            onClick={() => handleToggleSpeak(currentHeroData.question, 'male', 'interviewer')}
                            title="Listen to Interviewer question with Microsoft Voice"
                          >
                            {speakingType === 'interviewer' ? <Pause size={11} /> : <Volume2 size={11} />}
                            <span>{speakingType === 'interviewer' ? "Pause AI" : "Listen Question"}</span>
                          </button>
                        </div>
                        <p className="bubble-text">"{currentHeroData.question}"</p>
                      </div>

                      {/* Candidate Response Preview */}
                      <div className="chat-bubble bubble-candidate">
                        <div className="bubble-header">
                          <div className="bubble-avatar user-avatar">
                            <span>YOU</span>
                          </div>
                          <span className="bubble-author">Candidate Voice Response</span>
                          <button 
                            type="button" 
                            className={`audio-sim-btn ${speakingType === 'candidate' ? 'speaking' : ''}`}
                            onClick={() => handleToggleSpeak(currentHeroData.transcript, 'female', 'candidate')}
                            title="Play simulated candidate voice response with Microsoft Neural Voice"
                          >
                            {speakingType === 'candidate' ? <Pause size={12} /> : <Volume2 size={12} />}
                            <span>{speakingType === 'candidate' ? "Pause Audio" : "Play Voice (0:42)"}</span>
                          </button>
                        </div>
                        
                        {/* Animated waveform visualizer */}
                        <div className={`audio-waveform-row ${speakingType === 'candidate' ? 'playing' : ''}`}>
                          {[40, 65, 30, 85, 95, 45, 75, 100, 60, 35, 80, 50, 90, 70, 40, 85, 60, 95, 50, 30, 75, 90, 45, 60].map((h, i) => (
                            <span 
                              key={i} 
                              className="wave-bar" 
                              style={{ 
                                height: `${h}%`,
                                animationDelay: `${i * 45}ms` 
                              }} 
                            />
                          ))}
                        </div>

                        <p className="bubble-text candidate-transcript">
                          "{currentHeroData.transcript}"
                        </p>
                      </div>
                    </div>

                    {/* Right Column: Real-Time Diagnostic Scorecard */}
                    <div className="interview-right-pane">
                      <div className="diagnostic-card">
                        <div className="diagnostic-header">
                          <div className="score-ring-wrap">
                            <div className="score-number">{currentHeroData.score}</div>
                            <div className="score-meta">
                              <span className="score-unit">/100</span>
                              <span className="score-status">Strong Hire</span>
                            </div>
                          </div>
                          <div className="rubric-badge">
                            <Sparkles size={12} />
                            <span>STAR Verified</span>
                          </div>
                        </div>

                        <div className="rubric-metrics-list">
                          <div className="rubric-row">
                            <div className="rubric-info">
                              <span>Technical Architecture</span>
                              <span className="metric-val">{currentHeroData.techScore}%</span>
                            </div>
                            <div className="rubric-track">
                              <div className="rubric-fill fill-blue" style={{ width: `${currentHeroData.techScore}%` }} />
                            </div>
                          </div>

                          <div className="rubric-row">
                            <div className="rubric-info">
                              <span>STAR Framing & Delivery</span>
                              <span className="metric-val">{currentHeroData.starScore}%</span>
                            </div>
                            <div className="rubric-track">
                              <div className="rubric-fill fill-emerald" style={{ width: `${currentHeroData.starScore}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* STAR Methodology Breakdown Box */}
                        <div className="star-breakdown-box">
                          <span className="star-box-title">STAR Methodology Analysis:</span>
                          <div className="star-item">
                            <span className="star-key key-s">S</span>
                            <span className="star-val">{currentHeroData.starBreakdown.situation}</span>
                          </div>
                          <div className="star-item">
                            <span className="star-key key-t">T</span>
                            <span className="star-val">{currentHeroData.starBreakdown.task}</span>
                          </div>
                          <div className="star-item">
                            <span className="star-key key-a">A</span>
                            <span className="star-val">{currentHeroData.starBreakdown.action}</span>
                          </div>
                          <div className="star-item">
                            <span className="star-key key-r">R</span>
                            <span className="star-val">{currentHeroData.starBreakdown.result}</span>
                          </div>
                        </div>

                        <div className="ai-coach-note">
                          <Zap size={14} className="coach-icon" />
                          <p>{currentHeroData.feedback}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {heroTab === 'ats' && (
                  <div className="showcase-view-ats">
                    <div className="ats-grid-layout">
                      <div className="ats-metric-card">
                        <div className="ats-metric-header">
                          <div>
                            <span className="ats-metric-title">ATS Match Diagnostic</span>
                            <h4>Resume vs Job Description Alignment</h4>
                          </div>
                          <div className="ats-score-pill">
                            <span className="big-score">92%</span>
                            <span className="sub-lbl">High Match</span>
                          </div>
                        </div>

                        <div className="ats-keywords-section">
                          <div className="keyword-group">
                            <span className="kw-heading">Matched Core Competencies (14)</span>
                            <div className="kw-chips-row">
                              <span className="kw-chip matched"><Check size={12} /> Distributed Systems</span>
                              <span className="kw-chip matched"><Check size={12} /> Redis Caching</span>
                              <span className="kw-chip matched"><Check size={12} /> PostgreSQL Indexing</span>
                              <span className="kw-chip matched"><Check size={12} /> Docker & K8s</span>
                              <span className="kw-chip matched"><Check size={12} /> REST & gRPC APIs</span>
                              <span className="kw-chip matched"><Check size={12} /> CI/CD Automation</span>
                            </div>
                          </div>

                          <div className="keyword-group">
                            <span className="kw-heading missing-title">Identified Skill Gaps to Address (2)</span>
                            <div className="kw-chips-row">
                              <span className="kw-chip gap"><Zap size={12} /> Apache Kafka Streaming</span>
                              <span className="kw-chip gap"><Zap size={12} /> SLO / Prometheus Telemetry</span>
                            </div>
                          </div>
                        </div>

                        <div className="ats-recommendation-box">
                          <Sparkles size={14} className="rec-icon" />
                          <p>
                            <strong>TipTap AI Suggestion:</strong> Your resume clearly demonstrates SQL optimization, but lacks explicit Kafka event streaming terminology requested in line 18 of the JD. One-click rewrite available in Resume Studio.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {heroTab === 'roadmap' && (
                  <div className="showcase-view-roadmap">
                    <div className="roadmap-preview-header">
                      <div>
                        <h4>14-Day Structured Interview Roadmap</h4>
                        <p>Role: {currentHeroData.title} · Estimated Prep: 45 mins/day</p>
                      </div>
                      <div className="roadmap-progress-badge">
                        <span className="badge-txt">Day 5 of 14</span>
                        <span className="badge-pct">68% Complete</span>
                      </div>
                    </div>

                    <div className="roadmap-timeline-preview">
                      <div className="timeline-node done">
                        <div className="node-marker"><Check size={12} /></div>
                        <div className="node-content">
                          <h5>Days 1-3: Core Architecture & Concurrency Drills</h5>
                          <p>Completed 12 mock scenarios on distributed locking, connection pooling & caching.</p>
                        </div>
                      </div>

                      <div className="timeline-node active">
                        <div className="node-marker current"><span>5</span></div>
                        <div className="node-content">
                          <h5>Days 4-7: Real-Time Event Pipelines & Webhook Failure Recovery</h5>
                          <p>Current module: Practice SQS FIFO & DLQ retry strategy mock interview loop.</p>
                        </div>
                      </div>

                      <div className="timeline-node upcoming">
                        <div className="node-marker"><span>8</span></div>
                        <div className="node-content">
                          <h5>Days 8-11: Behavioral STAR Deep-Dives & Executive Communication</h5>
                          <p>Scheduled: Cross-functional leadership and conflict resolution simulations.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Showcase Footer Strip */}
              <div className="showcase-footer">
                <div className="footer-stat">
                  <Cpu size={14} />
                  <span>Powered by Groq 120B Fast Inference (0.28s TTFT)</span>
                </div>
                <Link to="/register" className="footer-link">
                  <span>Open Full Workspace</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ===== 3. TRUST & SOCIAL PROOF TICKER ===== */}
      <section className="landing-trust-ticker">
        <div className="ticker-container">
          <p className="ticker-label">
            Candidates prepared with KIVI-AI received offers from top engineering organizations
          </p>
          
          <div className="company-logos-row">
            <div className="company-item">Google</div>
            <div className="company-item">Amazon</div>
            <div className="company-item">Microsoft</div>
            <div className="company-item">Meta</div>
            <div className="company-item">Stripe</div>
            <div className="company-item">Netflix</div>
            <div className="company-item">Uber</div>
            <div className="company-item">Airbnb</div>
          </div>

          <div className="metrics-summary-grid">
            <div className="metric-cell">
              <span className="metric-number">50,000+</span>
              <span className="metric-title">Interviews Simulated</span>
              <span className="metric-desc">Across 120+ specialized technical domains</span>
            </div>

            <div className="metric-cell">
              <span className="metric-number">94.6%</span>
              <span className="metric-title">Offer Success Rate</span>
              <span className="metric-desc">Candidates landing target offers within 60 days</span>
            </div>

            <div className="metric-cell">
              <span className="metric-number">88%</span>
              <span className="metric-title">ATS Match Score Boost</span>
              <span className="metric-desc">Average jump after TipTap Resume Studio optimization</span>
            </div>

            <div className="metric-cell">
              <span className="metric-number">4.9 / 5.0</span>
              <span className="metric-title">Candidate Satisfaction</span>
              <span className="metric-desc">From 12,000+ verified engineer reviews</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 4. CORE FEATURES BENTO GRID (Pure UI / Human UX) ===== */}
      <section className="landing-section" id="features" ref={featuresRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">Comprehensive Career Platform</span>
            <h2>Everything You Need to Ace Modern Tech Interviews</h2>
            <p>
              Replace anxiety with data-driven confidence. KIVI-AI equips you with multi-modal AI feedback, ATS resume benchmarking, and structured milestone prep.
            </p>
          </div>

          <div className="bento-features-grid">
            
            {/* Feature 1: AI Mock Interviews */}
            <div className="bento-card bento-card-large reveal-on-scroll">
              <div className="card-badge-row">
                <span className="feature-pill blue">
                  <Mic size={13} />
                  <span>Real-Time Voice & Text</span>
                </span>
                <span className="speed-pill">Groq 120B Fast LLM</span>
              </div>
              <h3>Role-Tailored AI Mock Interviews</h3>
              <p>
                Practice technical architecture questions, coding tradeoffs, and behavioral loops customized to your exact experience level and target job description.
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
                <div className="mini-rubric-pills">
                  <span className="rubric-pill"><Check size={11} /> STAR Analysis</span>
                  <span className="rubric-pill"><Check size={11} /> Tradeoff Reasoning</span>
                  <span className="rubric-pill"><Check size={11} /> Audio Waveform</span>
                </div>
              </div>
            </div>

            {/* Feature 2: ATS Diagnostics */}
            <div className="bento-card bento-card-large reveal-on-scroll">
              <div className="card-badge-row">
                <span className="feature-pill emerald">
                  <Target size={13} />
                  <span>Instant Match Diagnostic</span>
                </span>
                <span className="speed-pill">Gemini 2.5 Flash</span>
              </div>
              <h3>Precision Skill Gap Diagnostics</h3>
              <p>
                Benchmark your CV side-by-side against any live LinkedIn, Greenhouse, or Indeed posting to detect missing keywords and qualification mismatches.
              </p>
              
              {/* Mini UI Widget */}
              <div className="feature-mini-widget widget-ats">
                <div className="mini-ats-bar">
                  <div className="ats-label-row">
                    <span>ATS Compatibility Score</span>
                    <span className="ats-score-bold">94%</span>
                  </div>
                  <div className="mini-progress-track">
                    <div className="mini-progress-bar" style={{ width: '94%' }}></div>
                  </div>
                </div>
                <div className="mini-keyword-tags">
                  <span className="kw-tag matched">PostgreSQL</span>
                  <span className="kw-tag matched">Redis</span>
                  <span className="kw-tag matched">Docker</span>
                  <span className="kw-tag missing">+ Microservices</span>
                </div>
              </div>
            </div>

            {/* Feature 3: Day-Wise Roadmaps */}
            <div className="bento-card reveal-on-scroll">
              <div className="feature-icon-box box-blue">
                <Compass size={22} />
              </div>
              <h3>Day-Wise Structured Roadmaps</h3>
              <p>
                Generate milestone study schedules with interactive daily task checklists calibrated to your upcoming interview date.
              </p>
              <div className="card-footer-tags">
                <span className="ft-tag">Interactive Checklist</span>
                <span className="ft-tag">Time Estimates</span>
              </div>
            </div>

            {/* Feature 4: TipTap Resume Studio */}
            <div className="bento-card reveal-on-scroll">
              <div className="feature-icon-box box-indigo">
                <FileText size={22} />
              </div>
              <h3>AI TipTap Resume Studio</h3>
              <p>
                Edit and rewrite resume bullet points with instant AI action-verb enhancements and 1-click ATS PDF document export.
              </p>
              <div className="card-footer-tags">
                <span className="ft-tag">Rich TipTap Editor</span>
                <span className="ft-tag">ATS Formatted PDF</span>
              </div>
            </div>

            {/* Feature 5: Cover Letter Engine */}
            <div className="bento-card reveal-on-scroll">
              <div className="feature-icon-box box-amber">
                <Zap size={22} />
              </div>
              <h3>Targeted Cover Letter Engine</h3>
              <p>
                Produce personalized, role-aligned cover letters that seamlessly integrate your real accomplishments into the company's mission.
              </p>
              <div className="card-footer-tags">
                <span className="ft-tag">Tone Selection</span>
                <span className="ft-tag">One-Click Copy</span>
              </div>
            </div>

            {/* Feature 6: 24/7 AI Copilot */}
            <div className="bento-card reveal-on-scroll">
              <div className="feature-icon-box box-pink">
                <Bot size={22} />
              </div>
              <h3>24/7 Career Copilot</h3>
              <p>
                Your private on-demand coach for quick architectural queries, behavioral question practice drills, and compensation negotiation tips.
              </p>
              <div className="card-footer-tags">
                <span className="ft-tag">Multi-Turn Chat</span>
                <span className="ft-tag">Low-Latency</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===== 5. INTERACTIVE LIVE SIMULATOR / TEST DRIVE ===== */}
      <section className="landing-section section-simulator" id="simulator" ref={simulatorRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">Live Interactive Studio</span>
            <h2>Test Drive KIVI-AI Simulation Engine</h2>
            <p>
              Select your specialty and evaluate how our scoring model grades technical depth, tradeoff reasoning, and STAR communication in seconds.
            </p>
          </div>

          <div className="simulator-workbench reveal-on-scroll">
            {/* Top Toolbar */}
            <div className="sim-toolbar">
              <div className="sim-role-selector">
                <span className="selector-title">Choose Domain:</span>
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
                <span>Rubric: Senior L5+ Standards</span>
              </div>
            </div>

            {/* Simulator Main Content Grid */}
            <div className="sim-grid">
              
              {/* Left: Question & Senior Model Answer */}
              <div className="sim-left-pane">
                <div className="sim-question-block">
                  <div className="block-label">
                    <Sparkles size={14} />
                    <span>Technical Scenario Question ({currentSimData.title})</span>
                  </div>
                  <h4 className="sim-question-text">"{currentSimData.question}"</h4>
                </div>

                <div className="sim-benchmark-answer">
                  <div className="benchmark-header">
                    <span className="benchmark-title">AI Senior STAR Breakdown Benchmark:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className={`sim-voice-btn ${speakingType === 'benchmark' ? 'speaking' : ''}`}
                        onClick={() => handleToggleSpeak(currentSimData.transcript, 'male', 'benchmark')}
                        title="Listen to benchmark answer with Microsoft Voice"
                      >
                        {speakingType === 'benchmark' ? <Pause size={11} /> : <Volume2 size={11} />}
                        <span>{speakingType === 'benchmark' ? "Pause Voice" : "Listen Answer"}</span>
                      </button>
                      <span className="benchmark-score-tag">Score: {currentSimData.score}/100</span>
                    </div>
                  </div>
                  <p className="benchmark-text">
                    "{currentSimData.transcript}"
                  </p>
                  
                  <div className="benchmark-rubric-grid">
                    <div className="rubric-mini-col">
                      <span className="rm-key">Situation & Task</span>
                      <span className="rm-desc">{currentSimData.starBreakdown.situation}</span>
                    </div>
                    <div className="rubric-mini-col">
                      <span className="rm-key">Action & Strategy</span>
                      <span className="rm-desc">{currentSimData.starBreakdown.action}</span>
                    </div>
                    <div className="rubric-mini-col">
                      <span className="rm-key">Quantified Result</span>
                      <span className="rm-desc">{currentSimData.starBreakdown.result}</span>
                    </div>
                  </div>
                </div>

                {/* Interactive User Sandbox */}
                <div className="user-test-sandbox">
                  <div className="sandbox-header">
                    <span className="sandbox-title">Test Your Own Answer in Sandbox:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        className={`sandbox-mic-btn ${isListeningMic ? 'listening' : ''}`}
                        onClick={handleToggleMic}
                        title={isListeningMic ? "Click to stop microphone recording" : "Speak your answer using microphone"}
                      >
                        {isListeningMic ? <MicOff size={13} /> : <Mic size={13} />}
                        <span>{isListeningMic ? "Listening... (Click to Stop)" : "Speak Answer (Mic)"}</span>
                        {isListeningMic && <span className="mic-live-pulse" />}
                      </button>
                      <button 
                        type="button" 
                        className="sandbox-fill-btn"
                        onClick={() => setUserCustomAnswer(currentSimData.transcript)}
                      >
                        Use Sample Text
                      </button>
                    </div>
                  </div>

                  <div className="sandbox-input-wrap">
                    <textarea 
                      className="sandbox-textarea"
                      rows={3}
                      placeholder="Type how you would answer this question in a live interview..."
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
                          <span>Evaluate Answer</span>
                        </>
                      )}
                    </button>
                  </div>

                  {customFeedback && (
                    <div className="custom-feedback-card">
                      <div className="cf-header">
                        <span className="cf-score">Simulated Score: {customFeedback.score}%</span>
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
                  <h4 className="radar-title">Comprehensive Competency Scorecard</h4>
                  
                  <div className="radar-main-circle">
                    <span className="rmc-number">{currentSimData.score}%</span>
                    <span className="rmc-label">Readiness Index</span>
                  </div>

                  <div className="radar-bars-stack">
                    <div className="rbar-item">
                      <div className="rbar-labels">
                        <span>Technical Precision & Architecture</span>
                        <span className="rbar-val">{currentSimData.techScore}%</span>
                      </div>
                      <div className="rbar-track">
                        <div className="rbar-fill fill-1" style={{ width: `${currentSimData.techScore}%` }} />
                      </div>
                    </div>

                    <div className="rbar-item">
                      <div className="rbar-labels">
                        <span>STAR Structural Flow</span>
                        <span className="rbar-val">{currentSimData.starScore}%</span>
                      </div>
                      <div className="rbar-track">
                        <div className="rbar-fill fill-2" style={{ width: `${currentSimData.starScore}%` }} />
                      </div>
                    </div>

                    <div className="rbar-item">
                      <div className="rbar-labels">
                        <span>System Tradeoffs & Edge Cases</span>
                        <span className="rbar-val">93%</span>
                      </div>
                      <div className="rbar-track">
                        <div className="rbar-fill fill-3" style={{ width: '93%' }} />
                      </div>
                    </div>

                    <div className="rbar-item">
                      <div className="rbar-labels">
                        <span>Conciseness & Executive Delivery</span>
                        <span className="rbar-val">91%</span>
                      </div>
                      <div className="rbar-track">
                        <div className="rbar-fill fill-4" style={{ width: '91%' }} />
                      </div>
                    </div>
                  </div>

                  <div className="radar-cta-box">
                    <p>Practice 50+ role-specific questions with real voice audio in your dashboard.</p>
                    <Link to="/register" className="btn-radar-launch">
                      <span>Create Free Account</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ===== 6. HOW IT WORKS (Visual Workflow) ===== */}
      <section className="landing-section" id="workflow" ref={workflowRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">Streamlined 4-Step Journey</span>
            <h2>From First Mock to Signed Offer Letter</h2>
            <p>
              Our automated intelligence loop transforms uncertain preparation into an exact, reproducible process.
            </p>
          </div>

          <div className="workflow-steps-grid">
            
            <div className="workflow-card reveal-on-scroll">
              <div className="step-badge-row">
                <span className="step-num">01</span>
                <span className="time-est">~ 30 sec</span>
              </div>
              <h4>Upload Your Resume</h4>
              <p>Upload your existing PDF or paste your background. Our parser extracts all technical competencies and project histories instantly.</p>
            </div>

            <div className="workflow-card reveal-on-scroll">
              <div className="step-badge-row">
                <span className="step-num">02</span>
                <span className="time-est">Instant</span>
              </div>
              <h4>Input Target Job Description</h4>
              <p>Paste the job post from LinkedIn, Greenhouse, or Lever. KIVI-AI computes the ATS match percentage and identifies missing skills.</p>
            </div>

            <div className="workflow-card reveal-on-scroll">
              <div className="step-badge-row">
                <span className="step-num">03</span>
                <span className="time-est">15 min / day</span>
              </div>
              <h4>Practice Simulations & Close Gaps</h4>
              <p>Simulate voice/text mock interviews, follow your 14-day study roadmap, and polish weak architectural areas with instant STAR feedback.</p>
            </div>

            <div className="workflow-card reveal-on-scroll">
              <div className="step-badge-row">
                <span className="step-num">04</span>
                <span className="time-est">Ready to Land</span>
              </div>
              <h4>Generate ATS CV & Ace It</h4>
              <p>Export a tailored ATS-optimized resume from the TipTap studio and step into real interviews with 100% confidence.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ===== 7. VERIFIED CANDIDATE TESTIMONIALS ===== */}
      <section className="landing-section" id="reviews" ref={reviewsRef}>
        <div className="section-container">
          <div className="section-header reveal-on-scroll">
            <span className="section-badge">Verified Success Stories</span>
            <h2>Loved by 12,000+ Software Engineers & Tech Leaders</h2>
            <p>
              Read how candidates used KIVI-AI to bridge skill gaps and land offers at top-paying tech companies.
            </p>
          </div>

          <div className="testimonials-grid">
            
            <div className="testimonial-card reveal-on-scroll">
              <div className="card-top-meta">
                <div className="stars-row">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} className="star-filled" fill="currentColor" />)}
                </div>
                <span className="offer-tag">Landed SDE-2 @ FinTech · 42% Salary Jump</span>
              </div>
              <p className="test-quote">
                "KIVI-AI caught technical skill gaps I didn't even realize were emphasized on the JD. Practicing the distributed caching questions gave me the exact phrasing I used in my final round."
              </p>
              <div className="author-row">
                <div className="author-avatar-badge avatar-blue">DK</div>
                <div className="author-meta">
                  <span className="author-name">Dev Kumar</span>
                  <span className="author-title">Senior Full Stack Engineer</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card reveal-on-scroll">
              <div className="card-top-meta">
                <div className="stars-row">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} className="star-filled" fill="currentColor" />)}
                </div>
                <span className="offer-tag">Landed Staff Architect · Unicorn SaaS</span>
              </div>
              <p className="test-quote">
                "The STAR behavioral grading model is second to none. Getting immediate feedback on whether my answers were structured cleanly removed all my interview anxiety."
              </p>
              <div className="author-row">
                <div className="author-avatar-badge avatar-emerald">SP</div>
                <div className="author-meta">
                  <span className="author-name">Sarah Patel</span>
                  <span className="author-title">Frontend & Web Platform Architect</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card reveal-on-scroll">
              <div className="card-top-meta">
                <div className="stars-row">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} className="star-filled" fill="currentColor" />)}
                </div>
                <span className="offer-tag">Landed DevOps Lead · Series B</span>
              </div>
              <p className="test-quote">
                "The TipTap Resume Studio + AI Section Rewriter took my resume ATS match score from 64% to 92%. I secured 4 interview invites within 10 days of updating my CV."
              </p>
              <div className="author-row">
                <div className="author-avatar-badge avatar-indigo">SD</div>
                <div className="author-meta">
                  <span className="author-name">Shaloni Dubey</span>
                  <span className="author-title">Cloud & Infrastructure Engineer</span>
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
            <span className="section-badge">Simple & Transparent Pricing</span>
            <h2>Transparent Plans for Every Career Stage</h2>
            <p>
              Start for free with zero commitments. Upgrade anytime for in-depth AI evaluations, unlimited ATS rewrites, and priority question generation.
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
                  <span>Yearly</span>
                  <span className="discount-pill">2 Months Free 🎉</span>
                </button>
              </div>

              <div className="special-offer-timer-banner">
                <span className="timer-icon">🔥</span>
                <span className="timer-label">LIMITED TIME DISCOUNT ENDS IN:</span>
                <span className="timer-countdown">
                  {formatCountdown(timeLeft)}
                </span>
                <span className="timer-badge">FLASH 50% OFF</span>
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
                <p className="tier-desc">Perfect for getting started and trying out AI mock interviews.</p>
                <div className="price-row">
                  <span className="price-currency">₹</span>
                  <span className="price-amount">0</span>
                  <span className="price-period">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
              </div>

              <div className="tier-features-list">
                <div className="feature-item"><Check size={16} className="check" /> 3 AI Mock Interviews / month</div>
                <div className="feature-item"><Check size={16} className="check" /> 20 AI Credits</div>
                <div className="feature-item"><Check size={16} className="check" /> Standard Feedback & Scoring</div>
                <div className="feature-item"><Check size={16} className="check" /> Basic Resume Template</div>
                <div className="feature-item"><Check size={16} className="check" /> Community Support</div>
              </div>

              <Link to="/register" className="btn-tier btn-tier-outline">
                <span>Included Free</span>
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
                <p className="tier-desc">Best for active job seekers looking for targeted interview prep.</p>
                
                <div className="original-price-strip">
                  <span className="strike-amount">₹{billingCycle === 'yearly' ? '1990' : '199'}</span>
                  <span className="save-tag">Save ₹{billingCycle === 'yearly' ? '1000' : '100'}</span>
                </div>

                <div className="price-row">
                  <span className="price-currency">₹</span>
                  <span className="price-amount">{billingCycle === 'yearly' ? '990' : '99'}</span>
                  <span className="price-period">/{billingCycle === 'yearly' ? 'year (2 months free)' : 'month'}</span>
                </div>
              </div>

              <div className="tier-features-list">
                <div className="feature-item"><Check size={16} className="check" /> 10 AI Mock Interviews / month</div>
                <div className="feature-item"><Check size={16} className="check" /> 50 AI Credits</div>
                <div className="feature-item"><Check size={16} className="check" /> In-depth Detailed Feedback & Analysis</div>
                <div className="feature-item"><Check size={16} className="check" /> ATS Resume Builder & Live Editor</div>
                <div className="feature-item"><Check size={16} className="check" /> AI Cover Letter Generator</div>
                <div className="feature-item"><Check size={16} className="check" /> Priority Audio & Question Generation</div>
                <div className="feature-item"><Check size={16} className="check" /> Email Support</div>
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
                <p className="tier-desc">Full power for power candidates, career switchers & deep practice.</p>
                
                <div className="original-price-strip">
                  <span className="strike-amount">₹{billingCycle === 'yearly' ? '3990' : '399'}</span>
                  <span className="save-tag">Save ₹{billingCycle === 'yearly' ? '2000' : '200'}</span>
                </div>

                <div className="price-row">
                  <span className="price-currency">₹</span>
                  <span className="price-amount">{billingCycle === 'yearly' ? '1990' : '199'}</span>
                  <span className="price-period">/{billingCycle === 'yearly' ? 'year (2 months free)' : 'month'}</span>
                </div>
              </div>

              <div className="tier-features-list">
                <div className="feature-item"><Check size={16} className="check" /> 25 AI Mock Interviews / month</div>
                <div className="feature-item"><Check size={16} className="check" /> 100 AI Credits</div>
                <div className="feature-item"><Check size={16} className="check" /> All Pro Features Included</div>
                <div className="feature-item"><Check size={16} className="check" /> Full Behavioral & Technical Deep Dives</div>
                <div className="feature-item"><Check size={16} className="check" /> Company & Role Tailored Questions</div>
                <div className="feature-item"><Check size={16} className="check" /> Downloadable PDF Tax Invoices & Reports</div>
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
            <span className="section-badge">Got Questions?</span>
            <h2>Frequently Asked Questions</h2>
            <p>
              Everything you need to know about KIVI-AI and our interview prep intelligence platform.
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
              <span>Instant Setup · No Credit Card Required</span>
            </div>

            <h2>Ready to Ace Your Next Tech Interview?</h2>
            <p>
              Join over 12,000+ ambitious software engineers and tech leaders practicing with KIVI-AI today.
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
                <span>Enterprise AES-256 Encryption</span>
              </div>
              <div className="sec-item">
                <Lock size={14} />
                <span>Private & Never Used for Model Training</span>
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
