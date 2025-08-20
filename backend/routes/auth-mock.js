const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mockDb = require('../mock-db');

const router = express.Router();

// Mock register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUserByEmail = await mockDb.findUserByEmail(email);
    const existingUserByUsername = await mockDb.findUserByUsername(username);

    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await mockDb.createUser({
      username,
      email,
      password: hashedPassword
    });

    // Log registration
    await mockDb.logEvent('registration', user._id, null, null, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Mock login with key endpoint
router.post('/login-key', async (req, res) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'License key is required' });
    }

    // Validate key format
    if (key.length < 10) {
      return res.status(400).json({ error: 'Invalid key format' });
    }

    // Determine subscription tier based on key prefix
    let subscriptionTier = 'free';
    let expiresIn = '30d';
    
    if (key.startsWith('FREE-')) {
      subscriptionTier = 'free';
      expiresIn = '30d';
    } else if (key.startsWith('PREMIUM-')) {
      subscriptionTier = 'premium';
      expiresIn = '365d';
    } else if (key.startsWith('PRO-')) {
      subscriptionTier = 'pro';
      expiresIn = '365d';
    }

    // Create or find user based on key
    let user = await mockDb.findUserByKey(key);
    if (!user) {
      // Create new user for this key
      user = await mockDb.createUser({
        username: `User_${key.slice(-8)}`,
        email: `user_${key.slice(-8)}@enigmacode.com`,
        password: await bcrypt.hash(key, 12),
        licenseKey: key,
        subscription: { tier: subscriptionTier }
      });
    }

    if (!user.isActive || user.isBanned) {
      return res.status(401).json({ error: 'Account disabled' });
    }

    // Update last login
    user.lastLogin = new Date();

    // Log login
    await mockDb.logEvent('key_login', user._id, null, null, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      keyUsed: key.substring(0, 8) + '...'
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, keyTier: subscriptionTier },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        subscription: user.subscription,
        stats: user.stats,
        keyExpiry: subscriptionTier === 'free' ? '30 days' : '1 year'
      }
    });
  } catch (error) {
    console.error('Key login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Mock login endpoint (legacy)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username or email
    let user = await mockDb.findUserByUsername(username);
    if (!user) {
      user = await mockDb.findUserByEmail(username);
    }

    if (!user || !user.isActive || user.isBanned) {
      return res.status(401).json({ error: 'Invalid credentials or account disabled' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();

    // Log login
    await mockDb.logEvent('login', user._id, null, null, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        subscription: user.subscription,
        stats: user.stats
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
