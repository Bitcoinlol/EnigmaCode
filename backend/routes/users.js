const express = require('express');
const User = require('../models/User');
const Key = require('../models/Key');
const Analytics = require('../models/Analytics');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (status === 'banned') query.isBanned = true;
    if (status === 'active') query.isActive = true;

    const users = await User.find(query)
      .select('-password -apiKeys')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get specific user details (admin only)
router.get('/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -apiKeys');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's keys
    const keys = await Key.find({ owner: user._id })
      .populate('project', 'name projectId')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get recent activity
    const recentActivity = await Analytics.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      user,
      keys,
      recentActivity
    });
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Ban user (admin only)
router.post('/:userId/ban', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isBanned = true;
    user.banReason = reason || 'Manual ban by admin';
    user.isActive = false;
    await user.save();

    // Ban all user's keys
    await Key.updateMany(
      { owner: user._id, status: 'active' },
      { 
        status: 'banned',
        'banInfo.isBanned': true,
        'banInfo.bannedAt': new Date(),
        'banInfo.banReason': 'User banned',
        'banInfo.bannedBy': req.user._id
      }
    );

    // Log ban event
    await Analytics.logEvent('ban', {
      userId: user._id,
      banReason: reason,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      additionalData: { bannedBy: req.user._id }
    });

    res.json({
      message: 'User banned successfully',
      user: {
        id: user._id,
        username: user.username,
        isBanned: user.isBanned,
        banReason: user.banReason
      }
    });
  } catch (error) {
    console.error('User ban error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user (admin only)
router.post('/:userId/unban', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isBanned = false;
    user.banReason = null;
    user.isActive = true;
    await user.save();

    res.json({
      message: 'User unbanned successfully',
      user: {
        id: user._id,
        username: user.username,
        isBanned: user.isBanned
      }
    });
  } catch (error) {
    console.error('User unban error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// Get user analytics (admin only)
router.get('/:userId/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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

    // Get activity stats
    const activityStats = await Analytics.aggregate([
      {
        $match: {
          userId: user._id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get daily activity
    const dailyActivity = await Analytics.aggregate([
      {
        $match: {
          userId: user._id,
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
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    res.json({
      userId: user._id,
      username: user.username,
      activityStats,
      dailyActivity,
      timeframe
    });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

// Get platform-wide user stats (for current user's dashboard)
router.get('/stats/platform', authenticateToken, async (req, res) => {
  try {
    // Get user's keys and their associated users
    const userKeys = await Key.find({ owner: req.user._id })
      .populate('project', 'name');

    // Extract unique user IDs from key activations
    const uniqueUsers = new Set();
    const bannedUsers = new Set();
    
    for (const key of userKeys) {
      for (const activation of key.usage.activationHistory) {
        if (activation.userId) {
          uniqueUsers.add(activation.userId);
        }
      }
      
      if (key.banInfo.isBanned && key.linkedUserId) {
        bannedUsers.add(key.linkedUserId);
      }
    }

    res.json({
      totalActiveUsers: uniqueUsers.size,
      totalBannedUsers: bannedUsers.size,
      totalKeys: userKeys.length,
      activeKeys: userKeys.filter(k => k.status === 'active').length
    });
  } catch (error) {
    console.error('Platform stats error:', error);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

module.exports = router;
