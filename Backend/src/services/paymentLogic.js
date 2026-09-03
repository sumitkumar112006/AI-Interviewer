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

module.exports = {
  computeOrderAmount,
  buildIdempotencyKey,
  decideWebhookAction,
  computeInvoiceTotals,
  decideRefundStatus,
  isOrderExpired
};
