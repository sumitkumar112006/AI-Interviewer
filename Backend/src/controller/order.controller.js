const orderService = require('../services/order.service');

/**
 * Controller for Payment Order operations
 */
class OrderController {
  /**
   * POST /api/orders
   * Create an idempotent payment order
   */
  async createOrder(req, res, next) {
    try {
      const userId = req.user.id;
      const { planKey, billingCycle, idempotencyKey, couponCode, notes } = req.body;

      const result = await orderService.createOrder({
        userId,
        planKey,
        billingCycle,
        userSuppliedIdempotencyKey: idempotencyKey,
        couponCode,
        notes
      });

      return res.status(result.isExisting ? 200 : 201).json({
        success: true,
        message: result.isExisting ? 'Existing order retrieved.' : 'Payment order created successfully.',
        data: {
          orderId: result.order._id,
          gatewayOrderId: result.order.gatewayOrderId,
          planKey: result.order.planKey,
          amount: result.order.amount,
          originalAmount: result.order.originalAmount || result.order.amount,
          discountAmount: result.order.discountAmount || 0,
          couponCode: result.order.couponCode || null,
          currency: result.order.currency,
          status: result.order.status,
          idempotencyKey: result.order.idempotencyKey,
          keyId: result.keyId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/orders/validate-coupon
   * Validate a coupon code before initiating payment
   */
  async validateCoupon(req, res, next) {
    try {
      const userId = req.user?.id || req.user?._id;
      const { couponCode, planKey, billingCycle } = req.body;

      const validation = await orderService.validateCoupon({
        code: couponCode,
        userId,
        planKey,
        billingCycle
      });

      return res.status(200).json({
        success: true,
        message: 'Coupon is valid and eligible!',
        data: validation
      });
    } catch (error) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message || 'Invalid coupon code.'
      });
    }
  }

  /**
   * GET /api/orders/:id
   * Fetch order status (for frontend polling / verification display)
   */
  async getOrder(req, res, next) {
    try {
      const orderId = req.params.id;
      const userId = req.user.id;
      const isAdmin = req.user.isAdmin;

      const order = await orderService.getOrderById({ orderId, userId, isAdmin });

      return res.status(200).json({
        success: true,
        data: {
          id: order._id,
          gatewayOrderId: order.gatewayOrderId,
          planKey: order.planKey,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
