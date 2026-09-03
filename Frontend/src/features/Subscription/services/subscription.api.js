import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is not configured.');
} const cleanBaseUrl = API_BASE_URL.replace(/\/$/, "");

const api = axios.create({
  baseURL: cleanBaseUrl,
  withCredentials: true
});

/**
 * Fetch current user's subscription, plan tier, limits, and usage
 */
export async function getMySubscription() {
  const response = await api.get('/api/subscriptions/me');
  return response.data;
}

/**
 * Create an idempotent payment order on Razorpay
 */
export async function createPaymentOrder({ planKey, billingCycle = 'MONTHLY', idempotencyKey }) {
  const response = await api.post('/api/orders', {
    planKey,
    billingCycle,
    idempotencyKey
  });
  return response.data;
}

/**
 * Cryptographically verify payment on server and activate plan
 */
export async function verifyClientPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }) {
  const response = await api.post('/api/subscriptions/verify-client-payment', {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    orderId
  });
  return response.data;
}

/**
 * Fetch list of user's issued tax invoices
 */
export async function getMyInvoices() {
  const response = await api.get('/api/invoices');
  return response.data;
}

/**
 * Get direct URL for invoice printable/HTML view
 */
export function getInvoicePdfUrl(invoiceId) {
  return `${cleanBaseUrl}/api/invoices/${invoiceId}/pdf`;
}
