import React from 'react';
import { PricingCards } from '../components/PricingCards';
import { InvoicesTable } from '../components/InvoicesTable';
import { useSubscription } from '../hooks/useSubscription';
import PageLoading from '../../Shared/components/PageLoading';
import '../style/pricing.scss';

export const PricingPage = () => {
  const { subscriptionData, loading, fetchSubscription } = useSubscription();

  if (loading && !subscriptionData) {
    return <PageLoading message="Loading subscription plans..." />;
  }

  const usage = subscriptionData?.usage || {};
  const currentPlan = subscriptionData?.plan || 'free';
  const planDetails = subscriptionData?.planDetails || {};

  return (
    <div className="pricing-page-container">
      {/* Page Header */}
      <div className="pricing-header">
        <div className="pricing-badge">
          <span>✨ Simple & Transparent Pricing</span>
        </div>
        <h1>Elevate Your Interview Performance</h1>
        <p>
          Practice with AI interviewers tailored to top tech stacks, generate ATS-optimized resumes, and receive actionable scoring.
        </p>

        {/* Pricing Cards with Toggle */}
        <PricingCards onUpgradeSuccess={() => fetchSubscription()} />
      </div>

      {/* Current Active Plan & Usage Banner */}
      <div className="current-usage-banner">
        <div className="usage-meta">
          <div className={`plan-chip chip-${currentPlan}`}>
            {currentPlan} plan
          </div>
          <div className="usage-text">
            <h4>Your Active Plan: {planDetails.name || currentPlan.toUpperCase()}</h4>
            <p>
              {subscriptionData?.subscription?.currentPeriodEnd
                ? `Renews on ${new Date(subscriptionData.subscription.currentPeriodEnd).toLocaleDateString('en-IN')}`
                : 'Free tier access'}
            </p>
          </div>
        </div>

        <div className="usage-stats-group">
          <div className="stat-item">
            <div className="stat-label">Interviews Used</div>
            <div className="stat-val">
              {usage.interviewsUsed || 0} / {usage.interviewsLimit || 3}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">AI Credits Left</div>
            <div className="stat-val" style={{ color: '#818cf8' }}>
              {Math.max(0, (usage.aiCreditsLimit || 20) - (usage.aiCreditsUsed || 0) + (usage.aiBonusCredits || 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <InvoicesTable />
    </div>
  );
};

export default PricingPage;
