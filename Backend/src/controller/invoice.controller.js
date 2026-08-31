const invoiceService = require('../services/invoice.service');

class InvoiceController {
  /**
   * GET /api/invoices
   * Get authenticated user's invoice history
   */
  async getMyInvoices(req, res, next) {
    try {
      const userId = req.user.id;
      const invoices = await invoiceService.getUserInvoices(userId);

      return res.status(200).json({
        success: true,
        data: invoices
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/invoices/:id
   * Get single invoice details
   */
  async getInvoiceById(req, res, next) {
    try {
      const invoiceId = req.params.id;
      const userId = req.user.id;
      const isAdmin = req.user.isAdmin;

      const invoice = await invoiceService.getInvoiceById(invoiceId, userId, isAdmin);

      return res.status(200).json({
        success: true,
        data: invoice
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/invoices/:id/pdf
   * Render or stream printable HTML/PDF invoice
   */
  async getInvoiceHtmlOrPdf(req, res, next) {
    try {
      const invoiceId = req.params.id;
      const userId = req.user.id;
      const isAdmin = req.user.isAdmin;

      const invoice = await invoiceService.getInvoiceById(invoiceId, userId, isAdmin);

      // Return structured printable HTML view
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice #${invoice.invoiceNumber}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 40px; background: #fff; }
    .invoice-card { max-width: 700px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 24px; }
    .brand { font-size: 24px; font-weight: 800; color: #4f46e5; }
    .inv-title { font-size: 20px; font-weight: 700; color: #334155; text-align: right; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .meta-box h4 { margin: 0 0 6px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-box p { margin: 2px 0; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f8fafc; text-align: left; padding: 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #e2e8f0; }
    td { padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .total-section { display: flex; justify-content: flex-end; margin-top: 16px; }
    .total-box { width: 260px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .grand-total { font-size: 18px; font-weight: 800; color: #4f46e5; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 6px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #15803d; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 36px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand">AI Interviewer</div>
        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Career Intelligence & Prep Platform</p>
      </div>
      <div>
        <div class="inv-title">TAX INVOICE</div>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; text-align: right;">${invoice.invoiceNumber}</p>
        <div style="text-align: right; margin-top: 6px;"><span class="badge">PAID</span></div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h4>Billed To</h4>
        <p><strong>${invoice.billTo?.name || 'Customer'}</strong></p>
        <p>${invoice.billTo?.email || ''}</p>
      </div>
      <div class="meta-box" style="text-align: right;">
        <h4>Invoice Details</h4>
        <p><strong>Date:</strong> ${new Date(invoice.issuedAt).toLocaleDateString('en-IN')}</p>
        <p><strong>Currency:</strong> ${invoice.currency}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map(item => `
          <tr>
            <td><strong>${item.description}</strong></td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">₹${(item.unitAmount / 100).toFixed(2)}</td>
            <td style="text-align: right;">₹${(item.amount / 100).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-box">
        <div class="total-row"><span>Subtotal (Net):</span><span>₹${((invoice.totalAmount - (invoice.taxAmount || 0)) / 100).toFixed(2)}</span></div>
        <div class="total-row"><span>GST (18% inclusive):</span><span>₹${((invoice.taxAmount || 0) / 100).toFixed(2)}</span></div>
        <div class="total-row grand-total"><span>Total Paid:</span><span>₹${(invoice.totalAmount / 100).toFixed(2)}</span></div>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for choosing AI Interviewer. For support, contact support@ai-interviewer.com</p>
    </div>
  </div>
</body>
</html>
      `;

      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InvoiceController();
