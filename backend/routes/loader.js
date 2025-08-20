const express = require('express');
const Key = require('../models/Key');
const Project = require('../models/Project');
const Analytics = require('../models/Analytics');
const User = require('../models/User');
const webhookService = require('../services/webhook');

const router = express.Router();

// Validate key and return obfuscated code
router.get('/validate', async (req, res) => {
  try {
    const projectId = req.headers['x-project-id'];
    const userKey = req.headers['x-user-key'];
    const userId = req.headers['x-user-id'];
    const userAgent = req.get('User-Agent');
    const ip = req.ip;

    if (!projectId || !userKey) {
      await Analytics.logEvent('error', {
        errorCode: 'MISSING_HEADERS',
        errorMessage: 'Missing required headers',
        ip,
        userAgent
      });
      return res.status(400).json({ valid: false, error: 'Missing required headers' });
    }

    // Find project
    const project = await Project.findOne({ projectId });
    if (!project || !project.isActive) {
      await Analytics.logEvent('error', {
        projectId: project?._id,
        errorCode: 'PROJECT_NOT_FOUND',
        errorMessage: 'Project not found or inactive',
        ip,
        userAgent
      });
      return res.status(404).json({ valid: false, error: 'Project not found' });
    }

    // Find key
    const key = await Key.findOne({ 
      keyString: userKey,
      project: project._id
    });

    if (!key) {
      await Analytics.logEvent('error', {
        projectId: project._id,
        errorCode: 'KEY_NOT_FOUND',
        errorMessage: 'Key not found',
        ip,
        userAgent,
        robloxUserId: userId
      });
      return res.status(401).json({ valid: false, error: 'Invalid key' });
    }

    // Check if key is valid
    if (!key.isValid()) {
      let errorCode = 'KEY_INVALID';
      let errorMessage = 'Key is invalid';
      
      if (key.status === 'banned') {
        errorCode = 'KEY_BANNED';
        errorMessage = 'Key is banned';
      } else if (key.isExpired()) {
        errorCode = 'KEY_EXPIRED';
        errorMessage = 'Key has expired';
      }

      key.recordActivation(userId, ip, userAgent, false, errorCode);
      await key.save();

      await Analytics.logEvent('error', key.owner, project._id, key._id, {
        errorCode,
        errorMessage,
        ip,
        userAgent,
        robloxUserId: userId
      });

      return res.status(401).json({ valid: false, error: errorMessage });
    }

    // Check user ID restrictions
    if (key.linkedUserId && key.linkedUserId !== userId) {
      key.recordActivation(userId, ip, userAgent, false, 'USER_ID_MISMATCH');
      await key.save();

      await Analytics.logEvent('error', {
        projectId: project._id,
        keyId: key._id,
        errorCode: 'USER_ID_MISMATCH',
        errorMessage: 'Key is linked to different user',
        ip,
        userAgent,
        robloxUserId: userId
      });

      return res.status(401).json({ valid: false, error: 'Key not authorized for this user' });
    }

    // Check IP restrictions
    if (key.restrictions.allowedIPs && key.restrictions.allowedIPs.length > 0) {
      if (!key.restrictions.allowedIPs.includes(ip)) {
        // Check for tamper detection header
        const tamperDetected = req.headers['x-user-key'] === 'TAMPER_DETECTED';
        
        if (tamperDetected) {
          // Log tamper attempt
          await Analytics.logEvent('tamper', null, project._id, null, {
            ip,
            userAgent,
            robloxUserId: userId,
            detectionType: 'loader_integrity'
          });

          // Send webhook notification for tamper detection
          await webhookService.sendNotification('tamper_detected', {
            projectName: project.name,
            userId: userId,
            detectionType: 'loader_integrity',
            ipAddress: ip
          });

          // Ban all keys for this user if user ID is provided
          if (userId) {
            await Key.updateMany(
              { linkedUserId: userId },
              { 
                status: 'banned',
                'ban.reason': 'Tamper detection',
                'ban.bannedAt': new Date(),
                'ban.bannedBy': 'system'
              }
            );
          }

          return res.status(401).json({ valid: false, error: 'Access denied' });
        }
      }
    }

    // Check activation limits
    if (key.restrictions.maxActivations && 
        key.usage.totalActivations >= key.restrictions.maxActivations) {
      key.recordActivation(userId, ip, userAgent, false, 'MAX_ACTIVATIONS_REACHED');
      await key.save();

      await Analytics.logEvent('error', key.owner, project._id, key._id, {
        errorCode: 'MAX_ACTIVATIONS_REACHED',
        errorMessage: 'Maximum activations reached',
        ip,
        userAgent,
        robloxUserId: userId
      });

      return res.status(401).json({ valid: false, error: 'Activation limit reached' });
    }

    // Successful validation
    key.recordActivation(userId, ip, userAgent, true);
    await key.save();

    // Update project stats
    project.stats.totalActivations += 1;
    project.stats.lastActivation = new Date();
    await project.save();

    // Log successful activation
    await Analytics.logEvent('activation', key.owner, project._id, key._id, {
      ip,
      userAgent,
      robloxUserId: userId
    });

    // Return obfuscated code
    res.json({
      valid: true,
      code: project.obfuscatedCode,
      keyInfo: {
        type: key.type,
        expiresAt: key.expiresAt,
        activations: key.usage.totalActivations
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    
    await Analytics.logEvent('error', null, null, null, {
      errorCode: 'VALIDATION_ERROR',
      errorMessage: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
});

// Health check for loader service
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'EnigmaCode Loader',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
