const mongoose = require('mongoose');
const { Schema } = mongoose;

// ---------------------------------------------------------------------
// Line item — embedded, not a separate collection: items belong to
// exactly one invoice and are never queried independently.
// ---------------------------------------------------------------------
const invoiceItemSchema = new Schema({
  description: { type: String, required: true },   // e.g. "Pro Plan — Monthly"
  quantity: { type: Number, required: true, default: 1 },
  unitAmount: { type: Number, required: true },     // minor currency units
  amount: { type: Number, required: true },         // unitAmount * quantity
}, { _id: false });

// ---------------------------------------------------------------------
// Invoice — generated once a payment succeeds. Treated as an immutable
// financial record after issuance: never edited in place, only voided.
// ---------------------------------------------------------------------
const invoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true }, // e.g. 'INV-202608-000123'

  userId: { type: Schema.Types.ObjectId, ref: 'users', required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'PaymentOrder', required: true },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true }, // one invoice per payment
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'subscriptions' },
  planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
  planKey: { type: String, enum: ['free', 'pro', 'premium'] },
  billingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },

  // Snapshot of billing details AT THE TIME of issue — never re-read from the
  // live user profile later, or the invoice would silently rewrite itself if
  // the user later edits their name/address.
  billTo: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: String,
    taxId: String, // GSTIN / VAT number, if applicable
  },

  items: { type: [invoiceItemSchema], required: true },

  subtotal: { type: Number, required: true },     // minor units, sum of item amounts
  taxRate: Number,                                 // e.g. 18 for 18% GST
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },   // subtotal - discountAmount + taxAmount
  currency: { type: String, required: true, default: 'INR' },

  status: {
    type: String,
    enum: ['ISSUED', 'PAID', 'VOID'],
    default: 'ISSUED',
    index: true,
  },

  pdfUrl: String,          // link to the generated PDF in object storage
  issuedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

// "my invoices" listing, most recent first
invoiceSchema.index({ userId: 1, issuedAt: -1 });

// ---------------------------------------------------------------------
// Counter — Mongo has no native auto-increment, so invoiceNumber needs an
// atomically-incremented sequence. One counter document per series
// (e.g. per year/month) keeps numbers gap-free and human-readable.
// ---------------------------------------------------------------------
const counterSchema = new Schema({
  _id: { type: String, required: true }, // e.g. 'invoice-202608'
  seq: { type: Number, default: 0 },
});

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

module.exports = {
  Invoice,
  Counter,
};
