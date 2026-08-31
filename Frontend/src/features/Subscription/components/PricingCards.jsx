import React, { useState } from 'react';
import { useAuth } from '../../Auth/hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';

const PLANS_CONFIG = [
  {
    planKey: 'free',
    name: 'Free',
    desc: 'Perfect for getting started and trying out AI mock interviews.',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      '3 AI Mock Interviews / month',
      '20 AI Credits',
      'Standard Feedback & Scoring',
      'Basic Resume Template',
      'Community Support'
    ],
    isPopular: false
  },
  {
    planKey: 'pro',
    name: 'Pro',
    desc: 'Best for active job seekers looking for targeted interview prep.',
    priceMonthly: 199,
    priceYearly: 1990, // 2 months free
    features: [
      '10 AI Mock Interviews / month',
      '50 AI Credits',
      'In-depth Detailed Feedback & Analysis',
      'ATS Resume Builder & Live Editor',
      'AI Cover Letter Generator',
      'Priority Audio & Question Generation',
      'Email Support'
    ],
    isPopular: true
  },
  {
    planKey: 'premium',
    name: 'Premium',
    desc: 'Full power for power candidates, career switchers & deep practice.',
    priceMonthly: 349,
    priceYearly: 3490, // 2 months free
    features: [
      '25 AI Mock Interviews / month',
      '100 AI Credits',
      'All Pro Features Included',
      'Full Behavioral & Technical Deep Dives',
      'Company & Role Tailored Questions',
      'Downloadable PDF Tax Invoices & Reports',
      '24/7 Priority Support'
    ],
    isPopular: false
  }
];

export const PricingCards = ({ onUpgradeSuccess }) => {
  const { user } = useAuth();
  const { subscriptionData, checkoutLoading, initiateCheckout } = useSubscription();
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [successModal, setSuccessModal] = useState(null);
  const [activePlanKeyProcessing, setActivePlanKeyProcessing] = useState(null);

  const currentPlan = subscriptionData?.plan || user?.plan || 'free';

  const handleSelectPlan = (planKey) => {
    if (planKey === 'free' || planKey === currentPlan) return;

    setActivePlanKeyProcessing(planKey);
    initiateCheckout({
      planKey,
      billingCycle,
      user: {
        username: user?.username || '',
        email: user?.email || ''
      },
      onSuccess: (data) => {
        setActivePlanKeyProcessing(null);
        setSuccessModal({
          plan: planKey,
          invoiceNumber: data?.invoiceNumber
        });
        if (onUpgradeSuccess) onUpgradeSuccess(data);
      },
      onFailure: (errMsg) => {
        setActivePlanKeyProcessing(null);
        console.warn('Checkout cancelled or failed:', errMsg);
      }
    });
  };

  return (
    <>
      {/* Billing Cycle Toggle */}
      <div className="billing-toggle-wrapper">
        <span
          className={billingCycle === 'MONTHLY' ? 'active' : ''}
          onClick={() => setBillingCycle('MONTHLY')}
        >
          Monthly
        </span>
        <div
          className={`toggle-switch ${billingCycle === 'YEARLY' ? 'yearly' : ''}`}
          onClick={() => setBillingCycle(billingCycle === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
          role="button"
          tabIndex={0}
        >
          <div className="switch-thumb" />
        </div>
        <span
          className={billingCycle === 'YEARLY' ? 'active' : ''}
          onClick={() => setBillingCycle('YEARLY')}
        >
          Yearly
        </span>
        <span className="discount-pill">2 Months Free 🎉</span>
      </div>

      {/* Pricing Cards Grid */}
      <div className="pricing-grid" style={{ marginTop: '36px' }}>
        {PLANS_CONFIG.map((plan) => {
          const isCurrent = currentPlan.toLowerCase() === plan.planKey;
          const displayPrice = billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
          const isProcessing = checkoutLoading && activePlanKeyProcessing === plan.planKey;

          return (
            <div
              key={plan.planKey}
              className={`pricing-card ${plan.isPopular ? 'popular' : ''} ${isCurrent ? 'current-active' : ''}`}
            >
              {plan.isPopular && <div className="popular-badge">Most Popular</div>}

              <div>
                <div className="card-header">
                  <h3 className="card-plan-name">{plan.name}</h3>
                  <p className="card-plan-desc">{plan.desc}</p>
                </div>

                <div className="card-price-section">
                  <div className="price-row">
                    <span className="currency-sym">₹</span>
                    <span className="price-digits">{displayPrice}</span>
                    <span className="price-period">
                      /{billingCycle === 'YEARLY' ? 'year' : 'month'}
                    </span>
                  </div>
                  {billingCycle === 'YEARLY' && plan.priceMonthly > 0 && (
                    <div className="yearly-billed-note">
                      Save ₹{(plan.priceMonthly * 12) - plan.priceYearly} per year
                    </div>
                  )}
                </div>

                <ul className="features-list">
                  {plan.features.map((feat, idx) => (
                    <li key={idx}>
                      <svg
                        className="check-icon"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                {isCurrent ? (
                  <button type="button" className="plan-action-btn btn-current" disabled>
                    ✓ Current Active Plan
                  </button>
                ) : plan.planKey === 'free' ? (
                  <button type="button" className="plan-action-btn btn-secondary" disabled>
                    Included Free
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`plan-action-btn ${plan.isPopular ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleSelectPlan(plan.planKey)}
                    disabled={checkoutLoading}
                  >
                    {isProcessing ? (
                      <>
                        <span className="spinner-mini" /> Opening Checkout...
                      </>
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Success Modal */}
      {successModal && (
        <div className="success-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #6366f1',
            borderRadius: '20px',
            padding: '36px',
            maxWidth: '440px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', margin: '0 0 10px' }}>
              Welcome to {successModal.plan.toUpperCase()}!
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.5, margin: '0 0 24px' }}>
              Your subscription has been successfully activated. Your new interview & AI credit limits are live immediately.
            </p>
            {successModal.invoiceNumber && (
              <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '24px' }}>
                Invoice No: <strong>{successModal.invoiceNumber}</strong>
              </p>
            )}
            <button
              type="button"
              onClick={() => setSuccessModal(null)}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              Start Practicing Now →
            </button>
          </div>
        </div>
      )}
    </>
  );
};
