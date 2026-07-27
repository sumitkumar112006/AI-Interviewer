import React, { useState } from 'react';
import { Mail, MessageSquare, MapPin, Send, CheckCircle2, Clock } from 'lucide-react';
import '../footer.pages.scss';

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'General Inquiry',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      alert('Please fill out all required fields.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');

    try {
      const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || '734fa59f-467a-47f3-82bd-ad9851e2d3d9';

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          access_key: accessKey,
          name: formData.name,
          email: formData.email,
          subject: `[KIVI-AI Contact] ${formData.category} from ${formData.name}`,
          category: formData.category,
          message: formData.message,
          from_name: 'KIVI-AI Contact Form'
        })
      });

      const res = await response.json();

      if (res.success) {
        setSubmitted(true);
      } else {
        setErrorMessage(res.message || 'Something went wrong. Please try again later.');
      }
    } catch (err) {
      console.error('Web3Forms submission error:', err);
      setErrorMessage('Failed to send message. Please check your internet connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="footer-page-container">
      <div className="footer-page-banner">
        <div className="banner-icon-badge accent-teal">
          <MessageSquare size={32} />
        </div>
        <h1>Contact Us</h1>
        <p className="subtitle">
          Have questions, feedback, or need assistance? Our support team is here to help.
        </p>
      </div>

      <div className="contact-grid-container">
        {/* Left Column: Info Cards */}
        <div className="contact-info-column">
          <div className="info-card">
            <div className="card-icon">
              <Mail size={22} />
            </div>
            <div className="card-text">
              <h3>Email Support</h3>
              <p>Direct your inquiries or support requests to our team.</p>
              <a href="mailto:support@kivi.ai" className="info-link">support@kivi.ai</a>
            </div>
          </div>

          <div className="info-card">
            <div className="card-icon">
              <Clock size={22} />
            </div>
            <div className="card-text">
              <h3>Response Time</h3>
              <p>We typically respond to inquiries within 24 hours during business days.</p>
              <span className="info-badge">Mon – Fri (9 AM – 6 PM IST)</span>
            </div>
          </div>

          <div className="info-card">
            <div className="card-icon">
              <MapPin size={22} />
            </div>
            <div className="card-text">
              <h3>Headquarters</h3>
              <p>KIVI-AI Interview Intelligence Platform</p>
              <span className="location-text">New Delhi, India</span>
            </div>
          </div>
        </div>

        {/* Right Column: Contact Form */}
        <div className="contact-form-column">
          <div className="form-card">
            {submitted ? (
              <div className="success-thankyou-message">
                <CheckCircle2 size={48} className="success-icon" />
                <h2>Thank You for Reaching Out!</h2>
                <p>
                  We have received your message regarding <strong>{formData.category}</strong>. Our team will review it and get back to you at <strong>{formData.email}</strong> shortly.
                </p>
                <button
                  className="reset-btn"
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: '', email: '', category: 'General Inquiry', message: '' });
                  }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form-elements">
                <h2>Send Us a Message</h2>
                <p className="form-subtext">Fill in the details below and we'll get right back to you.</p>

                {errorMessage && (
                  <div className="form-error-alert" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                    {errorMessage}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="name">Full Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your name..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="category">Inquiry Category</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Feature Feedback">Feature Feedback</option>
                    <option value="Account & Billing">Account & Billing</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="message">Message *</label>
                  <textarea
                    id="message"
                    name="message"
                    rows="5"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="How can we help you?"
                    required
                  />
                </div>

                <button type="submit" className="send-message-btn" disabled={submitting}>
                  <Send size={18} />
                  <span>{submitting ? 'Sending Message...' : 'Send Message'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
