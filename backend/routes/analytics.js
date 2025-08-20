const express = require('express');
const Analytics = require('../models/Analytics');
const Key = require('../models/Key');
const Project = require('../models/Project');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    const startDate = new Date();
    switch (timeframe) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    // Get user's projects
    const userProjects = await Project.find({ owner: req.user._id });
    const projectIds = userProjects.map(p => p._id);

    // Get analytics for user's projects
    const analytics = await Analytics.find({
      projectId: { $in: projectIds },
      createdAt: { $gte: startDate }
    }).sort({ createdAt: -1 });

    // Group by type and date
    const dailyStats = {};
    const typeStats = {};

    analytics.forEach(event => {
      const date = event.createdAt.toISOString().split('T')[0];
      const type = event.type;

      if (!dailyStats[date]) {
        dailyStats[date] = {};
      }
      if (!dailyStats[date][type]) {
        dailyStats[date][type] = 0;
      }
      dailyStats[date][type]++;

      if (!typeStats[type]) {
        typeStats[type] = 0;
      }
      typeStats[type]++;
    });

    // Get recent activity feed
    const recentActivity = await Analytics.find({
      projectId: { $in: projectIds }
    })
    .populate('projectId', 'name projectId')
    .populate('keyId', 'keyString')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json({
      dailyStats,
      typeStats,
      recentActivity,
      totalEvents: analytics.length,
      timeframe
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get usage graphs
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '30d', type = 'activation' } = req.query;
    
    const startDate = new Date();
    switch (timeframe) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    const userProjects = await Project.find({ owner: req.user._id });
    const projectIds = userProjects.map(p => p._id);

    const pipeline = [
      {
        $match: {
          projectId: { $in: projectIds },
          type: type,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            hour: timeframe === '24h' ? {
              $dateToString: {
                format: '%H',
                date: '$createdAt'
              }
            } : null
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1, '_id.hour': 1 }
      }
    ];

    const usageData = await Analytics.aggregate(pipeline);

    res.json({
      type,
      timeframe,
      data: usageData
    });
  } catch (error) {
    console.error('Usage analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch usage analytics' });
  }
});

// Get error logs
router.get('/errors', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, errorCode } = req.query;
    
    const userProjects = await Project.find({ owner: req.user._id });
    const projectIds = userProjects.map(p => p._id);

    const query = {
      projectId: { $in: projectIds },
      type: 'error'
    };

    if (errorCode) {
      query['data.errorCode'] = errorCode;
    }

    const errors = await Analytics.find(query)
      .populate('projectId', 'name projectId')
      .populate('keyId', 'keyString')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Analytics.countDocuments(query);

    // Get error code distribution
    const errorDistribution = await Analytics.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          type: 'error'
        }
      },
      {
        $group: {
          _id: '$data.errorCode',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      errors,
      errorDistribution,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

// Get tamper detection logs
router.get('/tamper', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const userProjects = await Project.find({ owner: req.user._id });
    const projectIds = userProjects.map(p => p._id);

    const tamperEvents = await Analytics.find({
      projectId: { $in: projectIds },
      type: 'tamper'
    })
    .populate('projectId', 'name projectId')
    .populate('keyId', 'keyString')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Analytics.countDocuments({
      projectId: { $in: projectIds },
      type: 'tamper'
    });

    res.json({
      tamperEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Tamper logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch tamper logs' });
  }
});

// Get project-specific analytics
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    const project = await Project.findOne({
      projectId: req.params.projectId,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const startDate = new Date();
    switch (timeframe) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    // Get project analytics
    const analytics = await Analytics.find({
      projectId: project._id,
      createdAt: { $gte: startDate }
    }).sort({ createdAt: -1 });

    // Get project keys
    const keys = await Key.find({ project: project._id });

    // Calculate unique users
    const uniqueUsers = new Set();
    keys.forEach(key => {
      key.usage.activationHistory.forEach(activation => {
        if (activation.userId && activation.timestamp >= startDate) {
          uniqueUsers.add(activation.userId);
        }
      });
    });

    // Group analytics by type and date
    const dailyStats = {};
    analytics.forEach(event => {
      const date = event.createdAt.toISOString().split('T')[0];
      const type = event.type;

      if (!dailyStats[date]) {
        dailyStats[date] = {};
      }
      if (!dailyStats[date][type]) {
        dailyStats[date][type] = 0;
      }
      dailyStats[date][type]++;
    });

    res.json({
      projectId: project.projectId,
      projectName: project.name,
      dailyStats,
      uniqueUsers: uniqueUsers.size,
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.status === 'active').length,
      totalActivations: keys.reduce((sum, key) => sum + key.usage.totalActivations, 0),
      timeframe
    });
  } catch (error) {
    console.error('Project analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch project analytics' });
  }
});

module.exports = router;
