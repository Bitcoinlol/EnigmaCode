const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive || user.isBanned) {
      return res.status(401).json({ error: 'Invalid or banned user' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const user = await User.findOne({
      'apiKeys.key': apiKey,
      'apiKeys.isActive': true
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Update last used timestamp
    const keyIndex = user.apiKeys.findIndex(k => k.key === apiKey);
    if (keyIndex !== -1) {
      user.apiKeys[keyIndex].lastUsed = new Date();
      await user.save();
    }

    req.user = user;
    req.apiKey = apiKey;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'API key validation failed' });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  validateApiKey
};
