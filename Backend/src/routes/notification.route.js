const express = require('express');
const { authUser } = require('../middleware/auth.middleware');
const {
    getUserNotificationsController,
    markAsReadController,
    markAllAsReadController,
    deleteNotificationController
} = require('../controller/notification.controller');

const notificationRouter = express.Router();

// Apply authUser middleware to all notification endpoints
notificationRouter.use(authUser);

/**
 * @route GET /api/notifications
 * @description Get all notifications for logged-in user
 */
notificationRouter.get('/', getUserNotificationsController);

/**
 * @route PATCH /api/notifications/read-all
 * @description Mark all notifications as read for logged-in user
 */
notificationRouter.patch('/read-all', markAllAsReadController);

/**
 * @route PATCH /api/notifications/:id/read
 * @description Mark single notification as read
 */
notificationRouter.patch('/:id/read', markAsReadController);

/**
 * @route DELETE /api/notifications/:id
 * @description Delete single notification
 */
notificationRouter.delete('/:id', deleteNotificationController);

module.exports = notificationRouter;
