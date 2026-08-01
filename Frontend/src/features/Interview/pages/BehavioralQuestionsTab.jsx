import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateInterviewProgress } from '../services/interview.api';
import { Search, Filter } from 'lucide-react';

const BehavioralQuestionsTab = ({ interviewId, initialQuestions, onUpdateReport }) => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState(initialQuestions || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Questions');
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

  const categories = ['All Questions', 'Teamwork', 'Leadership', 'Problem Solving'];

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
        behavioralQuestion: updatedQuestions
      });

      if (res && res.interviewReport) {
        setQuestions(res.interviewReport.behavioralQuestion || []);
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
  const matchesCategory = (q, category) => {
    if (category === 'All Questions') return true;
    const txt = (q.question + ' ' + q.intention + ' ' + q.answer).toLowerCase();
    if (category === 'Teamwork') return txt.includes('team') || txt.includes('collaborate') || txt.includes('conflict') || txt.includes('group') || txt.includes('peer');
    if (category === 'Leadership') return txt.includes('lead') || txt.includes('prioritize') || txt.includes('initiative') || txt.includes('decide') || txt.includes('responsibility');
    if (category === 'Problem Solving') return txt.includes('challenge') || txt.includes('solve') || txt.includes('bug') || txt.includes('fail') || txt.includes('feedback') || txt.includes('learn');
    return true;
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && matchesCategory(q, activeCategory);
  });

  const getCategoryCount = (category) => {
    return questions.filter(q => matchesCategory(q, category)).length;
  };

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Static key points badges for behavioral focus
  const keyPoints = ['Education', 'Skills', 'Experience', 'Goals'];

  return (
    <div className="tab-layout behavioral-questions-tab">
      <div className="premium-header-banner premium-header-banner--behavioral">
        <div className="header-text-content">
          <span className="back-link" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>← Back to Dashboard</span>
          <h1 className="banner-title banner-title--behavioral">Behavioral Questions</h1>
          <p className="banner-desc">
            Practice behavioral questions to communicate your experience and mindset effectively.
          </p>
        </div>
        <div className="header-visual-code-icon header-visual-code-icon--behavioral">
          <div className="behavioral-graphic-wrapper">
            <div className="avatar avatar-1"></div>
            <div className="avatar avatar-2"></div>
            <div className="chat-bubble-icon">💬</div>
          </div>
        </div>
      </div>

      <div className="filter-controls-row">
        <div className="topic-pills-list">
          {categories.map(cat => {
            const count = getCategoryCount(cat);
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                className={`topic-pill topic-pill--behavioral ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat} <span className="pill-count">{count}</span>
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
          const originalIndex = questions.findIndex(origQ => origQ.question === q.question);
          const isOpen = openIndex === originalIndex;

          return (
            <div key={idx} className={`accordion-item-card accordion-item-card--behavioral ${isOpen ? 'open' : ''}`}>
              <button
                className="accordion-header-row"
                onClick={() => toggleAccordion(originalIndex)}
                aria-expanded={isOpen}
              >
                <div className="accordion-header-left">
                  <span className="index-circle index-circle--behavioral">{idx + 1}</span>
                  <span className="question-title-text">{q.question}</span>
                </div>
                <span className="accordion-plus-icon">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen && (
                <div className="accordion-content-body">
                  <div className="response-detail-section">
                    <h4 className="detail-section-title">Suggested Answer</h4>
                    <p className="detail-section-body suggested-answer">{q.answer}</p>
                  </div>

                  <div className="response-detail-section">
                    <h4 className="detail-section-title">Key Points</h4>
                    <div className="key-points-badges-row">
                      {keyPoints.map(point => (
                        <span key={point} className={`key-point-badge badge-${point.toLowerCase()}`}>
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="response-detail-section user-response-section">
                    <h4 className="detail-section-title">Your Practice Answer</h4>
                    <textarea
                      className="user-response-textarea"
                      placeholder="Draft your answer. Try using the STAR method: Situation, Task, Action, Result..."
                      value={responses[originalIndex] || ''}
                      onChange={(e) => handleResponseChange(originalIndex, e.target.value)}
                    />
                    <div className="response-actions-bar">
                      <button
                        className="save-response-button save-response-button--behavioral"
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
            <p>Try searching for a different keyword or category filter.</p>
          </div>
        )}
      </div>

      <div className="bottom-banner-tip bottom-banner-tip--behavioral">
        <div className="tip-icon tip-icon--behavioral">⚙️</div>
        <div className="tip-text">
          <strong>Pro Tip:</strong> Use the STAR method (Situation, Task, Action, Result) to structure your answers for maximum impact.
        </div>
      </div>
    </div>
  );
};

export default BehavioralQuestionsTab;
