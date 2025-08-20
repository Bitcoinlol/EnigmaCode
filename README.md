# EnigmaCode Platform

A comprehensive software licensing and obfuscation platform designed to compete with and surpass existing solutions like Luarmor.

## Architecture Overview

### Backend
- **Framework**: Node.js with Express
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based with bcrypt password hashing
- **Security**: Helmet, CORS, rate limiting, and comprehensive logging

### Frontend
- **Framework**: Modern HTML5/CSS3/JavaScript with responsive design
- **Theme**: Black and purple professional UI
- **Features**: Complete dashboard with real-time updates

### Obfuscation Engine
- **Standard Tier**: String encryption, variable renaming, anti-debugging
- **Premium Tier**: Control-flow flattening, bytecode encryption, virtualization
- **Anti-Tamper**: Integrity checks with global banning system

### Client Loader
- **Language**: Lua
- **Features**: HTTP validation, secure streaming, in-memory execution
- **Security**: Tamper resistance, silent failure modes

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the development server:
```bash
npm run dev
```

4. Access the platform at `http://localhost:3000`

## Project Structure

```
EnigmaCode/
├── backend/           # Node.js REST API
├── frontend/          # Web interface
├── obfuscation-engine/# Lua obfuscation system
├── client-loader/     # Tamper-resistant Lua loader
└── docs/             # API documentation
```

## Features

- **Complete User Management**: Registration, authentication, dashboard
- **Project Management**: Upload, obfuscate, and manage Lua scripts
- **Key Management**: Generate, revoke, and monitor license keys
- **User Monitoring**: Track usage, ban users, view analytics
- **API Management**: Generate API keys, interactive documentation
- **Real-time Analytics**: Usage graphs, error logs, tamper detection
- **Webhook Integration**: Discord notifications for key events

## Security Features

- JWT-based authentication
- Rate limiting and DDoS protection
- Encrypted password storage
- Tamper-resistant client loader
- Global user banning system
- Comprehensive audit logging

## License

MIT License - See LICENSE file for details

### EnigmaCode - Lua Obfuscation & Licensing Platform

A comprehensive, production-ready platform for Lua script obfuscation and software licensing with advanced tamper resistance, subscription management, and enterprise-grade deployment capabilities.

## 🚀 Features

### Core Platform
- **Multi-tier Lua Obfuscation**: Basic, Premium, and Enterprise obfuscation levels
- **Tamper-resistant Client Loader**: Advanced anti-debugging and integrity verification
- **User Authentication**: Secure JWT-based authentication system
- **Project Management**: Upload, obfuscate, and manage Lua projects
- **License Key System**: Generate and validate software licenses with expiration

### Advanced Features
- **Analytics Dashboard**: Real-time usage statistics and monitoring
- **Subscription Management**: Free, Premium, and Enterprise tiers with automatic billing
- **Webhook Integrations**: Discord notifications for key events and security alerts
- **Performance Monitoring**: Request timing, memory usage, caching, and optimization
- **Automated Jobs**: Scheduled maintenance, cleanup, and reporting tasks
- **Load Balancing**: Nginx reverse proxy with SSL termination and rate limiting

### Security & Monitoring
- **Tamper Detection**: Real-time monitoring with automatic key banning
- **Rate Limiting**: API protection with configurable limits per tier
- **SSL/TLS**: Full HTTPS support with Let's Encrypt integration
- **Health Monitoring**: Comprehensive health checks and alerting
- **Backup & Restore**: Automated backup system with point-in-time recovery

## 🏗️ Architecture

```
Internet → Nginx (SSL/Rate Limiting) → API Server → MongoDB
                                    ↓
                               Redis (Cache/Sessions)
                                    ↓
                            Monitoring (Prometheus/Grafana)
```

## 📦 Quick Start

### Development Setup
```bash
git clone <repository-url>
cd EnigmaCode
cp .env.example .env
npm install
npm run dev
```

### Production Deployment
```bash
cp .env.production.example .env.production
# Edit .env.production with your values
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

Access the platform at `http://localhost:3000` (dev) or your configured domain (prod).

## 📁 Project Structure

```
EnigmaCode/
├── backend/              # Node.js Express API
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   ├── middleware/      # Custom middleware
│   ├── models/          # Database models
│   └── jobs/            # Scheduled tasks
├── frontend/            # React dashboard
├── client-loader/       # Lua loader templates
├── tests/              # Comprehensive test suites
├── scripts/            # Deployment & utility scripts
├── nginx/              # Reverse proxy configuration
├── monitoring/         # Prometheus configuration
└── docs/               # Documentation
```

## 🔧 Configuration

### Required Environment Variables
```env
# Database
MONGODB_URI=mongodb://user:pass@host:27017/enigmacode
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=your-super-secure-jwt-secret
ENCRYPTION_KEY=your-32-character-encryption-key
LOADER_INTEGRITY_KEY=your-loader-integrity-key

# Integrations
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
STRIPE_SECRET_KEY=sk_live_your-stripe-key

# Email
SMTP_HOST=smtp.your-provider.com
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
```

### Optional Configuration
```env
# Performance
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=900000

# SSL
SSL_DOMAIN=your-domain.com
CORS_ORIGIN=https://your-domain.com
```

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `GET /api/auth/profile` - Get user profile

### Project Management
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create/upload new project
- `GET /api/projects/:id` - Get project details
- `DELETE /api/projects/:id` - Delete project

### License Keys
- `GET /api/keys` - List license keys
- `POST /api/keys` - Generate new license key
- `PUT /api/keys/:id/ban` - Ban license key
- `POST /api/loader/validate` - Validate loader request

### Subscription Management
- `GET /api/subscription/plans` - Available subscription plans
- `GET /api/subscription/current` - Current user subscription
- `POST /api/subscription/upgrade` - Upgrade subscription
- `POST /api/subscription/cancel` - Cancel subscription

### Analytics & Monitoring
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/usage` - Usage analytics
- `GET /api/performance/metrics` - Performance metrics
- `GET /api/health` - System health check

## 🧪 Testing & Quality Assurance

### Test Suites
```bash
npm test                    # Full test suite
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
npm run test:performance   # Performance tests
```

### Benchmarking & Load Testing
```bash
npm run benchmark          # API performance benchmarks
npm run load-test         # Standard load test
npm run load-test:light   # Light load (10 users)
npm run load-test:heavy   # Heavy load (100 users)
```

### Health Monitoring
```bash
./scripts/health-check.sh        # Full health check
./scripts/health-check.sh quick  # Quick check
./scripts/health-check.sh api    # API-only check
```

## 🚀 Deployment

### Docker Deployment
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment
```bash
# Using deployment script
./scripts/deploy.sh production

# Manual steps
npm ci --production
npm run build
node backend/server.js
```

### Backup & Restore
```bash
# Create backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh YYYYMMDD_HHMMSS
```

## 📊 Monitoring & Analytics

### Built-in Monitoring
- **Health Checks**: Automatic endpoint monitoring
- **Performance Metrics**: Response times, memory usage, error rates
- **Security Alerts**: Tamper detection, failed authentication attempts
- **Usage Analytics**: API calls, user activity, subscription metrics

### External Monitoring (Production)
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visual dashboards and reporting
- **Discord Webhooks**: Real-time notifications
- **Log Aggregation**: Centralized logging with rotation

### Key Metrics
- API response times (target: <500ms)
- Error rates (target: <1%)
- Memory usage (alert: >80%)
- Database performance
- License validation success rate

## 🔒 Security Features

### Application Security
- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: Configurable per-endpoint limits
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Content Security Policy headers

### Infrastructure Security
- **SSL/TLS Encryption**: Full HTTPS with modern ciphers
- **Container Security**: Non-root users, minimal attack surface
- **Network Security**: Isolated Docker networks
- **Backup Encryption**: Encrypted backup storage
- **Access Controls**: Role-based permissions

### Lua Loader Security
- **Integrity Verification**: Hash-based tamper detection
- **Environment Fingerprinting**: Anti-debugging measures
- **Encrypted Delivery**: Secure code transmission
- **Real-time Monitoring**: Automatic threat response
- **Global Ban System**: Instant key revocation

## 📈 Performance Optimization

### Database Optimization
- **Indexing**: Optimized indexes for all queries
- **Connection Pooling**: Efficient connection management
- **Query Optimization**: Aggregation pipelines for analytics
- **Caching Strategy**: Redis-based caching layer

### Application Optimization
- **Memory Management**: Garbage collection tuning
- **Async Operations**: Non-blocking I/O patterns
- **Load Balancing**: Nginx reverse proxy
- **Static Asset Caching**: CDN-ready configuration

### Monitoring & Alerting
- **Response Time Monitoring**: Real-time performance tracking
- **Resource Usage Alerts**: Memory, CPU, disk space
- **Error Rate Monitoring**: Automatic issue detection
- **Capacity Planning**: Usage trend analysis

## 🛡️ Subscription Tiers

| Feature | Free | Premium | Enterprise |
|---------|------|---------|------------|
| Projects | 3 | 25 | Unlimited |
| Keys per Project | 10 | 100 | Unlimited |
| Obfuscation | Basic | Premium | Enterprise |
| API Rate Limit | 100/15min | 500/15min | 2000/15min |
| Analytics Retention | 7 days | 30 days | 1 year |
| Support | Community | Email | Priority |
| Custom Domains | ❌ | ❌ | ✅ |
| White-label | ❌ | ❌ | ✅ |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Issues**: GitHub Issues
- **Security**: security@enigmacode.com
- **Enterprise**: enterprise@enigmacode.com

---

**Version**: 1.0.0 | **Last Updated**: December 2024
