// Webhook Service - Discord notifications and other integrations
const axios = require('axios');
const crypto = require('crypto');

class WebhookService {
    constructor() {
        this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
        this.webhookSecret = process.env.WEBHOOK_SECRET || 'enigmacode-webhook-secret';
        this.rateLimits = new Map(); // Track rate limits per webhook
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second base delay
    }

    // Main method to send notifications
    async sendNotification(type, data, userId = null) {
        try {
            // Check if webhooks are enabled
            if (!this.discordWebhookUrl) {
                console.log('Discord webhook not configured, skipping notification');
                return false;
            }

            // Check rate limits
            if (this.isRateLimited(type)) {
                console.log(`Rate limited for notification type: ${type}`);
                return false;
            }

            // Generate webhook payload
            const payload = this.generateDiscordPayload(type, data, userId);
            if (!payload) {
                console.log(`No payload generated for notification type: ${type}`);
                return false;
            }

            // Send webhook with retry logic
            const success = await this.sendWebhookWithRetry(payload);
            
            if (success) {
                this.updateRateLimit(type);
                console.log(`Webhook sent successfully for type: ${type}`);
            }

            return success;
        } catch (error) {
            console.error('Webhook notification error:', error.message);
            return false;
        }
    }

    // Generate Discord embed payload based on notification type
    generateDiscordPayload(type, data, userId) {
        const basePayload = {
            username: 'EnigmaCode',
            avatar_url: 'https://cdn.discordapp.com/attachments/placeholder/enigmacode-logo.png'
        };

        let embed = null;

        switch (type) {
            case 'user_registered':
                embed = {
                    title: '🎉 New User Registration',
                    description: `A new user has joined EnigmaCode!`,
                    color: 0x8B5CF6, // Purple
                    fields: [
                        { name: 'Username', value: data.username || 'Unknown', inline: true },
                        { name: 'Email', value: data.email || 'Unknown', inline: true },
                        { name: 'Subscription', value: data.subscription || 'Free', inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'EnigmaCode Platform' }
                };
                break;

            case 'project_created':
                embed = {
                    title: '📁 New Project Created',
                    description: `Project "${data.name}" has been created`,
                    color: 0x10B981, // Green
                    fields: [
                        { name: 'Project Name', value: data.name, inline: true },
                        { name: 'Owner', value: data.owner || 'Unknown', inline: true },
                        { name: 'Obfuscation Tier', value: data.obfuscationTier || 'Standard', inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'EnigmaCode Platform' }
                };
                break;

            case 'key_created':
                embed = {
                    title: '🔑 New License Key Generated',
                    description: `A new license key has been created`,
                    color: 0x3B82F6, // Blue
                    fields: [
                        { name: 'Key Type', value: data.type || 'Standard', inline: true },
                        { name: 'Project', value: data.projectName || 'Unknown', inline: true },
                        { name: 'Expiration', value: data.expiration ? new Date(data.expiration).toLocaleDateString() : 'Never', inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'EnigmaCode Platform' }
                };
                break;

            case 'key_banned':
                embed = {
                    title: '🚫 License Key Banned',
                    description: `A license key has been banned due to suspicious activity`,
                    color: 0xEF4444, // Red
                    fields: [
                        { name: 'Key ID', value: data.keyId || 'Unknown', inline: true },
                        { name: 'Reason', value: data.reason || 'Policy violation', inline: true },
                        { name: 'Project', value: data.projectName || 'Unknown', inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'EnigmaCode Platform' }
                };
                break;

            case 'tamper_detected':
                embed = {
                    title: '⚠️ Tamper Attempt Detected',
                    description: `Tampering attempt detected on protected content`,
                    color: 0xF59E0B, // Orange
                    fields: [
                        { name: 'Project', value: data.projectName || 'Unknown', inline: true },
                        { name: 'User ID', value: data.userId || 'Unknown', inline: true },
                        { name: 'Detection Type', value: data.detectionType || 'General', inline: true },
                        { name: 'IP Address', value: data.ipAddress || 'Unknown', inline: false }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'EnigmaCode Security' }
                };
                break;

            case 'subscription_upgraded':
                embed = {
                    title: '💎 Subscription Upgraded',
                    description: `User upgraded their subscription`,
                    color: 0x8B5CF6, // Purple
                    fields: [
                        { name: 'Username', value: data.username || 'Unknown', inline: true },
                        { name: 'New Plan', value: data.newPlan || 'Premium', inline: true },
                        { name: 'Revenue', value: `$${data.amount || '0.00'}`, inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'EnigmaCode Billing' }
                };
                break;

            case 'high_usage_alert':
                embed = {
                    title: '📊 High Usage Alert',
                    description: `Unusual activity detected on the platform`,
                    color: 0xF59E0B, // Orange
                    fields: [
                        { name: 'Metric', value: data.metric || 'API Requests', inline: true },
                        { name: 'Current Value', value: data.currentValue?.toString() || 'Unknown', inline: true },
                        { name: 'Threshold', value: data.threshold?.toString() || 'Unknown', inline: true },
                        { name: 'Time Period', value: data.timePeriod || 'Last hour', inline: false }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'EnigmaCode Monitoring' }
                };
                break;

            case 'system_error':
                embed = {
                    title: '🔥 System Error',
                    description: `Critical system error detected`,
                    color: 0xEF4444, // Red
                    fields: [
                        { name: 'Error Type', value: data.errorType || 'Unknown', inline: true },
                        { name: 'Component', value: data.component || 'Unknown', inline: true },
                        { name: 'Severity', value: data.severity || 'High', inline: true },
                        { name: 'Message', value: data.message || 'No details available', inline: false }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'EnigmaCode System' }
                };
                break;

            default:
                console.log(`Unknown notification type: ${type}`);
                return null;
        }

        return {
            ...basePayload,
            embeds: [embed]
        };
    }

    // Send webhook with retry logic
    async sendWebhookWithRetry(payload, attempt = 1) {
        try {
            const response = await axios.post(this.discordWebhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'EnigmaCode-Webhook/1.0'
                },
                timeout: 10000 // 10 second timeout
            });

            return response.status >= 200 && response.status < 300;
        } catch (error) {
            console.error(`Webhook attempt ${attempt} failed:`, error.message);

            // Retry logic
            if (attempt < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`Retrying webhook in ${delay}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendWebhookWithRetry(payload, attempt + 1);
            }

            return false;
        }
    }

    // Rate limiting to prevent spam
    isRateLimited(type) {
        const key = `webhook_${type}`;
        const now = Date.now();
        const limit = this.rateLimits.get(key);

        if (!limit) {
            return false;
        }

        // Different rate limits for different notification types
        const rateLimitConfig = {
            'user_registered': 60000, // 1 minute
            'project_created': 30000, // 30 seconds
            'key_created': 10000, // 10 seconds
            'key_banned': 5000, // 5 seconds
            'tamper_detected': 30000, // 30 seconds
            'subscription_upgraded': 60000, // 1 minute
            'high_usage_alert': 300000, // 5 minutes
            'system_error': 60000 // 1 minute
        };

        const cooldown = rateLimitConfig[type] || 30000; // Default 30 seconds
        return (now - limit) < cooldown;
    }

    updateRateLimit(type) {
        const key = `webhook_${type}`;
        this.rateLimits.set(key, Date.now());
    }

    // Verify webhook signature (for incoming webhooks)
    verifyWebhookSignature(payload, signature) {
        const expectedSignature = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(JSON.stringify(payload))
            .digest('hex');

        return `sha256=${expectedSignature}` === signature;
    }

    // Batch notifications for efficiency
    async sendBatchNotifications(notifications) {
        const results = [];
        
        for (const notification of notifications) {
            const result = await this.sendNotification(
                notification.type,
                notification.data,
                notification.userId
            );
            results.push({ ...notification, success: result });
            
            // Small delay between batch notifications
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return results;
    }

    // Test webhook connectivity
    async testWebhook() {
        const testPayload = {
            username: 'EnigmaCode',
            embeds: [{
                title: '🧪 Webhook Test',
                description: 'This is a test notification from EnigmaCode',
                color: 0x8B5CF6,
                timestamp: new Date().toISOString(),
                footer: { text: 'EnigmaCode Test' }
            }]
        };

        return await this.sendWebhookWithRetry(testPayload);
    }

    // Get webhook statistics
    getWebhookStats() {
        return {
            configured: !!this.discordWebhookUrl,
            rateLimits: Object.fromEntries(this.rateLimits),
            maxRetries: this.maxRetries,
            retryDelay: this.retryDelay
        };
    }
}

// Export singleton instance
module.exports = new WebhookService();
