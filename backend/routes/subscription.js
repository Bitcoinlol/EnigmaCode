// Subscription Management Routes
const express = require('express');
const router = express.Router();
const subscriptionService = require('../services/subscription');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');

// Get available subscription plans
router.get('/plans', async (req, res) => {
    try {
        const plans = subscriptionService.getPlans();
        res.json({
            success: true,
            data: plans
        });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription plans'
        });
    }
});

// Get user's current subscription
router.get('/current', authenticateToken, async (req, res) => {
    try {
        const subscription = await subscriptionService.getUserSubscription(req.user._id);
        const usageStats = await subscriptionService.getUsageStats(req.user._id);
        
        res.json({
            success: true,
            data: {
                subscription,
                usage: usageStats
            }
        });
    } catch (error) {
        console.error('Get current subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription information'
        });
    }
});

// Upgrade subscription
router.post('/upgrade', authenticateToken, async (req, res) => {
    try {
        const { tier, paymentInfo } = req.body;

        if (!tier) {
            return res.status(400).json({
                success: false,
                message: 'Subscription tier is required'
            });
        }

        const plans = subscriptionService.getPlans();
        if (!plans[tier]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription tier'
            });
        }

        const result = await subscriptionService.upgradeSubscription(
            req.user._id,
            tier,
            paymentInfo
        );

        res.json({
            success: true,
            message: `Successfully upgraded to ${plans[tier].name}`,
            data: result
        });
    } catch (error) {
        console.error('Subscription upgrade error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upgrade subscription'
        });
    }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
    try {
        const { immediate = false } = req.body;

        const result = await subscriptionService.cancelSubscription(
            req.user._id,
            immediate
        );

        res.json({
            success: true,
            message: result.message,
            data: result
        });
    } catch (error) {
        console.error('Subscription cancellation error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to cancel subscription'
        });
    }
});

// Renew subscription (for manual renewals)
router.post('/renew', authenticateToken, async (req, res) => {
    try {
        const { paymentInfo } = req.body;

        if (!paymentInfo || !paymentInfo.transactionId) {
            return res.status(400).json({
                success: false,
                message: 'Payment information is required'
            });
        }

        const result = await subscriptionService.renewSubscription(
            req.user._id,
            paymentInfo
        );

        res.json({
            success: true,
            message: 'Subscription renewed successfully',
            data: result
        });
    } catch (error) {
        console.error('Subscription renewal error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to renew subscription'
        });
    }
});

// Check subscription permissions
router.post('/check-permission', authenticateToken, async (req, res) => {
    try {
        const { action, currentCount = 0 } = req.body;

        if (!action) {
            return res.status(400).json({
                success: false,
                message: 'Action is required'
            });
        }

        const canPerform = await subscriptionService.canPerformAction(
            req.user._id,
            action,
            currentCount
        );

        res.json({
            success: true,
            data: {
                action,
                allowed: canPerform,
                currentCount
            }
        });
    } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check permissions'
        });
    }
});

// Get usage statistics
router.get('/usage', authenticateToken, async (req, res) => {
    try {
        const usageStats = await subscriptionService.getUsageStats(req.user._id);
        
        res.json({
            success: true,
            data: usageStats
        });
    } catch (error) {
        console.error('Usage stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get usage statistics'
        });
    }
});

// Admin: Get subscription analytics
router.get('/analytics', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const analytics = await subscriptionService.getSubscriptionAnalytics();
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Subscription analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription analytics'
        });
    }
});

// Admin: Process expired subscriptions manually
router.post('/process-expired', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const processedCount = await subscriptionService.processExpiredSubscriptions();
        
        res.json({
            success: true,
            message: `Processed ${processedCount} expired subscriptions`,
            data: { processedCount }
        });
    } catch (error) {
        console.error('Process expired subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process expired subscriptions'
        });
    }
});

// Admin: Get all user subscriptions
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, tier, status } = req.query;
        const skip = (page - 1) * limit;

        let filter = {};
        if (tier) {
            filter['subscription.tier'] = tier;
        }

        const users = await User.find(filter)
            .select('username email subscription createdAt')
            .sort({ 'subscription.tier': -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await User.countDocuments(filter);

        // Add subscription status
        const now = new Date();
        const usersWithStatus = users.map(user => ({
            ...user,
            subscriptionStatus: user.subscription.tier === 'free' ? 'free' :
                              user.subscription.endDate && user.subscription.endDate < now ? 'expired' :
                              user.subscription.autoRenew ? 'active' : 'cancelled'
        }));

        res.json({
            success: true,
            data: {
                users: usersWithStatus,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription data'
        });
    }
});

// Webhook endpoint for payment processor (Stripe, etc.)
router.post('/webhook', async (req, res) => {
    try {
        // This would be implemented based on the payment processor
        // For now, just acknowledge the webhook
        console.log('Payment webhook received:', req.body);
        
        // TODO: Implement actual webhook processing based on payment provider
        // - Verify webhook signature
        // - Process payment events (successful payment, failed payment, etc.)
        // - Update user subscriptions accordingly
        
        res.json({ received: true });
    } catch (error) {
        console.error('Payment webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed'
        });
    }
});

module.exports = router;
