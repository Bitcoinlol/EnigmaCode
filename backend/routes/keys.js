const express = require('express');
const Key = require('../models/Key');
const Project = require('../models/Project');
const Analytics = require('../models/Analytics');
const { authenticateToken } = require('../middleware/auth');
const webhookService = require('../services/webhook');

const router = express.Router();

// Get all keys for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, projectId, search } = req.query;
    
    const query = { owner: req.user._id };
    
    if (status) query.status = status;
    if (projectId) {
      const project = await Project.findOne({ projectId, owner: req.user._id });
      if (project) query.project = project._id;
    }
    if (search) {
      query.$or = [
        { keyString: { $regex: search, $options: 'i' } },
        { linkedUserId: { $regex: search, $options: 'i' } }
      ];
    }

    const keys = await Key.find(query)
      .populate('project', 'name projectId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Key.countDocuments(query);

    res.json({
      keys,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Keys fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

// Get specific key
router.get('/:keyId', authenticateToken, async (req, res) => {
  try {
    const key = await Key.findOne({
      keyId: req.params.keyId,
      owner: req.user._id
    }).populate('project', 'name projectId');

    if (!key) {
      return res.status(404).json({ error: 'Key not found' });
    }

    res.json({ key });
  } catch (error) {
    console.error('Key fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch key' });
  }
});

// Create new key
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { projectId, type = 'permanent', linkedUserId, expiresAt, restrictions } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Verify project ownership
    const project = await Project.findOne({
      projectId,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create key
    const key = new Key({
      project: project._id,
      owner: req.user._id,
      type,
      linkedUserId,
      restrictions: restrictions || {}
    });

    if (type === 'custom' && expiresAt) {
      key.expiresAt = new Date(expiresAt);
    }

    await key.save();

    // Update project and user stats
    await Promise.all([
      Project.findByIdAndUpdate(project._id, {
        $inc: { 'stats.totalKeys': 1, 'stats.activeKeys': 1 }
      }),
      User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.totalKeys': 1 }
      })
    ]);

    // Send webhook notification
    await webhookService.sendNotification('key_created', {
      type: key.type,
      projectName: project.name,
      expiration: key.expiresAt
    }, req.user._id);

    res.status(201).json({
      message: 'Key created successfully',
      key: {
        keyId: key.keyId,
        keyString: key.keyString,
        type: key.type,
        status: key.status,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt
      }
    });
  } catch (error) {
    console.error('Key creation error:', error);
    res.status(500).json({ error: 'Failed to create key' });
  }
});

// Update key
router.put('/:keyId', authenticateToken, async (req, res) => {
  try {
    const { status, linkedUserId, restrictions } = req.body;

    const key = await Key.findOne({
      keyId: req.params.keyId,
      owner: req.user._id
    });

    if (!key) {
      return res.status(404).json({ error: 'Key not found' });
    }

    if (status) key.status = status;
    if (linkedUserId !== undefined) key.linkedUserId = linkedUserId;
    if (restrictions) key.restrictions = { ...key.restrictions, ...restrictions };

    await key.save();

    res.json({
      message: 'Key updated successfully',
      key
    });
  } catch (error) {
    console.error('Key update error:', error);
    res.status(500).json({ error: 'Failed to update key' });
  }
});

// Ban key
router.post('/:keyId/ban', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;

    const key = await Key.findOne({
      keyId: req.params.keyId,
      owner: req.user._id
    }).populate('project');

    if (!key) {
      return res.status(404).json({ error: 'Key not found' });
    }

    key.ban(reason || 'Manual ban', req.user._id);
    await key.save();

    // Log ban event
    await Analytics.logEvent('ban', req.user._id, key.project._id, key._id, {
      banReason: reason,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send webhook notification
    await webhookService.sendNotification('key_banned', {
      keyId: key.keyId,
      reason: reason || 'Manual ban',
      projectName: key.project.name
    }, req.user._id);

    // Update project stats
    await Project.findByIdAndUpdate(key.project._id, {
      $inc: { 'stats.activeKeys': -1 }
    });

    res.json({
      message: 'Key banned successfully',
      key: {
        keyId: key.keyId,
        status: key.status,
        banInfo: key.banInfo
      }
    });
  } catch (error) {
    console.error('Key ban error:', error);
    res.status(500).json({ error: 'Failed to ban key' });
  }
});

// Reset key (generate new key string)
router.post('/:keyId/reset', authenticateToken, async (req, res) => {
  try {
    const key = await Key.findOne({
      keyId: req.params.keyId,
      owner: req.user._id
    });

    if (!key) {
      return res.status(404).json({ error: 'Key not found' });
    }

    // Generate new key string
    const crypto = require('crypto');
    key.keyString = `ek_${crypto.randomBytes(24).toString('hex')}`;
    key.status = 'active';
    key.banInfo.isBanned = false;
    key.banInfo.bannedAt = null;
    key.banInfo.banReason = null;
    key.usage.totalActivations = 0;
    key.usage.activationHistory = [];

    await key.save();

    res.json({
      message: 'Key reset successfully',
      key: {
        keyId: key.keyId,
        keyString: key.keyString,
        status: key.status
      }
    });
  } catch (error) {
    console.error('Key reset error:', error);
    res.status(500).json({ error: 'Failed to reset key' });
  }
});

// Delete key
router.delete('/:keyId', authenticateToken, async (req, res) => {
  try {
    const key = await Key.findOne({
      keyId: req.params.keyId,
      owner: req.user._id
    }).populate('project');

    if (!key) {
      return res.status(404).json({ error: 'Key not found' });
    }

    await Key.findByIdAndDelete(key._id);

    // Update stats
    await Promise.all([
      Project.findByIdAndUpdate(key.project._id, {
        $inc: { 
          'stats.totalKeys': -1,
          'stats.activeKeys': key.status === 'active' ? -1 : 0
        }
      }),
      User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.totalKeys': -1 }
      })
    ]);

    res.json({ message: 'Key deleted successfully' });
  } catch (error) {
    console.error('Key deletion error:', error);
    res.status(500).json({ error: 'Failed to delete key' });
  }
});

// Get key usage analytics
router.get('/:keyId/analytics', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;

    const key = await Key.findOne({
      keyId: req.params.keyId,
      owner: req.user._id
    });

    if (!key) {
      return res.status(404).json({ error: 'Key not found' });
    }

    // Get activation history for the timeframe
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
    }

    const recentActivations = key.usage.activationHistory.filter(
      activation => activation.timestamp >= startDate
    );

    // Group by date
    const dailyStats = {};
    recentActivations.forEach(activation => {
      const date = activation.timestamp.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { successful: 0, failed: 0 };
      }
      if (activation.success) {
        dailyStats[date].successful++;
      } else {
        dailyStats[date].failed++;
      }
    });

    res.json({
      keyId: key.keyId,
      totalActivations: key.usage.totalActivations,
      recentActivations: recentActivations.length,
      dailyStats,
      lastUsed: key.usage.lastUsed
    });
  } catch (error) {
    console.error('Key analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch key analytics' });
  }
});

module.exports = router;
