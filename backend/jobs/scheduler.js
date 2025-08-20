// Job Scheduler - Handles recurring tasks and maintenance
const cron = require('node-cron');
const subscriptionService = require('../services/subscription');
const webhookService = require('../services/webhook');
const Analytics = require('../models/Analytics');
const User = require('../models/User');
const Key = require('../models/Key');
const Project = require('../models/Project');

class JobScheduler {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
    }

    // Start all scheduled jobs
    start() {
        if (this.isRunning) {
            console.log('Job scheduler is already running');
            return;
        }

        console.log('Starting job scheduler...');
        this.isRunning = true;

        // Process expired subscriptions daily at 2 AM
        this.scheduleJob('expired-subscriptions', '0 2 * * *', async () => {
            console.log('Processing expired subscriptions...');
            try {
                const processedCount = await subscriptionService.processExpiredSubscriptions();
                console.log(`Processed ${processedCount} expired subscriptions`);
                
                if (processedCount > 0) {
                    await webhookService.sendNotification('system_info', {
                        message: `Processed ${processedCount} expired subscriptions`,
                        type: 'maintenance'
                    });
                }
            } catch (error) {
                console.error('Error processing expired subscriptions:', error);
                await webhookService.sendNotification('system_error', {
                    errorType: 'Subscription Processing',
                    component: 'Job Scheduler',
                    severity: 'Medium',
                    message: error.message
                });
            }
        });

        // Clean up old analytics data monthly
        this.scheduleJob('cleanup-analytics', '0 3 1 * *', async () => {
            console.log('Cleaning up old analytics data...');
            try {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

                const deletedCount = await Analytics.deleteMany({
                    timestamp: { $lt: sixMonthsAgo },
                    eventType: { $in: ['activation', 'error'] } // Keep important events longer
                });

                console.log(`Cleaned up ${deletedCount.deletedCount} old analytics records`);
            } catch (error) {
                console.error('Error cleaning up analytics:', error);
            }
        });

        // Generate daily usage reports
        this.scheduleJob('daily-reports', '0 1 * * *', async () => {
            console.log('Generating daily usage report...');
            try {
                const report = await this.generateDailyReport();
                
                if (report.totalActivations > 1000 || report.errorRate > 5) {
                    await webhookService.sendNotification('high_usage_alert', {
                        metric: 'Daily Activations',
                        currentValue: report.totalActivations,
                        threshold: 1000,
                        timePeriod: 'Last 24 hours',
                        errorRate: report.errorRate
                    });
                }
            } catch (error) {
                console.error('Error generating daily report:', error);
            }
        });

        // Check for suspicious activity every hour
        this.scheduleJob('security-check', '0 * * * *', async () => {
            try {
                await this.performSecurityChecks();
            } catch (error) {
                console.error('Error performing security checks:', error);
            }
        });

        // Update user statistics daily
        this.scheduleJob('update-stats', '0 4 * * *', async () => {
            console.log('Updating user statistics...');
            try {
                await this.updateUserStatistics();
            } catch (error) {
                console.error('Error updating user statistics:', error);
            }
        });

        // Health check every 15 minutes
        this.scheduleJob('health-check', '*/15 * * * *', async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                console.error('Health check failed:', error);
                await webhookService.sendNotification('system_error', {
                    errorType: 'Health Check',
                    component: 'System Monitor',
                    severity: 'High',
                    message: 'System health check failed'
                });
            }
        });

        console.log('Job scheduler started successfully');
    }

    // Stop all scheduled jobs
    stop() {
        if (!this.isRunning) {
            console.log('Job scheduler is not running');
            return;
        }

        console.log('Stopping job scheduler...');
        
        for (const [name, job] of this.jobs) {
            job.destroy();
            console.log(`Stopped job: ${name}`);
        }
        
        this.jobs.clear();
        this.isRunning = false;
        console.log('Job scheduler stopped');
    }

    // Schedule a new job
    scheduleJob(name, schedule, task) {
        if (this.jobs.has(name)) {
            console.log(`Job ${name} already exists, replacing...`);
            this.jobs.get(name).destroy();
        }

        const job = cron.schedule(schedule, task, {
            scheduled: true,
            timezone: 'America/New_York'
        });

        this.jobs.set(name, job);
        console.log(`Scheduled job: ${name} with schedule: ${schedule}`);
    }

    // Generate daily usage report
    async generateDailyReport() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const today = new Date(yesterday);
        today.setDate(today.getDate() + 1);

        const [activations, errors, newUsers, newProjects] = await Promise.all([
            Analytics.countDocuments({
                eventType: 'activation',
                timestamp: { $gte: yesterday, $lt: today }
            }),
            Analytics.countDocuments({
                eventType: 'error',
                timestamp: { $gte: yesterday, $lt: today }
            }),
            User.countDocuments({
                createdAt: { $gte: yesterday, $lt: today }
            }),
            Project.countDocuments({
                createdAt: { $gte: yesterday, $lt: today }
            })
        ]);

        const errorRate = activations > 0 ? ((errors / activations) * 100).toFixed(2) : 0;

        return {
            date: yesterday.toISOString().split('T')[0],
            totalActivations: activations,
            totalErrors: errors,
            errorRate: parseFloat(errorRate),
            newUsers,
            newProjects
        };
    }

    // Perform security checks
    async performSecurityChecks() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Check for high error rates from single IPs
        const suspiciousIPs = await Analytics.aggregate([
            {
                $match: {
                    eventType: 'error',
                    timestamp: { $gte: oneHourAgo },
                    'metadata.ip': { $exists: true }
                }
            },
            {
                $group: {
                    _id: '$metadata.ip',
                    errorCount: { $sum: 1 }
                }
            },
            {
                $match: { errorCount: { $gte: 50 } }
            }
        ]);

        for (const ipData of suspiciousIPs) {
            await webhookService.sendNotification('security_alert', {
                type: 'High Error Rate',
                ip: ipData._id,
                errorCount: ipData.errorCount,
                timeframe: '1 hour'
            });
        }

        // Check for tamper attempts
        const tamperAttempts = await Analytics.countDocuments({
            eventType: 'tamper',
            timestamp: { $gte: oneHourAgo }
        });

        if (tamperAttempts > 10) {
            await webhookService.sendNotification('security_alert', {
                type: 'Multiple Tamper Attempts',
                count: tamperAttempts,
                timeframe: '1 hour'
            });
        }
    }

    // Update user statistics
    async updateUserStatistics() {
        const users = await User.find({}).select('_id');
        let updatedCount = 0;

        for (const user of users) {
            try {
                const [projectCount, keyCount] = await Promise.all([
                    Project.countDocuments({ owner: user._id }),
                    Key.countDocuments({ owner: user._id })
                ]);

                await User.findByIdAndUpdate(user._id, {
                    'stats.totalProjects': projectCount,
                    'stats.totalKeys': keyCount
                });

                updatedCount++;
            } catch (error) {
                console.error(`Error updating stats for user ${user._id}:`, error);
            }
        }

        console.log(`Updated statistics for ${updatedCount} users`);
    }

    // Perform system health check
    async performHealthCheck() {
        const checks = {
            database: false,
            webhook: false,
            memory: false,
            disk: false
        };

        // Database check
        try {
            await User.findOne().limit(1);
            checks.database = true;
        } catch (error) {
            console.error('Database health check failed:', error);
        }

        // Webhook check (if configured)
        if (process.env.DISCORD_WEBHOOK_URL) {
            try {
                const webhookStats = webhookService.getWebhookStats();
                checks.webhook = webhookStats.configured;
            } catch (error) {
                console.error('Webhook health check failed:', error);
            }
        } else {
            checks.webhook = true; // Not configured, so consider it healthy
        }

        // Memory check
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
        checks.memory = memoryUsageMB < 500; // Alert if using more than 500MB

        if (memoryUsageMB > 500) {
            await webhookService.sendNotification('system_alert', {
                type: 'High Memory Usage',
                usage: `${memoryUsageMB.toFixed(2)}MB`,
                threshold: '500MB'
            });
        }

        // Overall health
        const healthyChecks = Object.values(checks).filter(Boolean).length;
        const totalChecks = Object.keys(checks).length;
        const healthPercentage = (healthyChecks / totalChecks) * 100;

        if (healthPercentage < 75) {
            await webhookService.sendNotification('system_error', {
                errorType: 'System Health',
                component: 'Health Monitor',
                severity: 'High',
                message: `System health at ${healthPercentage.toFixed(1)}%`,
                details: checks
            });
        }

        return {
            healthy: healthPercentage >= 75,
            percentage: healthPercentage,
            checks
        };
    }

    // Get job status
    getStatus() {
        return {
            running: this.isRunning,
            jobCount: this.jobs.size,
            jobs: Array.from(this.jobs.keys())
        };
    }

    // Run a job manually
    async runJob(jobName) {
        if (!this.jobs.has(jobName)) {
            throw new Error(`Job ${jobName} not found`);
        }

        console.log(`Manually running job: ${jobName}`);
        
        // This is a simplified approach - in a real implementation,
        // you'd need to extract and run the task function
        switch (jobName) {
            case 'expired-subscriptions':
                return await subscriptionService.processExpiredSubscriptions();
            case 'daily-reports':
                return await this.generateDailyReport();
            case 'security-check':
                return await this.performSecurityChecks();
            case 'update-stats':
                return await this.updateUserStatistics();
            case 'health-check':
                return await this.performHealthCheck();
            default:
                throw new Error(`Manual execution not implemented for job: ${jobName}`);
        }
    }
}

module.exports = new JobScheduler();
