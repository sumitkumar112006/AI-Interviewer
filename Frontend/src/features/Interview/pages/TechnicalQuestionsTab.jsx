import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateInterviewProgress } from '../services/interview.api';
import { Search, Filter } from 'lucide-react';

const TechnicalQuestionsTab = ({ interviewId, initialQuestions, onUpdateReport }) => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState(initialQuestions || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('All Topics');
  const [openIndex, setOpenIndex] = useState(null);
  const [responses, setResponses] = useState({});
  const [savingIndex, setSavingIndex] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState({});

  useEffect(() => {
    setQuestions(initialQuestions || []);
    // Initialize responses state
    const initialResponses = {};
    (initialQuestions || []).forEach((q, idx) => {
      initialResponses[idx] = q.userResponse || '';
    });
    setResponses(initialResponses);
  }, [initialQuestions]);

  // Determine categories dynamically from questions, plus standard ones
  const topics = ['All Topics', 'Databases', 'SQL', 'System Design'];

  const handleResponseChange = (index, value) => {
    setResponses(prev => ({ ...prev, [index]: value }));
  };

  const handleSaveResponse = async (index) => {
    setSavingIndex(index);
    try {
      const updatedQuestions = [...questions];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        userResponse: responses[index]
      };

      const res = await updateInterviewProgress(interviewId, {
        technicalQuestions: updatedQuestions
      });

      if (res && res.interviewReport) {
        setQuestions(res.interviewReport.technicalQuestions || []);
        onUpdateReport(res.interviewReport);
      }

      setSaveSuccess(prev => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setSaveSuccess(prev => ({ ...prev, [index]: false }));
      }, 2500);
    } catch (err) {
      console.error('Failed to save response:', err);
      alert('Failed to save response. Please try again.');
    } finally {
      setSavingIndex(null);
    }
  };

  // Simple categorization helper
  const matchesTopic = (q, topic) => {
    if (topic === 'All Topics') return true;
    const txt = (q.question + ' ' + q.intention + ' ' + q.answer).toLowerCase();
    if (topic === 'Databases') return txt.includes('database') || txt.includes('nosql') || txt.includes('index') || txt.includes('b-tree');
    if (topic === 'SQL') return txt.includes('sql') || txt.includes('join') || txt.includes('query') || txt.includes('having') || txt.includes('where');
    if (topic === 'System Design') return txt.includes('system design') || txt.includes('architecture') || txt.includes('load balance') || txt.includes('scale') || txt.includes('microservice');
    return true;
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && matchesTopic(q, activeTopic);
  });

  // Topics counts helper
  const getTopicCount = (topic) => {
    return questions.filter(q => matchesTopic(q, topic)).length;
  };

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="tab-layout technical-questions-tab">
      <div className="premium-header-banner">
        <div className="header-text-content">
          <span className="back-link" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>← Back to Dashboard</span>
          <h1 className="banner-title">Technical Questions</h1>
          <p className="banner-desc">
            Ace the technical round with curated questions and detailed answers.
          </p>
        </div>
        <div className="header-visual-code-icon">
          <div className="code-icon-glow">
            <span className="code-icon-tag">&lt;/&gt;</span>
          </div>
        </div>
      </div>

      <div className="filter-controls-row">
        <div className="topic-pills-list">
          {topics.map(topic => {
            const count = getTopicCount(topic);
            const isActive = activeTopic === topic;
            return (
              <button
                key={topic}
                className={`topic-pill ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTopic(topic)}
              >
                {topic} <span className="pill-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="search-filter-actions">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search a question..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="icon-filter-btn" title="Filter options">
            <Filter size={16} />
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="questions-accordion-list">
        {filteredQuestions.map((q, idx) => {
          // Find original index to align state responses correctly
          const originalIndex = questions.findIndex(origQ => origQ.question === q.question);
          const isOpen = openIndex === originalIndex;

          return (
            <div key={idx} className={`accordion-item-card ${isOpen ? 'open' : ''}`}>
              <button
                className="accordion-header-row"
                onClick={() => toggleAccordion(originalIndex)}
                aria-expanded={isOpen}
              >
                <div className="accordion-header-left">
                  <span className="index-circle">{idx + 1}</span>
                  <span className="question-title-text">{q.question}</span>
                </div>
                <span className="accordion-plus-icon">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen && (
                <div className="accordion-content-body">
                  <div className="response-detail-section">
                    <h4 className="detail-section-title">Intention</h4>
                    <p className="detail-section-body intention">{q.intention}</p>
                  </div>

                  <div className="response-detail-section">
                    <h4 className="detail-section-title">Suggested Answer</h4>
                    <p className="detail-section-body suggested-answer">{q.answer}</p>
                  </div>

                  <div className="response-detail-section user-response-section">
                    <h4 className="detail-section-title">Your Practice Answer</h4>
                    <textarea
                      className="user-response-textarea"
                      placeholder="Draft your response here using structural frameworks (STAR, etc.)..."
                      value={responses[originalIndex] || ''}
                      onChange={(e) => handleResponseChange(originalIndex, e.target.value)}
                    />
                    <div className="response-actions-bar">
                      <button
                        className="save-response-button"
                        onClick={() => handleSaveResponse(originalIndex)}
                        disabled={savingIndex === originalIndex}
                      >
                        {savingIndex === originalIndex ? 'Saving...' : 'Save Answer'}
                      </button>
                      {saveSuccess[originalIndex] && (
                        <span className="save-success-indicator">Saved ✓</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredQuestions.length === 0 && (
          <div className="empty-results-card">
            <h3>No questions found</h3>
            <p>Try searching for a different keyword or topic filter.</p>
          </div>
        )}
      </div>

      <div className="bottom-banner-tip">
        <div className="tip-icon">💡</div>
        <div className="tip-text">
          <strong>Exam Tip:</strong> Read questions carefully, structure your answer, and use examples whenever possible.
        </div>
      </div>
    </div>
  );
};

export default TechnicalQuestionsTab;
