const mongoose = require('mongoose');

const keySchema = new mongoose.Schema({
  keyId: {
    type: String,
    required: true,
    unique: true
  },
  keyString: {
    type: String,
    required: true,
    unique: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['permanent', '30days', '90days', '1year', 'custom'],
    default: 'permanent'
  },
  expiresAt: {
    type: Date,
    default: null
  },
  linkedUserId: {
    type: String,
    default: null // Roblox User ID or other platform ID
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned', 'expired'],
    default: 'active'
  },
  usage: {
    totalActivations: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: null
    },
    lastUserAgent: {
      type: String,
      default: null
    },
    lastIP: {
      type: String,
      default: null
    },
    activationHistory: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      userId: String,
      ip: String,
      userAgent: String,
      success: Boolean,
      errorCode: String
    }]
  },
  restrictions: {
    maxActivations: {
      type: Number,
      default: null // null = unlimited
    },
    allowedIPs: [{
      type: String
    }],
    allowedUserIds: [{
      type: String
    }]
  },
  banInfo: {
    isBanned: {
      type: Boolean,
      default: false
    },
    bannedAt: {
      type: Date,
      default: null
    },
    banReason: {
      type: String,
      default: null
    },
    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  }
}, {
  timestamps: true
});

// Generate unique key ID and string
keySchema.pre('save', function(next) {
  if (!this.keyId) {
    const crypto = require('crypto');
    this.keyId = crypto.randomUUID();
    this.keyString = `ek_${crypto.randomBytes(24).toString('hex')}`;
  }
  next();
});

// Set expiration date based on type
keySchema.pre('save', function(next) {
  if (this.isNew && this.type !== 'permanent' && this.type !== 'custom') {
    const now = new Date();
    switch (this.type) {
      case '30days':
        this.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        this.expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        this.expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        break;
    }
  }
  next();
});

// Check if key is expired
keySchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Check if key is valid for use
keySchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  if (this.banInfo.isBanned) return false;
  if (this.isExpired()) {
    this.status = 'expired';
    return false;
  }
  return true;
};

// Record activation
keySchema.methods.recordActivation = function(userId, ip, userAgent, success = true, errorCode = null) {
  this.usage.totalActivations += 1;
  this.usage.lastUsed = new Date();
  this.usage.lastUserAgent = userAgent;
  this.usage.lastIP = ip;
  
  this.usage.activationHistory.push({
    timestamp: new Date(),
    userId,
    ip,
    userAgent,
    success,
    errorCode
  });
  
  // Keep only last 100 activation records
  if (this.usage.activationHistory.length > 100) {
    this.usage.activationHistory = this.usage.activationHistory.slice(-100);
  }
};

// Ban key
keySchema.methods.ban = function(reason, bannedBy) {
  this.status = 'banned';
  this.banInfo.isBanned = true;
  this.banInfo.bannedAt = new Date();
  this.banInfo.banReason = reason;
  this.banInfo.bannedBy = bannedBy;
};

module.exports = mongoose.model('Key', keySchema);
