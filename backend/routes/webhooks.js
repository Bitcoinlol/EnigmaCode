// Webhook Management Routes
const express = require('express');
const router = express.Router();
const webhookService = require('../services/webhook');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const Analytics = require('../models/Analytics');

// Test webhook endpoint
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const success = await webhookService.testWebhook();
        
        if (success) {
            // Log test event
            await Analytics.logEvent('webhook_test', req.user._id, null, null, {
                success: true,
                timestamp: new Date()
            });

            res.json({
                success: true,
                message: 'Webhook test successful'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Webhook test failed'
            });
        }
    } catch (error) {
        console.error('Webhook test error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during webhook test'
        });
    }
});

// Get webhook configuration and stats
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = webhookService.getWebhookStats();
        
        res.json({
            success: true,
            data: {
                ...stats,
                lastTest: await getLastWebhookTest(),
                recentNotifications: await getRecentNotifications()
            }
        });
    } catch (error) {
        console.error('Webhook status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get webhook status'
        });
    }
});

// Send manual notification (admin only)
router.post('/send', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { type, data, userId } = req.body;

        if (!type || !data) {
            return res.status(400).json({
                success: false,
                message: 'Type and data are required'
            });
        }

        const success = await webhookService.sendNotification(type, data, userId);

        // Log manual notification
        await Analytics.logEvent('manual_webhook', req.user._id, null, null, {
            type,
            success,
            targetUserId: userId,
            timestamp: new Date()
        });

        res.json({
            success,
            message: success ? 'Notification sent successfully' : 'Failed to send notification'
        });
    } catch (error) {
        console.error('Manual webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send manual notification'
        });
    }
});

// Batch send notifications (admin only)
router.post('/batch', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { notifications } = req.body;

        if (!Array.isArray(notifications) || notifications.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Notifications array is required'
            });
        }

        if (notifications.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 10 notifications per batch'
            });
        }

        const results = await webhookService.sendBatchNotifications(notifications);
        const successCount = results.filter(r => r.success).length;

        // Log batch operation
        await Analytics.logEvent('batch_webhook', req.user._id, null, null, {
            totalCount: notifications.length,
            successCount,
            failureCount: notifications.length - successCount,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: `Sent ${successCount}/${notifications.length} notifications successfully`,
            results
        });
    } catch (error) {
        console.error('Batch webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send batch notifications'
        });
    }
});

// Get webhook logs/history
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, type } = req.query;
        const skip = (page - 1) * limit;

        let filter = {
            eventType: { $in: ['webhook_test', 'manual_webhook', 'batch_webhook'] }
        };

        if (type) {
            filter['metadata.type'] = type;
        }

        const logs = await Analytics.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'username email')
            .lean();

        const total = await Analytics.countDocuments(filter);

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Webhook logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get webhook logs'
        });
    }
});

// Webhook health check
router.get('/health', async (req, res) => {
    try {
        const stats = webhookService.getWebhookStats();
        
        res.json({
            success: true,
            data: {
                configured: stats.configured,
                status: stats.configured ? 'ready' : 'not_configured',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Webhook health check error:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook health check failed'
        });
    }
});

// Helper functions
async function getLastWebhookTest() {
    try {
        const lastTest = await Analytics.findOne({
            eventType: 'webhook_test'
        }).sort({ timestamp: -1 }).lean();

        return lastTest ? {
            timestamp: lastTest.timestamp,
            success: lastTest.metadata?.success || false
        } : null;
    } catch (error) {
        console.error('Error getting last webhook test:', error);
        return null;
    }
}

async function getRecentNotifications() {
    try {
        const recentNotifications = await Analytics.find({
            eventType: { $in: ['manual_webhook', 'batch_webhook'] }
        })
        .sort({ timestamp: -1 })
        .limit(5)
        .populate('userId', 'username')
        .lean();

        return recentNotifications.map(notification => ({
            id: notification._id,
            type: notification.metadata?.type || 'unknown',
            success: notification.metadata?.success || false,
            timestamp: notification.timestamp,
            user: notification.userId?.username || 'System'
        }));
    } catch (error) {
        console.error('Error getting recent notifications:', error);
        return [];
    }
}

module.exports = router;
