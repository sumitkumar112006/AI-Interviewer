const express = require('express');
const router = express.Router();
const subscriptionController = require('../controller/subscription.controller');
const { authUser } = require('../middleware/auth.middleware');

// GET /api/subscriptions/me - Retrieve current subscription and usage
router.get('/me', authUser, (req, res, next) => {
  subscriptionController.getMySubscription(req, res, next);
});

// POST /api/subscriptions/verify-client-payment - Immediate client signature verification & activation
router.post('/verify-client-payment', authUser, (req, res, next) => {
  subscriptionController.verifyClientPayment(req, res, next);
});

module.exports = router;
