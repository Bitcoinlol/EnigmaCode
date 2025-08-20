const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['activation', 'error', 'tamper', 'ban', 'registration', 'login'],
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  keyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Key',
    default: null
  },
  data: {
    ip: String,
    userAgent: String,
    robloxUserId: String,
    errorCode: String,
    errorMessage: String,
    tamperType: String,
    banReason: String,
    additionalData: mongoose.Schema.Types.Mixed
  },
  metadata: {
    country: String,
    region: String,
    city: String,
    isp: String,
    device: String,
    browser: String,
    os: String
  }
}, {
  timestamps: true
});

// Index for efficient querying
analyticsSchema.index({ type: 1, createdAt: -1 });
analyticsSchema.index({ userId: 1, createdAt: -1 });
analyticsSchema.index({ projectId: 1, createdAt: -1 });

// Static method to log events
analyticsSchema.statics.logEvent = function(type, data = {}) {
  return this.create({
    type,
    userId: data.userId || null,
    projectId: data.projectId || null,
    keyId: data.keyId || null,
    data: {
      ip: data.ip,
      userAgent: data.userAgent,
      robloxUserId: data.robloxUserId,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      tamperType: data.tamperType,
      banReason: data.banReason,
      additionalData: data.additionalData
    },
    metadata: data.metadata || {}
  });
};

// Get analytics for dashboard
analyticsSchema.statics.getDashboardStats = async function(userId, timeframe = '7d') {
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

  const pipeline = [
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
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
  ];

  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Analytics', analyticsSchema);
