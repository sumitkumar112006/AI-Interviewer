import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../features/Auth/hooks/useAuth';
import { getUserUsage } from '../features/Auth/services/auth.api';
import { Sparkles, Zap, Bot, Check, X, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './userCreditsPopup.scss';

/**
 * UserCreditsPopup
 * Displays user's live credit balance on login.
 * Renders in Welcome Mode for first-time registrations / initial logins.
 */
const UserCreditsPopup = () => {
    const { user, usage: contextUsage, setUsage: setContextUsage } = useAuth();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [isWelcomeMode, setIsWelcomeMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [creditsData, setCreditsData] = useState(null);
    const hasInitializedRef = useRef(false);

    const userId = user?.id || user?._id;

    // Fetch live usage credits directly from backend API
    const fetchLiveCredits = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const data = await getUserUsage();
            if (data) {
                setCreditsData(data);
                if (setContextUsage) {
                    setContextUsage(data);
                }
            }
        } catch (err) {
            console.error('[CREDITS POPUP] Error fetching live usage:', err);
            if (contextUsage) {
                setCreditsData(contextUsage);
            }
        } finally {
            setLoading(false);
        }
    }, [userId, contextUsage, setContextUsage]);

    // Check login & first-time conditions on user session initialization
    useEffect(() => {
        if (!userId) {
            setIsOpen(false);
            hasInitializedRef.current = false;
            return;
        }

        const welcomeSeenKey = `kivi_user_welcomed_${userId}`;
        const hasBeenWelcomed = localStorage.getItem(welcomeSeenKey) === 'true';
        const justRegistered = sessionStorage.getItem('kivi_just_registered') === 'true';
        const shouldShowOnLogin = sessionStorage.getItem('kivi_show_credits_popup') === 'true';
        const sessionKey = `kivi_credits_popup_shown_session_${userId}`;
        const sessionAlreadyShown = sessionStorage.getItem(sessionKey) === 'true';

        // Check conditions
        if (!hasInitializedRef.current || shouldShowOnLogin) {
            hasInitializedRef.current = true;

            // 1. Welcome Mode (first-time registration OR user never welcomed before)
            if (justRegistered || !hasBeenWelcomed) {
                setIsWelcomeMode(true);
                setIsOpen(true);
                fetchLiveCredits();
                sessionStorage.removeItem('kivi_just_registered');
                sessionStorage.removeItem('kivi_show_credits_popup');
                sessionStorage.setItem(sessionKey, 'true');
            } 
            // 2. Login Mode (just logged in, or first time this session)
            else if (shouldShowOnLogin || !sessionAlreadyShown) {
                setIsWelcomeMode(false);
                setIsOpen(true);
                fetchLiveCredits();
                sessionStorage.removeItem('kivi_show_credits_popup');
                sessionStorage.setItem(sessionKey, 'true');
            }
        }

        // Listen for custom manual trigger (e.g. clicking topbar attempts badge)
        const handleManualOpen = () => {
            setIsWelcomeMode(false);
            setIsOpen(true);
            fetchLiveCredits();
        };

        window.addEventListener('kivi:open-credits-popup', handleManualOpen);
        return () => {
            window.removeEventListener('kivi:open-credits-popup', handleManualOpen);
        };
    }, [userId, fetchLiveCredits]);

    const handleClose = () => {
        if (userId) {
            sessionStorage.setItem(`kivi_credits_popup_shown_session_${userId}`, 'true');
            localStorage.setItem(`kivi_user_welcomed_${userId}`, 'true');
        }
        setIsOpen(false);
    };

    const handlePrimaryAction = () => {
        handleClose();
        if (isWelcomeMode) {
            navigate('/');
        }
    };

    if (!isOpen || !userId) return null;

    const userPlan = (creditsData?.userPlan || user?.plan || 'free').toUpperCase();
    const fullGens = creditsData?.fullGenerations || contextUsage?.fullGenerations || { limit: 100, remaining: 100, used: 0 };
    const aiAssist = creditsData?.aiAssistant || contextUsage?.aiAssistant || { limit: 500, remaining: 500, used: 0 };

    const genPercentage = Math.max(0, Math.min(100, Math.round((fullGens.remaining / (fullGens.limit || 1)) * 100)));
    const aiPercentage = Math.max(0, Math.min(100, Math.round((aiAssist.remaining / (aiAssist.limit || 1)) * 100)));

    return (
        <div className="credits-popup-overlay" onClick={handleClose}>
            <div 
                className={`credits-popup-card ${isWelcomeMode ? 'welcome-mode' : ''}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="credits-popup-title"
            >
                {/* Close Button */}
                <button
                    type="button"
                    className="popup-close-btn"
                    onClick={handleClose}
                    title="Close dialog"
                    aria-label="Close dialog"
                >
                    <X size={15} />
                </button>

                {/* Header Section */}
                <div className={`popup-header-section ${isWelcomeMode ? 'welcome-header-bg' : ''}`}>
                    <div className={`header-icon-glow ${isWelcomeMode ? 'welcome-glow' : ''}`}>
                        {isWelcomeMode ? <Sparkles size={28} /> : <Zap size={28} />}
                    </div>

                    {isWelcomeMode ? (
                        <div className="welcome-pill-badge">
                            <Sparkles size={12} />
                            <span>Account Activated · Starter Pack</span>
                        </div>
                    ) : (
                        <div className="plan-pill-badge">
                            <ShieldCheck size={12} />
                            <span>{userPlan} Tier Active</span>
                        </div>
                    )}

                    <h2 id="credits-popup-title">
                        {isWelcomeMode
                            ? `Welcome to KIVI-AI, ${user?.username || 'Candidate'}!`
                            : `Welcome Back, ${user?.username || 'Candidate'}!`}
                    </h2>

                    <p>
                        {isWelcomeMode
                            ? 'Your new account has been credited with complimentary generation & AI credits.'
                            : 'Here is your current active balance for resume generations and AI assistance.'}
                    </p>
                </div>

                {/* Loading State or Body Content */}
                {loading && !creditsData && !contextUsage ? (
                    <div className="popup-loading-shimmer">
                        <div className="loading-spinner-ring" />
                        <p>Fetching your live account credits...</p>
                    </div>
                ) : (
                    <div className="popup-body-content">
                        {/* Credits Balance Grid */}
                        <div className="credits-grid">
                            {/* Card 1: Resume & Cover Letter Generations */}
                            <div className="credit-box-card">
                                <div className="card-top-row">
                                    <span className="card-type-title">
                                        <Zap size={14} />
                                        Full Generations
                                    </span>
                                    <span className="reset-badge">Monthly</span>
                                </div>

                                <div className="card-numbers">
                                    <span className="count-remaining highlight-gens">
                                        {fullGens.remaining ?? 100}
                                    </span>
                                    <span className="count-total">/ {fullGens.limit ?? 100} left</span>
                                </div>

                                <div className="progress-bar-wrapper">
                                    <div 
                                        className="progress-bar-fill gens-gradient" 
                                        style={{ width: `${genPercentage}%` }}
                                    />
                                </div>

                                <span className="card-status-note">
                                    Resumes, CVs & Cover Letters
                                </span>
                            </div>

                            {/* Card 2: AI Assistant Queries */}
                            <div className="credit-box-card">
                                <div className="card-top-row">
                                    <span className="card-type-title">
                                        <Bot size={14} />
                                        AI Assistant
                                    </span>
                                    <span className="reset-badge">Daily 24h</span>
                                </div>

                                <div className="card-numbers">
                                    <span className="count-remaining highlight-ai">
                                        {aiAssist.remaining ?? 500}
                                    </span>
                                    <span className="count-total">/ {aiAssist.limit ?? 500} left</span>
                                </div>

                                <div className="progress-bar-wrapper">
                                    <div 
                                        className="progress-bar-fill ai-gradient" 
                                        style={{ width: `${aiPercentage}%` }}
                                    />
                                </div>

                                <span className="card-status-note">
                                    Copilot Q&A, Rewrites & Tips
                                </span>
                            </div>
                        </div>

                        {/* First-time Welcome Perks List */}
                        {isWelcomeMode && (
                            <div className="welcome-perks-box">
                                <span className="perks-header">Included in Your {userPlan} Starter Pack:</span>
                                <div className="perks-list">
                                    <div className="perk-item">
                                        <Check size={14} className="perk-check" />
                                        <span>ATS-Optimized Resumes</span>
                                    </div>
                                    <div className="perk-item">
                                        <Check size={14} className="perk-check" />
                                        <span>AI Mock Interview Prep</span>
                                    </div>
                                    <div className="perk-item">
                                        <Check size={14} className="perk-check" />
                                        <span>Tailored Cover Letters</span>
                                    </div>
                                    <div className="perk-item">
                                        <Check size={14} className="perk-check" />
                                        <span>24/7 AI Career Assistant</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="popup-actions-row">
                            <button
                                type="button"
                                className="btn-primary-action"
                                onClick={handlePrimaryAction}
                            >
                                <span>{isWelcomeMode ? "Get Started — Build First Resume" : "Continue to Dashboard"}</span>
                                <ArrowRight size={15} />
                            </button>

                            <div className="action-sub-links">
                                <Link 
                                    to="/pricing" 
                                    className="text-link"
                                    onClick={handleClose}
                                >
                                    Upgrade Tier
                                </Link>
                                <Link 
                                    to="/profile" 
                                    className="text-link"
                                    onClick={handleClose}
                                >
                                    View Account & Billing
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserCreditsPopup;
