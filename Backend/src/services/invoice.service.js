const { Invoice, Counter } = require('../models/invoice.model');
const userModel = require('../models/user.model');
const { PLANS } = require('../constants/plans.constants');
const { computeInvoiceTotals } = require('./paymentLogic');

class InvoiceService {
  /**
   * Generates a sequential, gap-free invoice number per month
   * e.g., 'INV-202608-000001'
   * @param {Object} [session] Optional Mongo ClientSession
   */
  async getNextInvoiceNumber(session = null) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const counterId = `invoice-${yearMonth}`;

    const counterQuery = Counter.findByIdAndUpdate(
      counterId,
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    if (session) counterQuery.session(session);
    const counter = await counterQuery;

    const sequenceStr = String(counter.seq).padStart(6, '0');
    return `INV-${yearMonth}-${sequenceStr}`;
  }

  /**
   * Create an immutable Invoice document upon successful payment
   * @param {Object} params
   * @param {Object} params.order PaymentOrder document
   * @param {Object} params.payment Payment document
   * @param {Object} params.subscription Subscription document
   * @param {Object} [params.session] Mongo ClientSession for atomic transaction
   */
  async generateInvoice({ order, payment, subscription, session = null }) {
    // 1. Check if invoice already exists for this payment (idempotency guard)
    const existingQ = Invoice.findOne({ paymentId: payment._id });
    if (session) existingQ.session(session);
    const existing = await existingQ;
    if (existing) {
      return existing;
    }

    // 2. Fetch user snapshot at time of billing
    const userQ = userModel.findById(order.userId);
    if (session) userQ.session(session);
    const user = await userQ;

    const billTo = {
      name: user?.username || 'Valued Customer',
      email: user?.email || 'customer@example.com',
      address: 'India',
      taxId: ''
    };

    // 3. Plan details
    const planConfig = PLANS[order.planKey?.toUpperCase()] || {
      name: `${order.planKey} Plan`,
      price: order.amount
    };

    const invoiceNumber = await this.getNextInvoiceNumber(session);

    const items = [
      {
        description: `${planConfig.name} Plan — ${order.billingCycle === 'YEARLY' ? 'Annual' : 'Monthly'} Subscription`,
        quantity: 1,
        unitAmount: order.amount,
        amount: order.amount
      }
    ];

    const taxRate = 18; // 18% GST standard
    const taxAmount = Math.round(order.amount * (taxRate / (100 + taxRate))); // back-calculated
    const subtotal = order.amount - taxAmount; // net of inclusive GST
    const totalAmount = order.amount;

    const newInvoice = new Invoice({
      invoiceNumber,
      userId: order.userId,
      orderId: order._id,
      paymentId: payment._id,
      subscriptionId: subscription?._id,
      planId: order.planId,
      planKey: order.planKey,
      billingCycle: order.billingCycle || 'MONTHLY',
      billTo,
      items,
      subtotal,
      taxRate,
      taxAmount,
      discountAmount: 0,
      totalAmount,
      currency: order.currency || 'INR',
      status: 'PAID',
      issuedAt: new Date()
    });

    await newInvoice.save({ session });
    return newInvoice;
  }

  /**
   * Get user's invoice history (most recent first)
   */
  async getUserInvoices(userId) {
    return Invoice.find({ userId })
      .sort({ issuedAt: -1 })
      .lean();
  }

  /**
   * Get invoice by ID verifying user ownership
   */
  async getInvoiceById(invoiceId, userId, isAdmin = false) {
    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) {
      throw { status: 404, message: 'Invoice not found.' };
    }
    if (!isAdmin && invoice.userId.toString() !== userId.toString()) {
      throw { status: 403, message: 'Access denied to this invoice.' };
    }
    return invoice;
  }
}

module.exports = new InvoiceService();
