const express = require('express');
const router = express.Router();
const orderController = require('../controller/order.controller');
const { authUser } = require('../middleware/auth.middleware');
const { createRateLimiter } = require('../middleware/rateLimiter.middleware');

// Rate limiter for order creation to prevent order spam (5 orders per minute per user)
const orderCreationLimiter = createRateLimiter({
  prefix: 'ratelimit:orders:create',
  windowSeconds: 60,
  maxRequests: 5,
  message: 'Too many order requests. Please wait a minute before creating a new order.'
});

// POST /api/orders - Create idempotent payment order (Auth + Rate Limited)
router.post('/', authUser, orderCreationLimiter, (req, res, next) => {
  orderController.createOrder(req, res, next);
});

// GET /api/orders/:id - Fetch order status
router.get('/:id', authUser, (req, res, next) => {
  orderController.getOrder(req, res, next);
});

module.exports = router;
