// Performance Monitoring Routes
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get performance metrics (admin only)
router.get('/metrics', authenticateToken, requireAdmin, (req, res) => {
    try {
        const performanceMonitor = req.app.get('performanceMonitor');
        const cacheMiddleware = req.app.get('cacheMiddleware');
        
        const metrics = performanceMonitor ? performanceMonitor.getMetrics() : {};
        const cacheStats = cacheMiddleware ? cacheMiddleware.getStats() : {};
        
        res.json({
            success: true,
            data: {
                performance: metrics,
                cache: cacheStats,
                system: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    pid: process.pid
                }
            }
        });
    } catch (error) {
        console.error('Performance metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get performance metrics'
        });
    }
});

// Clear performance metrics (admin only)
router.post('/metrics/clear', authenticateToken, requireAdmin, (req, res) => {
    try {
        const performanceMonitor = req.app.get('performanceMonitor');
        const cacheMiddleware = req.app.get('cacheMiddleware');
        
        if (performanceMonitor) {
            performanceMonitor.clearMetrics();
        }
        
        if (cacheMiddleware) {
            cacheMiddleware.clear();
        }
        
        res.json({
            success: true,
            message: 'Performance metrics cleared'
        });
    } catch (error) {
        console.error('Clear metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear metrics'
        });
    }
});

module.exports = router;
