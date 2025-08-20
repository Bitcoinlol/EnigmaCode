// Subscription Management Service
const User = require('../models/User');
const Analytics = require('../models/Analytics');
const webhookService = require('./webhook');

class SubscriptionService {
    constructor() {
        this.plans = {
            free: {
                name: 'Free',
                price: 0,
                features: {
                    maxProjects: 3,
                    maxKeys: 50,
                    obfuscationTier: 'standard',
                    apiAccess: false,
                    webhookSupport: false,
                    prioritySupport: false
                }
            },
            premium: {
                name: 'Premium',
                price: 9.99,
                features: {
                    maxProjects: 25,
                    maxKeys: 500,
                    obfuscationTier: 'premium',
                    apiAccess: true,
                    webhookSupport: true,
                    prioritySupport: true
                }
            },
            enterprise: {
                name: 'Enterprise',
                price: 29.99,
                features: {
                    maxProjects: -1, // Unlimited
                    maxKeys: -1, // Unlimited
                    obfuscationTier: 'premium',
                    apiAccess: true,
                    webhookSupport: true,
                    prioritySupport: true,
                    customIntegrations: true,
                    dedicatedSupport: true
                }
            }
        };
    }

    // Get subscription plans
    getPlans() {
        return this.plans;
    }

    // Get user's current subscription
    async getUserSubscription(userId) {
        try {
            const user = await User.findById(userId).select('subscription');
            return user ? user.subscription : null;
        } catch (error) {
            console.error('Error getting user subscription:', error);
            return null;
        }
    }

    // Check if user can perform action based on subscription
    async canPerformAction(userId, action, currentCount = 0) {
        try {
            const user = await User.findById(userId).select('subscription');
            if (!user) return false;

            const plan = this.plans[user.subscription.tier];
            if (!plan) return false;

            switch (action) {
                case 'create_project':
                    return plan.features.maxProjects === -1 || currentCount < plan.features.maxProjects;
                
                case 'create_key':
                    return plan.features.maxKeys === -1 || currentCount < plan.features.maxKeys;
                
                case 'use_api':
                    return plan.features.apiAccess;
                
                case 'use_webhooks':
                    return plan.features.webhookSupport;
                
                case 'premium_obfuscation':
                    return plan.features.obfuscationTier === 'premium';
                
                default:
                    return false;
            }
        } catch (error) {
            console.error('Error checking subscription permissions:', error);
            return false;
        }
    }

    // Upgrade user subscription
    async upgradeSubscription(userId, newTier, paymentInfo = {}) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const newPlan = this.plans[newTier];
            if (!newPlan) {
                throw new Error('Invalid subscription tier');
            }

            const oldTier = user.subscription.tier;
            const oldPlan = this.plans[oldTier];

            // Update user subscription
            user.subscription = {
                tier: newTier,
                startDate: new Date(),
                endDate: this.calculateEndDate(newTier),
                autoRenew: paymentInfo.autoRenew || false,
                paymentMethod: paymentInfo.paymentMethod || null,
                lastPayment: paymentInfo.amount ? {
                    amount: paymentInfo.amount,
                    date: new Date(),
                    transactionId: paymentInfo.transactionId
                } : user.subscription.lastPayment
            };

            await user.save();

            // Log subscription change
            await Analytics.logEvent('subscription_upgrade', userId, null, null, {
                oldTier,
                newTier,
                amount: paymentInfo.amount || newPlan.price,
                paymentMethod: paymentInfo.paymentMethod,
                transactionId: paymentInfo.transactionId
            });

            // Send webhook notification
            await webhookService.sendNotification('subscription_upgraded', {
                username: user.username,
                newPlan: newPlan.name,
                amount: paymentInfo.amount || newPlan.price
            }, userId);

            return {
                success: true,
                subscription: user.subscription,
                features: newPlan.features
            };
        } catch (error) {
            console.error('Subscription upgrade error:', error);
            throw error;
        }
    }

    // Downgrade or cancel subscription
    async cancelSubscription(userId, immediate = false) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const oldTier = user.subscription.tier;

            if (immediate) {
                // Immediate downgrade to free
                user.subscription = {
                    tier: 'free',
                    startDate: new Date(),
                    endDate: null,
                    autoRenew: false,
                    paymentMethod: null,
                    lastPayment: user.subscription.lastPayment
                };
            } else {
                // Cancel at end of billing period
                user.subscription.autoRenew = false;
                user.subscription.cancelledAt = new Date();
            }

            await user.save();

            // Log cancellation
            await Analytics.logEvent('subscription_cancelled', userId, null, null, {
                oldTier,
                immediate,
                cancelledAt: new Date()
            });

            return {
                success: true,
                subscription: user.subscription,
                message: immediate ? 'Subscription cancelled immediately' : 'Subscription will cancel at end of billing period'
            };
        } catch (error) {
            console.error('Subscription cancellation error:', error);
            throw error;
        }
    }

    // Process subscription renewal
    async renewSubscription(userId, paymentInfo) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const currentTier = user.subscription.tier;
            const plan = this.plans[currentTier];

            if (!plan || currentTier === 'free') {
                throw new Error('No active subscription to renew');
            }

            // Update subscription dates
            user.subscription.endDate = this.calculateEndDate(currentTier, user.subscription.endDate);
            user.subscription.lastPayment = {
                amount: paymentInfo.amount || plan.price,
                date: new Date(),
                transactionId: paymentInfo.transactionId
            };

            await user.save();

            // Log renewal
            await Analytics.logEvent('subscription_renewed', userId, null, null, {
                tier: currentTier,
                amount: paymentInfo.amount || plan.price,
                transactionId: paymentInfo.transactionId,
                newEndDate: user.subscription.endDate
            });

            return {
                success: true,
                subscription: user.subscription
            };
        } catch (error) {
            console.error('Subscription renewal error:', error);
            throw error;
        }
    }

    // Check for expired subscriptions and downgrade
    async processExpiredSubscriptions() {
        try {
            const now = new Date();
            const expiredUsers = await User.find({
                'subscription.tier': { $ne: 'free' },
                'subscription.endDate': { $lt: now },
                'subscription.autoRenew': false
            });

            let processedCount = 0;

            for (const user of expiredUsers) {
                try {
                    const oldTier = user.subscription.tier;
                    
                    // Downgrade to free
                    user.subscription = {
                        tier: 'free',
                        startDate: new Date(),
                        endDate: null,
                        autoRenew: false,
                        paymentMethod: null,
                        lastPayment: user.subscription.lastPayment
                    };

                    await user.save();

                    // Log downgrade
                    await Analytics.logEvent('subscription_expired', user._id, null, null, {
                        oldTier,
                        expiredAt: now
                    });

                    processedCount++;
                } catch (error) {
                    console.error(`Error processing expired subscription for user ${user._id}:`, error);
                }
            }

            console.log(`Processed ${processedCount} expired subscriptions`);
            return processedCount;
        } catch (error) {
            console.error('Error processing expired subscriptions:', error);
            return 0;
        }
    }

    // Get subscription usage stats
    async getUsageStats(userId) {
        try {
            const user = await User.findById(userId).populate({
                path: 'stats',
                select: 'totalProjects totalKeys'
            });

            if (!user) {
                throw new Error('User not found');
            }

            const plan = this.plans[user.subscription.tier];
            const stats = user.stats || { totalProjects: 0, totalKeys: 0 };

            return {
                subscription: {
                    tier: user.subscription.tier,
                    plan: plan.name,
                    features: plan.features
                },
                usage: {
                    projects: {
                        current: stats.totalProjects,
                        limit: plan.features.maxProjects,
                        percentage: plan.features.maxProjects === -1 ? 0 : 
                                  Math.round((stats.totalProjects / plan.features.maxProjects) * 100)
                    },
                    keys: {
                        current: stats.totalKeys,
                        limit: plan.features.maxKeys,
                        percentage: plan.features.maxKeys === -1 ? 0 : 
                                  Math.round((stats.totalKeys / plan.features.maxKeys) * 100)
                    }
                }
            };
        } catch (error) {
            console.error('Error getting usage stats:', error);
            throw error;
        }
    }

    // Calculate subscription end date
    calculateEndDate(tier, startDate = new Date()) {
        if (tier === 'free') return null;
        
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1); // Monthly billing
        return endDate;
    }

    // Get subscription analytics
    async getSubscriptionAnalytics() {
        try {
            const analytics = await User.aggregate([
                {
                    $group: {
                        _id: '$subscription.tier',
                        count: { $sum: 1 },
                        totalRevenue: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$subscription.tier', 'free'] },
                                    0,
                                    { $cond: [
                                        { $eq: ['$subscription.tier', 'premium'] },
                                        9.99,
                                        29.99
                                    ]}
                                ]
                            }
                        }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);

            const totalUsers = await User.countDocuments();
            const totalRevenue = analytics.reduce((sum, tier) => sum + tier.totalRevenue, 0);

            return {
                totalUsers,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                tierBreakdown: analytics.map(tier => ({
                    tier: tier._id,
                    users: tier.count,
                    revenue: Math.round(tier.totalRevenue * 100) / 100,
                    percentage: Math.round((tier.count / totalUsers) * 100)
                }))
            };
        } catch (error) {
            console.error('Error getting subscription analytics:', error);
            throw error;
        }
    }
}

module.exports = new SubscriptionService();
