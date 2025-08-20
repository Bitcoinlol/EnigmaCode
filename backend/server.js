const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const keyRoutes = require('./routes/keys');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const apiRoutes = require('./routes/api');
const loaderRoutes = require('./routes/loader');
const webhookRoutes = require('./routes/webhooks');
const subscriptionRoutes = require('./routes/subscription');
const jobScheduler = require('./jobs/scheduler');
const { PerformanceMonitor, CacheMiddleware, DatabaseOptimizer } = require('./middleware/performance');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize performance monitoring
const performanceMonitor = new PerformanceMonitor();
const cacheMiddleware = new CacheMiddleware();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3000',
  credentials: true
}));

// Performance monitoring middleware
app.use(performanceMonitor.requestTimer());
app.use(performanceMonitor.memoryMonitor());

// Cache middleware for GET requests
app.use(cacheMiddleware.middleware());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/api', apiRoutes);
app.use('/api/loader', loaderRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/performance', require('./routes/performance'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Store performance instances in app for access in routes
app.set('performanceMonitor', performanceMonitor);
app.set('cacheMiddleware', cacheMiddleware);

// Database connection with optimization
DatabaseOptimizer.optimizeMongoose(mongoose);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/enigmacode', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  
  // Add database indexes for performance
  DatabaseOptimizer.addIndexes();
  
  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 EnigmaCode Platform running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    console.log(`⚡ Performance monitoring enabled`);
    
    // Start job scheduler
    jobScheduler.start();
  });
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
