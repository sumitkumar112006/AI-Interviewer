/**
 * Subscription Plans Constants
 * Price in minor currency units (paise for INR, e.g. 19900 = ₹199.00)
 */

const PLANS = {
  FREE: {
    planKey: 'free',
    name: 'Free',
    rank: 0,
    price: 0,
    priceMonthly: 0,
    priceYearly: 0,
    priceInRupees: 0,
    currency: 'INR',
    billingCycle: 'MONTHLY',
    generationLimit: 3,
    aiCreditsLimit: 20,
    features: [
      '3 AI Mock Interviews / month',
      '20 AI Credits',
      'Standard Feedback & Scoring',
      'Basic Resume Template',
      'Community Support'
    ],
    isPopular: false
  },
  PRO: {
    planKey: 'pro',
    name: 'Pro',
    rank: 1,
    price: 9900, // ₹99 in paise
    priceMonthly: 9900,
    priceYearly: 99000, // ₹990 / year (2 months discount)
    priceInRupees: 99,
    currency: 'INR',
    billingCycle: 'MONTHLY',
    generationLimit: 10,
    aiCreditsLimit: 50,
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
  PREMIUM: {
    planKey: 'premium',
    name: 'Premium',
    rank: 2,
    price: 19900, // ₹199 in paise
    priceMonthly: 19900,
    priceYearly: 199000, // ₹1990 / year (2 months discount)
    priceInRupees: 199,
    currency: 'INR',
    billingCycle: 'MONTHLY',
    generationLimit: 25,
    aiCreditsLimit: 100,
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
};

module.exports = {
  PLANS
};
