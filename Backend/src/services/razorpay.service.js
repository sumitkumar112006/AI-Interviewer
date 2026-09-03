const crypto = require('crypto');
const axios = require('axios');

class RazorpayService {
  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    this.baseUrl = 'https://api.razorpay.com/v1';
  }

  getAuthHeader() {
    if (!this.keyId || !this.keySecret) {
      return null;
    }
    const token = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Create an order on Razorpay
   * @param {Object} params
   * @param {number} params.amount Amount in minor currency units (paise)
   * @param {string} params.currency e.g. 'INR'
   * @param {string} params.receipt Unique internal receipt/order ID
   * @param {Object} params.notes Additional metadata
   */
  async createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    // Fail closed if credentials are missing unless explicitly allowed in test/mock mode
    if (!this.keyId || !this.keySecret) {
      if (process.env.ALLOW_MOCK_PAYMENTS === 'true') {
        console.warn('⚠️ [RazorpayService] ALLOW_MOCK_PAYMENTS is enabled with missing credentials. Using simulated mock order ID.');
        return {
          id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          entity: 'order',
          amount,
          amount_paid: 0,
          amount_due: amount,
          currency,
          receipt,
          status: 'created',
          notes
        };
      }

      throw new Error('FATAL: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are missing.');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/orders`,
        {
          amount: Math.round(amount), // ensure integer paise
          currency,
          receipt,
          notes,
          payment_capture: 1
        },
        {
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      const rzpErr = error.response?.data?.error || error.message;
      console.error('❌ [RazorpayService] Error creating order on Razorpay:', rzpErr);
      throw new Error(`Razorpay Order Creation Failed: ${typeof rzpErr === 'string' ? rzpErr : (rzpErr.description || JSON.stringify(rzpErr))}`);
    }
  }

  /**
   * Fetch an order from Razorpay
   * @param {string} gatewayOrderId 
   */
  async fetchRazorpayOrder(gatewayOrderId) {
    if (!this.keyId || !this.keySecret) {
      if (process.env.ALLOW_MOCK_PAYMENTS === 'true') {
        return { id: gatewayOrderId, status: 'created', amount_paid: 0 };
      }
      throw new Error('FATAL: Razorpay credentials missing during order fetch.');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/orders/${gatewayOrderId}`, {
        headers: { Authorization: this.getAuthHeader() },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 400) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch payments for an order from Razorpay
   * @param {string} gatewayOrderId
   */
  async fetchOrderPayments(gatewayOrderId) {
    if (!this.keyId || !this.keySecret) {
      if (process.env.ALLOW_MOCK_PAYMENTS === 'true') {
        return { items: [] };
      }
      throw new Error('FATAL: Razorpay credentials missing during payment fetch.');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/orders/${gatewayOrderId}/payments`, {
        headers: { Authorization: this.getAuthHeader() },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('❌ [RazorpayService] Error fetching order payments:', error.message);
      throw new Error(`Razorpay Payment Fetch Failed: ${error.response?.data?.error?.description || error.message}`);
    }
  }

  /**
   * Verify Webhook Signature against raw payload
   * @param {Buffer|string} rawBody 
   * @param {string} signature Header 'x-razorpay-signature'
   * @param {string} customSecret Optional override
   */
  verifyWebhookSignature(rawBody, signature, customSecret = null) {
    const secret = customSecret || this.webhookSecret;
    if (!secret) {
      throw new Error('Razorpay webhook secret is not configured.');
    }
    if (!signature) {
      return false;
    }

    const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Verify Client Payment Signature (returned after frontend checkout popup)
   * @param {Object} params
   * @param {string} params.orderId razorpay_order_id
   * @param {string} params.paymentId razorpay_payment_id
   * @param {string} params.signature razorpay_signature
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    if (!this.keySecret) {
      console.warn('⚠️ [RazorpayService] RAZORPAY_KEY_SECRET missing during signature check.');
      return false;
    }
    if (!orderId || !paymentId || !signature) {
      return false;
    }

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch (e) {
      return false;
    }
  }
}

module.exports = new RazorpayService();
