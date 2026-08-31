const express = require('express');
const router = express.Router();
const invoiceController = require('../controller/invoice.controller');
const { authUser } = require('../middleware/auth.middleware');

// GET /api/invoices - Retrieve list of authenticated user's invoices
router.get('/', authUser, (req, res, next) => {
  invoiceController.getMyInvoices(req, res, next);
});

// GET /api/invoices/:id - Retrieve single invoice data
router.get('/:id', authUser, (req, res, next) => {
  invoiceController.getInvoiceById(req, res, next);
});

// GET /api/invoices/:id/pdf - Printable view / HTML for invoice
router.get('/:id/pdf', authUser, (req, res, next) => {
  invoiceController.getInvoiceHtmlOrPdf(req, res, next);
});

module.exports = router;
