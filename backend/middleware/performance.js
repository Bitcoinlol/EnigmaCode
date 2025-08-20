// Performance Monitoring and Optimization Middleware
const { performance } = require('perf_hooks');

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.slowQueries = [];
        this.requestCounts = new Map();
        this.errorCounts = new Map();
    }

    // Request timing middleware
    requestTimer() {
        return (req, res, next) => {
            const startTime = performance.now();
            const originalSend = res.send;

            res.send = function(data) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                // Log slow requests (over 1 second)
                if (duration > 1000) {
                    console.warn(`Slow request: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`);
                }

                // Track request metrics
                const route = `${req.method} ${req.route?.path || req.path}`;
                if (!this.metrics.has(route)) {
                    this.metrics.set(route, {
                        count: 0,
                        totalTime: 0,
                        avgTime: 0,
                        maxTime: 0,
                        minTime: Infinity
                    });
                }

                const metric = this.metrics.get(route);
                metric.count++;
                metric.totalTime += duration;
                metric.avgTime = metric.totalTime / metric.count;
                metric.maxTime = Math.max(metric.maxTime, duration);
                metric.minTime = Math.min(metric.minTime, duration);

                originalSend.call(this, data);
            }.bind(res);

            next();
        };
    }

    // Database query performance monitoring
    static monitorQuery(operation, query, callback) {
        const startTime = performance.now();
        
        return callback().then(result => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            if (duration > 500) { // Log queries over 500ms
                console.warn(`Slow query: ${operation} took ${duration.toFixed(2)}ms`);
                this.slowQueries.push({
                    operation,
                    query: JSON.stringify(query),
                    duration,
                    timestamp: new Date()
                });
            }
            
            return result;
        });
    }

    // Memory usage monitoring
    memoryMonitor() {
        return (req, res, next) => {
            const memUsage = process.memoryUsage();
            const memUsageMB = memUsage.heapUsed / 1024 / 1024;
            
            if (memUsageMB > 200) { // Alert if using more than 200MB
                console.warn(`High memory usage: ${memUsageMB.toFixed(2)}MB`);
            }
            
            next();
        };
    }

    // Rate limiting with performance tracking
    performanceRateLimit(windowMs = 60000, maxRequests = 100) {
        return (req, res, next) => {
            const clientId = req.ip || 'unknown';
            const now = Date.now();
            const windowStart = now - windowMs;
            
            if (!this.requestCounts.has(clientId)) {
                this.requestCounts.set(clientId, []);
            }
            
            const requests = this.requestCounts.get(clientId);
            
            // Remove old requests outside the window
            const validRequests = requests.filter(timestamp => timestamp > windowStart);
            
            if (validRequests.length >= maxRequests) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    retryAfter: Math.ceil(windowMs / 1000)
                });
            }
            
            validRequests.push(now);
            this.requestCounts.set(clientId, validRequests);
            
            next();
        };
    }

    // Get performance metrics
    getMetrics() {
        const metrics = {};
        
        for (const [route, data] of this.metrics) {
            metrics[route] = {
                ...data,
                avgTime: Math.round(data.avgTime * 100) / 100,
                maxTime: Math.round(data.maxTime * 100) / 100,
                minTime: data.minTime === Infinity ? 0 : Math.round(data.minTime * 100) / 100
            };
        }
        
        return {
            routes: metrics,
            slowQueries: this.slowQueries.slice(-10), // Last 10 slow queries
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    // Clear metrics
    clearMetrics() {
        this.metrics.clear();
        this.slowQueries = [];
        this.requestCounts.clear();
        this.errorCounts.clear();
    }
}

// Cache middleware for frequently accessed data
class CacheMiddleware {
    constructor(ttl = 300000) { // 5 minutes default TTL
        this.cache = new Map();
        this.ttl = ttl;
    }

    middleware() {
        return (req, res, next) => {
            // Only cache GET requests
            if (req.method !== 'GET') {
                return next();
            }

            const key = this.generateKey(req);
            const cached = this.cache.get(key);

            if (cached && Date.now() - cached.timestamp < this.ttl) {
                return res.json(cached.data);
            }

            const originalSend = res.send;
            res.send = function(data) {
                // Cache successful responses
                if (res.statusCode === 200) {
                    try {
                        const parsedData = JSON.parse(data);
                        this.cache.set(key, {
                            data: parsedData,
                            timestamp: Date.now()
                        });
                    } catch (e) {
                        // Ignore non-JSON responses
                    }
                }
                originalSend.call(this, data);
            }.bind(this);

            next();
        };
    }

    generateKey(req) {
        return `${req.method}:${req.path}:${JSON.stringify(req.query)}:${req.user?._id || 'anonymous'}`;
    }

    clear() {
        this.cache.clear();
    }

    getStats() {
        return {
            size: this.cache.size,
            ttl: this.ttl
        };
    }
}

// Database connection optimization
class DatabaseOptimizer {
    static optimizeMongoose(mongoose) {
        // Mongoose optimization settings are now configured in connection options
        console.log('Mongoose optimization settings applied via connection options');
        
        return mongoose;
    }

    static addIndexes() {
        // Add performance indexes
        const User = require('../models/User');
        const Project = require('../models/Project');
        const Key = require('../models/Key');
        const Analytics = require('../models/Analytics');

        // User indexes
        User.collection.createIndex({ email: 1 }, { unique: true });
        User.collection.createIndex({ username: 1 }, { unique: true });
        User.collection.createIndex({ 'apiKeys.key': 1 });

        // Project indexes
        Project.collection.createIndex({ owner: 1, createdAt: -1 });
        Project.collection.createIndex({ projectId: 1 }, { unique: true });
        Project.collection.createIndex({ active: 1 });

        // Key indexes
        Key.collection.createIndex({ keyString: 1 }, { unique: true });
        Key.collection.createIndex({ owner: 1, status: 1 });
        Key.collection.createIndex({ project: 1 });
        Key.collection.createIndex({ linkedUserId: 1 });
        Key.collection.createIndex({ expiresAt: 1 });

        // Analytics indexes
        Analytics.collection.createIndex({ eventType: 1, timestamp: -1 });
        Analytics.collection.createIndex({ userId: 1, timestamp: -1 });
        Analytics.collection.createIndex({ projectId: 1, timestamp: -1 });
        Analytics.collection.createIndex({ timestamp: -1 });
    }
}

module.exports = {
    PerformanceMonitor,
    CacheMiddleware,
    DatabaseOptimizer
};
