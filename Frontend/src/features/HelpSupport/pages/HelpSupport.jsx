import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  ArrowLeft,
  ListFilter,
  User,
  Shield
} from 'lucide-react';
import { 
  submitSupportTicket, 
  getMySupportTickets, 
  getMySupportTicketDetails, 
  replyMySupportTicket 
} from '../services/support.api';
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
    q: "Are there any usage limits or paid plans?",
    a: "All candidate features are currently 100% free! Every account gets 100 full mock interview & resume generations every month, along with 500 AI Copilot credits daily with zero paywalls."
  }
];

const HelpSupport = () => {
  const { user } = useAuth();

  // Mode: 'new' | 'my-tickets'
  const [activeMode, setActiveMode] = useState('new');

  // New Ticket Form State
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

  // User Tickets List State
  const [myTickets, setMyTickets] = useState([]);
  const [loadingMyTickets, setLoadingMyTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [userReply, setUserReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyFeedback, setReplyFeedback] = useState(null);

  // FAQ search & open state
  const [faqSearch, setFaqSearch] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const filteredFaqs = FAQ_DATA.filter(item => 
    item.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
    item.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  const fetchMyTickets = async () => {
    if (!user) return;
    try {
      setLoadingMyTickets(true);
      const res = await getMySupportTickets({ limit: 20 });
      if (res.success) {
        setMyTickets(res.tickets || []);
      }
    } catch (err) {
      console.error('Failed to load my tickets:', err);
    } finally {
      setLoadingMyTickets(false);
    }
  };

  useEffect(() => {
    if (activeMode === 'my-tickets' && user) {
      fetchMyTickets();
    }
  }, [activeMode, user]);

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
      const result = await submitSupportTicket({
        name: formData.name.trim(),
        email: formData.email.trim(),
        category: formData.category,
        priority: formData.priority,
        subject: formData.subject.trim(),
        message: formData.message.trim()
      });

      if (result.success) {
        setTicketId(result.ticketId || `KIVI-SUP-${Math.floor(100000 + Math.random() * 900000)}`);
        setSubmitted(true);
        if (user) fetchMyTickets();
      } else {
        setErrorMessage(result.message || 'Unable to submit ticket right now. Please try again or email us directly.');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Network error occurred. Please try again.';
      setErrorMessage(errorMsg);
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

  const handleOpenThread = async (tId) => {
    try {
      setLoadingThread(true);
      setSelectedTicket(null);
      setUserReply('');
      setReplyFeedback(null);
      const res = await getMySupportTicketDetails(tId);
      if (res.success) {
        setSelectedTicket(res.ticket);
      }
    } catch (err) {
      console.error('Failed to load ticket thread:', err);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSendUserReply = async (e) => {
    e.preventDefault();
    if (!userReply.trim() || !selectedTicket?.ticketId) return;

    try {
      setSendingReply(true);
      const res = await replyMySupportTicket(selectedTicket.ticketId, userReply.trim());
      if (res.success) {
        setSelectedTicket(prev => ({
          ...prev,
          status: res.ticket.status,
          responseHistory: res.ticket.responseHistory
        }));
        setUserReply('');
        setReplyFeedback('Your reply has been posted to the support team.');
        fetchMyTickets();
      }
    } catch (err) {
      setReplyFeedback('Failed to post reply. Please try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>Open</span>;
      case 'IN_PROGRESS':
        return <span style={{ color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>In Progress</span>;
      case 'WAITING_FOR_USER':
        return <span style={{ color: '#c084fc', background: 'rgba(192, 132, 252, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>Staff Replied</span>;
      case 'RESOLVED':
        return <span style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>Resolved</span>;
      case 'CLOSED':
        return <span style={{ color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>Closed</span>;
      default:
        return <span>{status}</span>;
    }
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
        
        {/* Left: Support Ticket Management Panel */}
        <div className="ticket-form-panel">
          
          {/* Sub-tab Navigation if Authenticated */}
          {user && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
              <button
                type="button"
                onClick={() => { setActiveMode('new'); setSelectedTicket(null); }}
                style={{
                  background: activeMode === 'new' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: activeMode === 'new' ? '#a5b4fc' : '#94a3b8',
                  border: activeMode === 'new' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Submit New Ticket
              </button>
              <button
                type="button"
                onClick={() => { setActiveMode('my-tickets'); setSelectedTicket(null); }}
                style={{
                  background: activeMode === 'my-tickets' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: activeMode === 'my-tickets' ? '#a5b4fc' : '#94a3b8',
                  border: activeMode === 'my-tickets' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                My Tickets ({myTickets.length})
              </button>
            </div>
          )}

          {activeMode === 'new' ? (
            submitted ? (
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
                  <p>Fill in the details and our support team will respond via email and in your portal.</p>
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
            )
          ) : (
            /* MY TICKETS VIEW */
            <div>
              {selectedTicket ? (
                /* Ticket Thread View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: '#a5b4fc',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <ArrowLeft size={14} /> Back to My Tickets
                  </button>

                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#818cf8', fontWeight: 600 }}>
                        {selectedTicket.ticketId}
                      </span>
                      {getStatusBadge(selectedTicket.status)}
                    </div>
                    <h4 style={{ margin: '6px 0 2px 0', fontSize: '1rem', color: '#f8fafc' }}>
                      {selectedTicket.subject || 'Support Request'}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Category: {selectedTicket.category} • Priority: {selectedTicket.priority}
                    </span>
                  </div>

                  {replyFeedback && (
                    <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                      {replyFeedback}
                    </div>
                  )}

                  {/* Messages Stream */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                    {/* Initial message */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                        <span><strong>{selectedTicket.name}</strong> (Original Inquiry)</span>
                        <span>{new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                        {selectedTicket.message}
                      </p>
                    </div>

                    {/* Responses */}
                    {selectedTicket.responseHistory?.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          background: msg.senderType === 'admin' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)',
                          border: msg.senderType === 'admin' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '10px',
                          padding: '12px',
                          marginLeft: msg.senderType === 'admin' ? '12px' : 0
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: msg.senderType === 'admin' ? '#a5b4fc' : '#94a3b8', marginBottom: '6px' }}>
                          <span><strong>{msg.senderName}</strong> {msg.senderType === 'admin' ? '(Support Staff)' : ''}</span>
                          <span>{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                          {msg.message}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* User Reply Input */}
                  <form onSubmit={handleSendUserReply} style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <textarea
                      rows={2}
                      value={userReply}
                      onChange={(e) => setUserReply(e.target.value)}
                      placeholder="Add a reply to this ticket..."
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px',
                        padding: '10px',
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        resize: 'vertical'
                      }}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        disabled={sendingReply || !userReply.trim()}
                        style={{
                          background: '#6366f1',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Send size={13} /> {sendingReply ? 'Posting...' : 'Send Reply'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Ticket Listing */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc' }}>Your Ticket History</h4>
                    <button
                      type="button"
                      onClick={fetchMyTickets}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                    >
                      <RefreshCw size={12} className={loadingMyTickets ? 'spin-icon' : ''} /> Refresh
                    </button>
                  </div>

                  {loadingMyTickets ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                      Loading your tickets...
                    </div>
                  ) : myTickets.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      You haven't submitted any tickets yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {myTickets.map(t => (
                        <div
                          key={t.ticketId}
                          onClick={() => handleOpenThread(t.ticketId)}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '10px',
                            padding: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>
                              {t.ticketId}
                            </span>
                            {getStatusBadge(t.status)}
                          </div>
                          <div style={{ fontSize: '0.88rem', color: '#f1f5f9', fontWeight: 500, marginBottom: '4px' }}>
                            {t.subject || 'Support Request'}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                            <span>{t.category}</span>
                            <span>{new Date(t.updatedAt || t.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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
