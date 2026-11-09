/**
 * Pure Payment Business Logic Functions
 * Isolated, deterministic functions for calculation, decision-making, and idempotency.
 */

/**
 * Compute the validated order amount in minor currency units (paise)
 * @param {Object} plan 
 * @param {string} billingCycle 'MONTHLY' | 'YEARLY'
 * @returns {number}
 */
function computeOrderAmount(plan, billingCycle = 'MONTHLY') {
  if (!plan || plan.isActive === false) {
    throw new Error('INVALID_PLAN');
  }

  const cycle = (billingCycle || 'MONTHLY').toUpperCase();
  if (cycle === 'YEARLY') {
    if (plan.priceYearly !== undefined && plan.priceYearly !== null) {
      return plan.priceYearly;
    }
    if (plan.priceMonthly !== undefined && plan.priceMonthly !== null) {
      return plan.priceMonthly * 10;
    }
    if (plan.price !== undefined && plan.price !== null) {
      return plan.price * 10;
    }
    throw new Error('INVALID_PLAN_PRICE');
  }

  if (plan.priceMonthly !== undefined && plan.priceMonthly !== null && plan.priceMonthly > 0) {
    return plan.priceMonthly;
  }

  if (plan.price !== undefined && plan.price !== null) {
    return plan.price;
  }

  if (plan.priceMonthly === 0) {
    return 0;
  }

  throw new Error('INVALID_PLAN_PRICE');
}

/**
 * Build a deterministic idempotency key collapsed within a time window
 * @param {string} userId 
 * @param {string} planId 
 * @param {string} billingCycle 
 * @param {number} [windowMs=60000] Time window bucket (e.g. 60s)
 * @returns {string}
 */
function buildIdempotencyKey(userId, planId, billingCycle = 'MONTHLY', windowMs = 60000) {
  const timeBucket = Math.floor(Date.now() / windowMs);
  return `order_${userId}_${planId}_${billingCycle}_${timeBucket}`;
}

/**
 * Determine action for an incoming webhook event
 * @param {Object} params
 * @param {boolean} params.webhookEventAlreadyExists
 * @param {Object|null} params.order
 * @param {string} params.eventType
 * @returns {'DUPLICATE' | 'UNKNOWN_ORDER' | 'IGNORE_SETTLED' | 'PROCESS_SUCCESS' | 'PROCESS_FAILURE' | 'IGNORE_UNSUPPORTED'}
 */
function decideWebhookAction({ webhookEventAlreadyExists, order, eventType }) {
  if (webhookEventAlreadyExists) {
    return 'DUPLICATE';
  }

  if (!order) {
    return 'UNKNOWN_ORDER';
  }

  if (order.status === 'PAID' && (eventType === 'payment.captured' || eventType === 'order.paid')) {
    return 'IGNORE_SETTLED';
  }

  if (eventType === 'payment.failed') {
    return 'PROCESS_FAILURE';
  }

  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    return 'PROCESS_SUCCESS';
  }

  if (eventType === 'refund.processed') {
    return 'PROCESS_REFUND';
  }

  return 'IGNORE_UNSUPPORTED';
}

/**
 * Compute invoice subtotal, tax, and total amount
 * @param {Array<{amount: number}>} items 
 * @param {number} [taxRate=0] Tax percentage e.g. 18
 * @param {number} [discountAmount=0] Discount in minor units
 * @returns {{subtotal: number, taxAmount: number, discountAmount: number, totalAmount: number}}
 */
function computeInvoiceTotals(items = [], taxRate = 0, discountAmount = 0) {
  if (!Number.isSafeInteger(discountAmount) || discountAmount < 0) {
    throw new Error('INVALID_DISCOUNT');
  }

  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const taxAmount = taxRate > 0 ? Math.round(subtotal * (taxRate / 100)) : 0;
  const totalAmount = subtotal - discountAmount + taxAmount;

  if (totalAmount < 0 || discountAmount > (subtotal + taxAmount)) {
    throw new Error('INVALID_TOTAL');
  }

  return {
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount
  };
}

/**
 * Decide refund status based on total vs refunded amounts
 * @param {number} totalAmount 
 * @param {number} refundedAmount 
 * @returns {'REFUNDED' | 'PARTIALLY_REFUNDED' | null}
 */
function decideRefundStatus(totalAmount, refundedAmount) {
  if (!refundedAmount || refundedAmount <= 0) {
    return null;
  }
  if (refundedAmount >= totalAmount) {
    return 'REFUNDED';
  }
  return 'PARTIALLY_REFUNDED';
}

/**
 * Check if a pending order has passed the expiration window
 * @param {Object} order 
 * @param {number} [windowMinutes=30] 
 * @returns {boolean}
 */
function isOrderExpired(order, windowMinutes = 30) {
  if (!order || order.status === 'PAID') {
    return false;
  }

  if (!['CREATED', 'PENDING'].includes(order.status)) {
    return false;
  }

  const createdAt = new Date(order.createdAt).getTime();
  const ageMs = Date.now() - createdAt;
  return ageMs > windowMinutes * 60000;
}

/**
 * Calculate coupon discount and validated final amount
 * @param {Object} coupon - Coupon document or POJO
 * @param {number} orderAmount - Original plan amount in minor units (paise)
 * @param {string} [planKey='pro'] - Subscription plan key ('pro' | 'premium')
 * @returns {{ discountAmount: number, finalAmount: number, originalAmount: number }}
 */
function calculateCouponDiscount(coupon, orderAmount, planKey = 'pro') {
  if (!coupon) {
    throw new Error('COUPON_REQUIRED');
  }

  if (coupon.isActive === false) {
    throw new Error('COUPON_INACTIVE');
  }

  if (!Number.isSafeInteger(orderAmount) || orderAmount <= 0) {
    throw new Error('INVALID_ORDER_AMOUNT');
  }

  const now = Date.now();

  // Validate start date
  if (coupon.startDate && new Date(coupon.startDate).getTime() > now) {
    throw new Error('COUPON_NOT_STARTED');
  }

  // Validate expiration date
  if (coupon.expirationDate && new Date(coupon.expirationDate).getTime() < now) {
    throw new Error('COUPON_EXPIRED');
  }

  // Validate eligible subscription plans
  if (Array.isArray(coupon.eligiblePlans) && coupon.eligiblePlans.length > 0) {
    const normalizedPlan = (planKey || '').trim().toLowerCase();
    const isEligible = coupon.eligiblePlans.some(p => String(p).trim().toLowerCase() === normalizedPlan);
    if (!isEligible) {
      throw new Error('COUPON_INELIGIBLE_FOR_PLAN');
    }
  }

  // Validate minimum order value
  const minOrder = Number(coupon.minOrderValue) || 0;
  if (orderAmount < minOrder) {
    throw new Error('MIN_ORDER_VALUE_NOT_MET');
  }

  // Validate global usage limit
  if (coupon.usageLimit && Number(coupon.usedCount) >= Number(coupon.usageLimit)) {
    throw new Error('COUPON_USAGE_LIMIT_EXCEEDED');
  }

  // Calculate gross discount
  let discount = 0;
  const discountType = (coupon.discountType || 'PERCENTAGE').toUpperCase();

  if (discountType === 'PERCENTAGE') {
    const pct = Math.max(0, Math.min(100, Number(coupon.discountValue) || 0));
    discount = Math.round(orderAmount * (pct / 100));
    if (coupon.maxDiscountAmount && Number(coupon.maxDiscountAmount) > 0) {
      discount = Math.min(discount, Number(coupon.maxDiscountAmount));
    }
  } else if (discountType === 'FIXED') {
    discount = Math.min(orderAmount, Math.max(0, Number(coupon.discountValue) || 0));
  } else {
    throw new Error('INVALID_DISCOUNT_TYPE');
  }

  // Razorpay requires minimum order amount of 100 paise (₹1.00)
  const MIN_GATEWAY_AMOUNT = 100;
  let finalAmount = orderAmount - discount;
  if (finalAmount < MIN_GATEWAY_AMOUNT) {
    finalAmount = Math.min(orderAmount, MIN_GATEWAY_AMOUNT);
    discount = orderAmount - finalAmount;
  }

  return {
    discountAmount: discount,
    finalAmount,
    originalAmount: orderAmount
  };
}

module.exports = {
  computeOrderAmount,
  buildIdempotencyKey,
  decideWebhookAction,
  computeInvoiceTotals,
  decideRefundStatus,
  isOrderExpired,
  calculateCouponDiscount
};
