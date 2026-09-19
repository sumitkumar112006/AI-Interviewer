import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Mic, MicOff, Moon, Play, RefreshCw, Send, Sun } from 'lucide-react';
import Footer from '../../Footer/components/Footer';
import '../landing.scss';

const PRACTICE_ROLES = {
  fullstack: {
    label: 'Full stack',
    role: 'Full Stack Engineer',
    question: 'How do you architect a webhook receiver handling 50k events per minute with zero data loss?',
    sample: 'I place API Gateway in front of SQS FIFO queues for immediate responses, then process events with idempotent services, Redis locks, and a dead-letter queue.',
    score: 96,
    note: 'Clear tradeoffs. Add how you would monitor replay failures in production.'
  },
  frontend: {
    label: 'Frontend',
    role: 'Frontend Architect',
    question: 'How do you systematically improve LCP and INP in a large React application?',
    sample: 'I isolate long tasks with DevTools, split non-critical bundles, preload the critical path, and use transitions around heavy state updates.',
    score: 94,
    note: 'Strong browser fundamentals. Name the user-facing metric you would protect first.'
  },
  ai: {
    label: 'AI / LLM',
    role: 'AI / LLM Engineer',
    question: 'How do you reduce hallucinations and retrieval bottlenecks in a multi-tenant RAG system?',
    sample: 'I combine keyword and dense retrieval, rerank the top chunks, enforce citations, and cache repeated vector queries.',
    score: 97,
    note: 'Good grounding strategy. Explain how you would evaluate answer faithfulness offline.'
  },
  cloud: {
    label: 'Cloud',
    role: 'Cloud Architect',
    question: 'How would you migrate a multi-region database with no downtime or data drift?',
    sample: 'I use an expand-contract schema, dual writes, CDC validation, checksums, and a progressive traffic shift with rollback triggers.',
    score: 95,
    note: 'Operationally sound. Make the rollback decision and its owner explicit.'
  }
};

const FAQ_ITEMS = [
  ['What is KIVI-AI for?', 'KIVI-AI gives technical candidates a calm place to rehearse answers, tighten their resume, and see what to work on next.'],
  ['Does it replace a human interviewer?', 'No. It gives you a repeatable first pass, so your time with mentors and interviewers can focus on judgment and nuance.'],
  ['Can I start without a polished resume?', 'Yes. Start with a rough resume or a target role. The workspace helps you find the story worth sharpening.']
];

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !('IntersectionObserver' in window)) return undefined;
    const items = root.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach((item, index) => {
      item.style.setProperty('--reveal-delay', String(index * 60) + 'ms');
      observer.observe(item);
    });
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function LandingPage() {
  const [theme, setTheme] = useState(() => localStorage.getItem('kivi_theme') || 'light');
  const [roleKey, setRoleKey] = useState('fullstack');
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const [openFaq, setOpenFaq] = useState(0);
  const recognitionRef = useRef(null);
  const pageRef = useReveal();
  const currentRole = PRACTICE_ROLES[roleKey];

  useEffect(() => { localStorage.setItem('kivi_theme', theme); }, [theme]);
  useEffect(() => () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  const handleSpeakSample = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechMessage('Audio playback is not available in this browser.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(currentRole.sample);
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => { setIsSpeaking(false); setSpeechMessage('Audio playback was interrupted. Try again.'); };
    setSpeechMessage('');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const toggleMic = () => {
    if (typeof window === 'undefined') return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage('Speech input is not available here. Try Chrome or Edge, or type your answer instead.');
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => { setSpeechMessage('Listening... speak naturally, then pause.'); setIsListening(true); };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ');
      setAnswer(transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setSpeechMessage(event.error === 'not-allowed' ? 'Microphone permission was blocked. Allow it in your browser, then try again.' : 'Speech input stopped. You can try again or type your answer.');
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setIsListening(false); setSpeechMessage('Speech input could not start. Try again.'); }
  };

  const evaluateAnswer = () => {
    if (!answer.trim()) return;
    setIsEvaluating(true);
    setFeedback(null);
    window.setTimeout(() => {
      setIsEvaluating(false);
      setFeedback({ score: answer.trim().split(/\s+/).length > 16 ? currentRole.score : 68, note: answer.trim().split(/\s+/).length > 16 ? currentRole.note : 'Give the answer a little more shape: name the situation, your action, and the result you were protecting.' });
    }, 650);
  };

  return (
    <div ref={pageRef} className={'kivi-editorial ' + (theme === 'light' ? 'is-light' : 'is-dark')}>
      <header className="editorial-header">
        <Link to="/" className="wordmark" aria-label="KIVI-AI home">
          <img src="/Logo.png" alt="" />
          <span>KIVI-AI</span>
        </Link>
        <nav className="editorial-nav" aria-label="Primary navigation">
          <a href="#workspace">Workspace</a>
          <a href="#method">Method</a>
          <a href="#practice">Practice</a>
          <a href="#plans">Plans</a>
        </nav>
        <div className="header-actions">
          <button type="button" className="theme-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle color theme">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <Link to="/login" className="quiet-link">Sign in</Link>
          <Link to="/register" className="header-cta">Begin <ArrowUpRight size={15} /></Link>
        </div>
      </header>

      <main>
        <section className="editorial-hero" aria-labelledby="hero-title">
          <div className="hero-copy" data-reveal>
            <p className="eyebrow"><span className="eyebrow-mark" /> A quieter way to prepare</p>
            <h1 id="hero-title">Make your next answer <em>feel ready.</em></h1>
            <p className="hero-lede">KIVI-AI brings your resume, practice interviews, and next steps into one focused room—so you can spend less time guessing and more time getting better.</p>
            <div className="hero-actions">
              <Link to="/register" className="ink-button">Start with your role <ArrowRight size={16} /></Link>
              <a href="#practice" className="text-button">See the room <span>↓</span></a>
            </div>
            <p className="hero-footnote">Free to begin <span>·</span> no card required</p>
          </div>
          <div className="hero-stage" data-reveal>
            <div className="stage-note stage-note-top">01 / your preparation room</div>
            <div className="workspace-sheet">
              <div className="sheet-topline"><span>KIVI / 09:42</span><span>Tuesday, ready when you are</span></div>
              <div className="sheet-body">
                <aside className="sheet-rail">
                  <div className="rail-mark">K</div>
                  <span className="rail-active">Today</span>
                  <span>Resume</span>
                  <span>Practice</span>
                  <span>Notes</span>
                </aside>
                <div className="sheet-main">
                  <p className="sheet-kicker">Good morning, Asha</p>
                  <h2>One small step<br /><i>before the loop.</i></h2>
                  <div className="sheet-focus">
                    <div><span className="focus-label">Focus for today</span><strong>System design / tradeoffs</strong></div>
                    <span className="focus-arrow">↗</span>
                  </div>
                  <div className="sheet-bottom">
                    <div><span className="sheet-number">07</span><small>sessions this month</small></div>
                    <div><span className="sheet-number">+18</span><small>resume clarity</small></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="stage-note stage-note-bottom">A space to think clearly.</div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Product promise">
          <div><span className="proof-index">01</span><strong>Read your own story</strong><span>Turn experience into language you can say out loud.</span></div>
          <div><span className="proof-index">02</span><strong>Practice with context</strong><span>Questions adapt to the role, level, and tradeoffs.</span></div>
          <div><span className="proof-index">03</span><strong>Leave with a next move</strong><span>Every session ends with something specific to improve.</span></div>
        </section>

        <section id="workspace" className="workspace-intro" aria-labelledby="workspace-title">
          <div className="section-heading" data-reveal><p className="eyebrow">The workspace</p><h2 id="workspace-title">Everything you need,<br /><em>nothing in the way.</em></h2></div>
          <div className="workspace-copy" data-reveal><p>Your preparation should feel like a desk you return to—not another dashboard asking for attention.</p><Link to="/register" className="arrow-link">Open your workspace <ArrowUpRight size={16} /></Link></div>
        </section>

        <section className="workspace-visual" data-reveal aria-label="KIVI-AI workspace preview">
          <div className="visual-header"><span>Resume / Frontend Architect</span><span>Last edited 6 min ago</span></div>
          <div className="visual-grid">
            <div className="resume-column"><p className="visual-label">Your resume, in view</p><h3>Asha Menon</h3><p className="resume-role">Frontend engineer · Bengaluru</p><div className="resume-rule" /><p className="resume-paragraph">Built calm, accessible interfaces for teams shipping complex tools. I care about the line between useful and merely impressive.</p><div className="resume-lines"><i /><i /><i /><i /></div></div>
            <div className="insight-column"><p className="visual-label">KIVI noticed</p><h4>Your experience is stronger when you name the decision.</h4><p>Three bullets describe the feature. One can describe the constraint you changed.</p><div className="insight-quote">“What did you choose not to build?”</div><button type="button" className="visual-action" onClick={() => document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth' })}>Practice this story <ArrowRight size={15} /></button></div>
          </div>
        </section>

        <section id="method" className="method-section" aria-labelledby="method-title">
          <div className="section-heading" data-reveal><p className="eyebrow">A simple method</p><h2 id="method-title">Prepare in the order<br /><em>your mind works.</em></h2></div>
          <div className="method-list">
            <div className="method-row" data-reveal><span className="method-number">01</span><div><h3>Bring what you have</h3><p>Upload the resume, notes, or job description already on your desk.</p></div><span className="method-word">context</span></div>
            <div className="method-row" data-reveal><span className="method-number">02</span><div><h3>Find the thread</h3><p>KIVI surfaces the stories, gaps, and decisions worth practicing.</p></div><span className="method-word">clarity</span></div>
            <div className="method-row" data-reveal><span className="method-number">03</span><div><h3>Say it out loud</h3><p>Rehearse a realistic question, then get feedback you can use.</p></div><span className="method-word">confidence</span></div>
          </div>
        </section>

        <section id="practice" className="practice-section" aria-labelledby="practice-title">
          <div className="practice-heading" data-reveal><p className="eyebrow">The practice room</p><h2 id="practice-title">A real question<br /><em>is better than a pep talk.</em></h2><p>Choose a role and try one answer. This is a small taste of the feedback loop inside KIVI-AI.</p></div>
          <div className="practice-room" data-reveal>
            <div className="practice-top"><span>Live session / 04:17</span><span className="live-dot">● Listening for the shape of your answer</span></div>
            <div className="role-tabs" role="tablist" aria-label="Practice role">
              {Object.entries(PRACTICE_ROLES).map(([key, role]) => <button key={key} type="button" role="tab" aria-selected={roleKey === key} className={roleKey === key ? 'active' : ''} onClick={() => { setRoleKey(key); setFeedback(null); }}>{role.label}</button>)}
            </div>
            <div className="question-area"><p className="question-meta">{currentRole.role} <span>·</span> seniority-aware prompt</p><h3>{currentRole.question}</h3><button type="button" className="listen-button" onClick={handleSpeakSample} aria-pressed={isSpeaking}><Play size={14} fill="currentColor" /> {isSpeaking ? "Stop sample" : "Hear a sample answer"}</button></div>
            <div className="answer-area"><div className="answer-tools"><label htmlFor="answer-box">Your answer</label><button type="button" onClick={toggleMic} className={isListening ? 'mic-button listening' : 'mic-button'}>{isListening ? <MicOff size={14} /> : <Mic size={14} />} {isListening ? 'Listening' : 'Use your mic'}</button></div><textarea id="answer-box" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Start with the situation. What was difficult, and what did you choose?" /><div className="answer-footer"><span>{speechMessage || (answer ? answer.trim().split(/\s+/).length + ' words' : 'Your answer stays in this session')}</span><button type="button" className="evaluate-button" onClick={evaluateAnswer} disabled={isEvaluating || !answer.trim()}>{isEvaluating ? <><RefreshCw size={14} className="spin" /> Reading</> : <><Send size={14} /> Read my answer</>}</button></div></div>
            {feedback && <div className="feedback-line"><strong>{feedback.score}% ready</strong><span>{feedback.note}</span></div>}
          </div>
        </section>

        <section className="human-section" aria-labelledby="human-title"><div className="human-quote" data-reveal><span className="quote-mark">“</span><h2 id="human-title">I stopped trying to sound impressive and started answering like myself.</h2><p>— Rhea Kapoor, senior product engineer</p></div><div className="human-aside" data-reveal><p>Good preparation does not make you perform a version of yourself. It makes the real version easier to hear.</p><Link to="/register" className="arrow-link">Make a little room <ArrowUpRight size={16} /></Link></div></section>

        <section id="plans" className="plans-section" aria-labelledby="plans-title"><div className="section-heading" data-reveal><p className="eyebrow">Choose your pace</p><h2 id="plans-title">Start small.<br /><em>Keep going.</em></h2></div><div className="plan-lines" data-reveal><div className="plan-line"><div><span>Free</span><small>For getting unstuck</small></div><strong>₹0 <small>/ month</small></strong><span>3 practice sessions</span><Link to="/register" className="plan-link">Begin <ArrowRight size={15} /></Link></div><div className="plan-line is-featured"><div><span>Pro</span><small>For an active search</small></div><strong>₹99 <small>/ month</small></strong><span>Resume studio + 10 sessions</span><Link to="/register" className="plan-link">Choose Pro <ArrowRight size={15} /></Link></div><div className="plan-line"><div><span>Premium</span><small>For senior loops</small></div><strong>₹199 <small>/ month</small></strong><span>Deep dives + 25 sessions</span><Link to="/register" className="plan-link">Go further <ArrowRight size={15} /></Link></div></div></section>

        <section className="faq-section" aria-labelledby="faq-title"><div className="section-heading" data-reveal><p className="eyebrow">A few answers</p><h2 id="faq-title">Before you<br /><em>begin.</em></h2></div><div className="faq-list" data-reveal>{FAQ_ITEMS.map(([question, answer], index) => <div className="faq-row" key={question}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{question}</span><ChevronDown size={17} className={openFaq === index ? 'open' : ''} /></button>{openFaq === index && <p>{answer}</p>}</div>)}</div></section>

        <section className="closing-section"><p className="eyebrow">Your next chapter is not a template</p><h2>Make the work<br /><em>sound like you.</em></h2><Link to="/register" className="ink-button">Start with KIVI-AI <ArrowRight size={16} /></Link></section>
      </main>
      <Footer theme={theme} />
    </div>
  );
}