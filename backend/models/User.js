const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'standard', 'premium'],
      default: 'free'
    },
    expiresAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  apiKeys: [{
    keyId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    key: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  settings: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    discordWebhook: {
      type: String,
      default: null
    },
    emailNotifications: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    totalProjects: {
      type: Number,
      default: 0
    },
    totalKeys: {
      type: Number,
      default: 0
    },
    totalActiveUsers: {
      type: Number,
      default: 0
    },
    totalBannedUsers: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const saltRounds = parseInt(process.env.HASH_SALT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate API key
userSchema.methods.generateApiKey = function(name) {
  const crypto = require('crypto');
  const keyId = crypto.randomUUID();
  const key = `ek_${crypto.randomBytes(32).toString('hex')}`;
  
  this.apiKeys.push({
    keyId,
    name,
    key,
    createdAt: new Date(),
    isActive: true
  });
  
  return { keyId, key };
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.apiKeys;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
