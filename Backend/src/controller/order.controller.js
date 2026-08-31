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
      const { planKey, billingCycle, idempotencyKey, notes } = req.body;

      const result = await orderService.createOrder({
        userId,
        planKey,
        billingCycle,
        userSuppliedIdempotencyKey: idempotencyKey,
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
