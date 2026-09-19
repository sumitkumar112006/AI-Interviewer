import React, { useState } from 'react';
import { useAuth } from '../../Auth/hooks/useAuth';
import { 
  HelpCircle, 
  MessageSquare, 
  Mail, 
  CheckCircle2, 
  Send, 
  Sparkles, 
  Bot, 
  ShieldCheck, 
  ChevronDown, 
  Search, 
  Cpu, 
  RefreshCw,
  Clock,
  Check,
  AlertCircle
} from 'lucide-react';
import '../styles/helpsupport.scss';

const FAQ_DATA = [
  {
    q: "How do monthly generations and daily AI limits work?",
    a: "Free Starter accounts receive 2 Full Generation credits per month and 10 Daily AI Assistant queries. Credits reset automatically on the 1st of every month, while AI Assistant queries reset every 24 hours at midnight. Pro subscribers get unlimited generations."
  },
  {
    q: "How does the ATS Resume Matcher calculate compatibility?",
    a: "Our ATS Diagnostic Engine compares the semantic keywords, skills, toolsets, and experience years in your resume against the target Job Description (JD), identifying exact keyword matches, missing qualifications, and structure compliance."
  },
  {
    q: "Why did my AI Mock Interview score change between attempts?",
    a: "The AI evaluates your response across technical depth, system design tradeoffs, edge-case mitigation, and the STAR framework (Situation, Task, Action, Result). Refining your answers with quantified impact and structured actions will yield higher readiness scores."
  },
  {
    q: "Can I download ATS-ready PDFs directly from the Resume Studio?",
    a: "Yes! In the Resume Studio, click 'Download PDF' at any time. Our PDF export engine formats the document with single-column, parser-friendly ATS standards ensuring maximum ATS readability."
  },
  {
    q: "Is my resume data and interview audio confidential?",
    a: "100% private and confidential. Your data is encrypted using TLS 1.3 in transit and AES-256 at rest. We never share your data with third parties or recruiters, and private documents are never used to train public models."
  },
  {
    q: "How can I upgrade or manage my subscription plan?",
    a: "Navigate to the 'Pricing & Plans' tab in your sidebar to upgrade to Pro Candidate or Lifetime Pass. We support instant secure checkout via Razorpay with immediate plan activation."
  }
];

const HelpSupport = () => {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: user?.username || '',
    email: user?.email || '',
    category: 'Technical Bug / Issue',
    priority: 'Normal',
    subject: '',
    message: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // FAQ search & open state
  const [faqSearch, setFaqSearch] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const filteredFaqs = FAQ_DATA.filter(item => 
    item.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
    item.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setErrorMessage('Please fill out all required fields.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || '9dc879dd-9127-4c85-bb04-97a3a368be54';
      const generatedTicketId = `KIVI-SUP-${Math.floor(100000 + Math.random() * 900000)}`;

      const payload = {
        access_key: accessKey,
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: `[Support Ticket ${generatedTicketId}] [${formData.priority}] ${formData.category}: ${formData.subject || 'Support Request'}`,
        category: formData.category,
        priority: formData.priority,
        ticket_id: generatedTicketId,
        user_id: user?._id || user?.id || 'N/A',
        user_plan: user?.plan || 'Free',
        message: formData.message.trim(),
        from_name: 'KIVI-AI Support Portal'
      };

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        setTicketId(generatedTicketId);
        setSubmitted(true);
      } else {
        setErrorMessage(result.message || 'Unable to submit ticket right now. Please try again or email us directly.');
      }
    } catch (err) {
      console.error('Web3Forms support ticket error:', err);
      setErrorMessage('Network connection error. Please check your internet and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setTicketId('');
    setFormData({
      name: user?.username || '',
      email: user?.email || '',
      category: 'Technical Bug / Issue',
      priority: 'Normal',
      subject: '',
      message: ''
    });
  };

  return (
    <div className="help-support-page">
      
      {/* ===== HEADER BANNER ===== */}
      <div className="help-header-banner">
        <div className="header-badge">
          <HelpCircle size={14} />
          <span>Support & Resolution Center</span>
        </div>
        <h1>Help & Support Hub</h1>
        <p>
          Need assistance or running into an issue? Submit a ticket directly to our engineering team or explore the quick knowledge base below.
        </p>
      </div>

      {/* ===== TOP QUICK CARDS ROW ===== */}
      <div className="help-quick-cards-grid">
        
        {/* Quick Card 1: AI Copilot */}
        <div className="quick-card">
          <div className="card-icon-wrap icon-purple">
            <Bot size={22} />
          </div>
          <div className="card-body">
            <h4>Ask KIVI AI Copilot</h4>
            <p>Get instant 24/7 troubleshooting and guidance on interview topics and resumes.</p>
            <button 
              type="button" 
              className="card-link-action"
              onClick={() => {
                const btn = document.querySelector('.kivi-assistant-trigger');
                if (btn) btn.click();
              }}
            >
              <span>Open AI Assistant</span>
              <Sparkles size={13} />
            </button>
          </div>
        </div>

        {/* Quick Card 2: System Health */}
        <div className="quick-card">
          <div className="card-icon-wrap icon-emerald">
            <Cpu size={22} />
          </div>
          <div className="card-body">
            <h4>AI Engine Operational</h4>
            <p>Groq 120B & Gemini 2.5 Flash models online with 99.9% uptime.</p>
            <span className="card-link-action" style={{ color: 'var(--success)', cursor: 'default' }}>
              <Check size={13} /> All Systems Normal
            </span>
          </div>
        </div>

        {/* Quick Card 3: Direct Email */}
        <div className="quick-card">
          <div className="card-icon-wrap icon-blue">
            <Mail size={22} />
          </div>
          <div className="card-body">
            <h4>Direct Email Support</h4>
            <p>Reach out directly to our engineering and support leads.</p>
            <a href="mailto:this.kiviai@gmail.com" className="card-link-action">
              <span>this.kiviai@gmail.com</span>
            </a>
          </div>
        </div>

      </div>

      {/* ===== MAIN TWO-COLUMN GRID ===== */}
      <div className="help-main-grid">
        
        {/* Left: Support Ticket Form (Web3Forms) */}
        <div className="ticket-form-panel">
          
          {submitted ? (
            <div className="ticket-success-state">
              <div className="success-icon-badge">
                <CheckCircle2 size={36} />
              </div>
              <span className="ticket-id-chip">Ticket ID: {ticketId}</span>
              <h3>Ticket Received Successfully!</h3>
              <p>
                Thank you, <strong>{formData.name}</strong>. Your ticket has been logged and delivered to our engineering inbox. We will review your request and reply to <strong>{formData.email}</strong> within 24 hours.
              </p>
              <button type="button" className="btn-new-ticket" onClick={handleResetForm}>
                <span>Submit Another Request</span>
              </button>
            </div>
          ) : (
            <>
              <div className="form-panel-header">
                <h3>Submit a Support Ticket</h3>
                <p>Fill in the details and our support team will respond via email.</p>
              </div>

              <form onSubmit={handleSubmit} className="support-form-fields">
                
                {errorMessage && (
                  <div className="alert-msg alert-error">
                    <AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="form-row-dual">
                  <div className="field-group">
                    <label htmlFor="ticket-name">Your Name *</label>
                    <input 
                      type="text" 
                      id="ticket-name" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleChange}
                      placeholder="e.g. Sumit Kumar" 
                      required 
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="ticket-email">Email Address *</label>
                    <input 
                      type="email" 
                      id="ticket-email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleChange}
                      placeholder="e.g. you@domain.com" 
                      required 
                    />
                  </div>
                </div>

                <div className="form-row-dual">
                  <div className="field-group">
                    <label htmlFor="ticket-category">Category</label>
                    <select 
                      id="ticket-category" 
                      name="category" 
                      value={formData.category} 
                      onChange={handleChange}
                    >
                      <option value="Technical Bug / Issue">Technical Bug / Issue</option>
                      <option value="Mock Interview Evaluation">Mock Interview Evaluation</option>
                      <option value="Resume Studio & PDF Export">Resume Studio & PDF Export</option>
                      <option value="Account & Billing / Limits">Account & Billing / Limits</option>
                      <option value="Feature Request / Feedback">Feature Request / Feedback</option>
                      <option value="General Question">General Question</option>
                    </select>
                  </div>

                  <div className="field-group">
                    <label htmlFor="ticket-priority">Priority</label>
                    <select 
                      id="ticket-priority" 
                      name="priority" 
                      value={formData.priority} 
                      onChange={handleChange}
                    >
                      <option value="Normal">Normal Priority</option>
                      <option value="High">High Priority</option>
                      <option value="Urgent">Urgent (Blocked)</option>
                    </select>
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="ticket-subject">Subject (Optional)</label>
                  <input 
                    type="text" 
                    id="ticket-subject" 
                    name="subject" 
                    value={formData.subject} 
                    onChange={handleChange}
                    placeholder="Short summary of the issue or question..." 
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="ticket-message">Message Details *</label>
                  <textarea 
                    id="ticket-message" 
                    name="message" 
                    rows={4}
                    value={formData.message} 
                    onChange={handleChange}
                    placeholder="Describe what happened or what you need assistance with..." 
                    required 
                  />
                </div>

                <button type="submit" className="btn-submit-ticket" disabled={submitting}>
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="spin-icon" />
                      <span>Sending Ticket...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Submit</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}

        </div>

        {/* Right: Quick FAQ Accordion */}
        <div className="faq-knowledge-panel">
          <div className="panel-top">
            <h3>Frequently Asked Questions</h3>
            <p>Find immediate answers to common platform questions.</p>
          </div>

          <div className="faq-search-input-wrap">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search help topics & questions..." 
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
            />
          </div>

          <div className="faq-accordion-stack">
            {filteredFaqs.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No topics match your search query.</p>
            ) : (
              filteredFaqs.map((faq, index) => (
                <div className="faq-card-item" key={index}>
                  <button 
                    type="button" 
                    className="faq-card-btn"
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? -1 : index)}
                  >
                    <span className="faq-q-title">{faq.q}</span>
                    <ChevronDown size={17} className={`faq-icon ${openFaqIndex === index ? 'open' : ''}`} />
                  </button>
                  <div className={`faq-card-answer ${openFaqIndex === index ? 'expanded' : ''}`}>
                    <div className="answer-inner">
                      <p>{faq.a}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default HelpSupport;
