import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateInterviewProgress } from '../services/interview.api';
import { CheckCircle, Lock, Play, Circle } from 'lucide-react';

const TechnicalRoadmapTab = ({ interviewId, preparationPlan, completedTasks: initialCompletedTasks, onUpdateReport }) => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(preparationPlan || []);
  const [completedTasks, setCompletedTasks] = useState(initialCompletedTasks || []);
  const [activeSubTab, setActiveSubTab] = useState('Roadmap'); // 'Roadmap' or 'My Progress'
  const [expandedNode, setExpandedNode] = useState(0); // Index of expanded day node

  useEffect(() => {
    setPlan(preparationPlan || []);
  }, [preparationPlan]);

  useEffect(() => {
    setCompletedTasks(initialCompletedTasks || []);
  }, [initialCompletedTasks]);

  const handleTaskToggle = async (taskText) => {
    let updatedCompleted = [...completedTasks];
    if (updatedCompleted.includes(taskText)) {
      updatedCompleted = updatedCompleted.filter(t => t !== taskText);
    } else {
      updatedCompleted.push(taskText);
    }

    // Optimistic UI update
    setCompletedTasks(updatedCompleted);

    try {
      const res = await updateInterviewProgress(interviewId, {
        completedTasks: updatedCompleted
      });

      if (res && res.interviewReport) {
        setCompletedTasks(res.interviewReport.completedTasks || []);
        onUpdateReport(res.interviewReport);
      }
    } catch (err) {
      console.error('Failed to update task progress:', err);
      // Revert optimistic update on failure
      setCompletedTasks(completedTasks);
      alert('Failed to update progress. Please check your connection.');
    }
  };

  // Helper to determine node status
  const getNodeStatus = (node, index) => {
    if (!node.tasks || node.tasks.length === 0) return 'Not Started';
    
    // Check if locked: locked if the previous day node is not fully completed
    if (index > 0) {
      const previousNode = plan[index - 1];
      const prevTasks = previousNode.tasks || [];
      const prevCompletedAll = prevTasks.length > 0 && prevTasks.every(t => completedTasks.includes(t));
      if (!prevCompletedAll) {
        return 'Locked';
      }
    }

    const nodeTasks = node.tasks;
    const completedCount = nodeTasks.filter(t => completedTasks.includes(t)).length;

    if (completedCount === nodeTasks.length) return 'Completed';
    if (completedCount > 0) return 'In Progress';
    return 'Not Started';
  };

  // Calculations for progress
  const totalTasks = plan.reduce((sum, node) => sum + (node.tasks?.length || 0), 0);
  const completedCount = completedTasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return (
    <div className="tab-layout roadmap-tab">
      <div className="premium-header-banner premium-header-banner--roadmap">
        <div className="header-text-content">
          <span className="back-link" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>← Back to Dashboard</span>
          <h1 className="banner-title banner-title--roadmap">Technical Roadmap</h1>
          <p className="banner-desc">
            A step-by-step roadmap to build your skills and become job-ready.
          </p>
        </div>
        <div className="header-visual-code-icon header-visual-code-icon--roadmap">
          <div className="roadmap-graphic-illustration">
            <div className="mountain-peak"></div>
            <div className="winding-path"></div>
            <div className="flag-node">🚩</div>
          </div>
        </div>
      </div>

      {/* Sub-tabs: Roadmap vs My Progress */}
      <div className="roadmap-sub-tabs-row">
        <div className="sub-tabs-segmented-control">
          <button
            className={`sub-tab-button ${activeSubTab === 'Roadmap' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('Roadmap')}
          >
            Roadmap
          </button>
          <button
            className={`sub-tab-button ${activeSubTab === 'My Progress' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('My Progress')}
          >
            My Progress
          </button>
        </div>
      </div>

      {activeSubTab === 'Roadmap' ? (
        <div className="roadmap-flow-container">
          <div className="timeline-connector-line"></div>

          {plan.map((node, idx) => {
            const status = getNodeStatus(node, idx);
            const isExpanded = expandedNode === idx;
            const isLocked = status === 'Locked';

            return (
              <div
                key={idx}
                className={`roadmap-node-card-wrapper status-${status.toLowerCase().replace(' ', '-')}`}
              >
                {/* Visual node circle */}
                <div
                  className={`roadmap-node-circle ${isExpanded ? 'active' : ''}`}
                  onClick={() => !isLocked && setExpandedNode(isExpanded ? null : idx)}
                >
                  {status === 'Completed' ? (
                    <span className="node-circle-icon check">✓</span>
                  ) : status === 'Locked' ? (
                    <span className="node-circle-icon lock">🔒</span>
                  ) : (
                    <span className="node-circle-number">{idx + 1}</span>
                  )}
                </div>

                {/* Node details card */}
                <div className={`roadmap-node-card ${isExpanded ? 'expanded' : ''} ${isLocked ? 'locked' : ''}`}>
                  <div
                    className="node-card-header"
                    onClick={() => !isLocked && setExpandedNode(isExpanded ? null : idx)}
                  >
                    <div className="node-card-info">
                      <span className="node-day-label">{node.day || `Day ${idx + 1}`}</span>
                      <h3 className="node-focus-title">{node.focus}</h3>
                      <p className="node-sub-label">Milestone objectives and practical exercises</p>
                    </div>

                    <div className="node-card-status-badge">
                      {status === 'Completed' && <span className="status-badge completed">Completed ✓</span>}
                      {status === 'In Progress' && <span className="status-badge in-progress">In Progress</span>}
                      {status === 'Not Started' && <span className="status-badge not-started">Not Started</span>}
                      {status === 'Locked' && <span className="status-badge locked">Locked 🔒</span>}
                    </div>
                  </div>

                  {isExpanded && !isLocked && (
                    <div className="node-card-tasks-list">
                      {node.tasks && node.tasks.length > 0 ? (
                        node.tasks.map((task, tIdx) => {
                          const isDone = completedTasks.includes(task);
                          return (
                            <label key={tIdx} className={`task-checkbox-item ${isDone ? 'checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => handleTaskToggle(task)}
                              />
                              <span className="custom-checkbox"></span>
                              <span className="task-text-content">{task}</span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="no-tasks-hint">No tasks assigned for this milestone.</p>
                      )}
                    </div>
                  )}

                  {isLocked && (
                    <div className="node-locked-message">
                      <Lock size={14} />
                      <span>Complete the tasks in previous days to unlock this milestone.</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="progress-summary-view-card">
          <h2>Your Preparation Progress</h2>
          <p>Track your completed milestones and check off remaining tasks daily.</p>

          <div className="progress-stats-box">
            <div className="circular-progress-indicator">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle-progress"
                  strokeDasharray={`${progressPercent}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" className="percentage">{progressPercent}%</text>
              </svg>
            </div>

            <div className="progress-text-stats">
              <div className="stat-row">
                <span className="stat-label">Total Preparation Tasks:</span>
                <span className="stat-val">{totalTasks}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Tasks Completed:</span>
                <span className="stat-val text-success">{completedCount}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Remaining Tasks:</span>
                <span className="stat-val text-pending">{totalTasks - completedCount}</span>
              </div>
            </div>
          </div>

          <div className="completed-tasks-breakdown">
            <h3>Completed Tasks List</h3>
            {completedCount > 0 ? (
              <ul className="completed-items-list">
                {completedTasks.map((task, idx) => (
                  <li key={idx} className="completed-item">
                    <CheckCircle className="check-icon" size={16} />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-tasks-hint">No completed tasks yet. Start checking them off in the Roadmap!</p>
            )}
          </div>
        </div>
      )}

      {/* Progress Footer Card */}
      <div className="roadmap-bottom-progress-card">
        <div className="progress-card-left">
          <div className="rocket-icon">🚀</div>
          <div className="progress-card-text">
            <h4>Consistency is the key!</h4>
            <p>Learn a little every day and track your progress to stay interview-ready.</p>
          </div>
        </div>
        <button
          className="view-progress-btn"
          onClick={() => setActiveSubTab(activeSubTab === 'Roadmap' ? 'My Progress' : 'Roadmap')}
        >
          {activeSubTab === 'Roadmap' ? 'View My Progress →' : 'Back to Roadmap ←'}
        </button>
      </div>
    </div>
  );
};

export default TechnicalRoadmapTab;
