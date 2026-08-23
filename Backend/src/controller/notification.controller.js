const notificationModel = require('../models/notification.model');

/**
 * @name getUserNotificationsController
 * @description Fetch user notifications with unread count
 * @access Private (User/Admin)
 */
async function getUserNotificationsController(req, res) {
    try {
        const recipientId = req.user._id || req.user.id;

        const notifications = await notificationModel.find({ recipient: recipientId })
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

        const unreadCount = await notificationModel.countDocuments({
            recipient: recipientId,
            read: false
        });

        return res.status(200).json({
            notifications,
            unreadCount
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch notifications." });
    }
}

/**
 * @name markAsReadController
 * @description Mark a single notification as read
 * @access Private (User/Admin)
 */
async function markAsReadController(req, res) {
    try {
        const { id } = req.params;
        const recipientId = req.user._id || req.user.id;

        const notification = await notificationModel.findOneAndUpdate(
            { _id: id, recipient: recipientId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: "Notification not found." });
        }

        const unreadCount = await notificationModel.countDocuments({
            recipient: recipientId,
            read: false
        });

        return res.status(200).json({
            message: "Notification marked as read.",
            notification,
            unreadCount
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to update notification." });
    }
}

/**
 * @name markAllAsReadController
 * @description Mark all notifications as read for current user
 * @access Private (User/Admin)
 */
async function markAllAsReadController(req, res) {
    try {
        const recipientId = req.user._id || req.user.id;

        await notificationModel.updateMany(
            { recipient: recipientId, read: false },
            { read: true }
        );

        return res.status(200).json({
            message: "All notifications marked as read.",
            unreadCount: 0
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to mark notifications as read." });
    }
}

/**
 * @name deleteNotificationController
 * @description Delete a single notification
 * @access Private (User/Admin)
 */
async function deleteNotificationController(req, res) {
    try {
        const { id } = req.params;
        const recipientId = req.user._id || req.user.id;

        const deleted = await notificationModel.findOneAndDelete({ _id: id, recipient: recipientId });
        if (!deleted) {
            return res.status(404).json({ message: "Notification not found." });
        }

        const unreadCount = await notificationModel.countDocuments({
            recipient: recipientId,
            read: false
        });

        return res.status(200).json({
            message: "Notification deleted.",
            unreadCount
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to delete notification." });
    }
}

module.exports = {
    getUserNotificationsController,
    markAsReadController,
    markAllAsReadController,
    deleteNotificationController
};
