# EnigmaCode Platform Deployment Guide

## Overview

This guide covers deploying the EnigmaCode platform in both development and production environments using Docker and Docker Compose.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for local development)
- MongoDB 7.0+ (if not using Docker)
- Git

## Quick Start

### Development Deployment

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd EnigmaCode
   cp .env.example .env
   ```

2. **Configure environment**:
   Edit `.env` with your development settings.

3. **Deploy**:
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh development
   ```

4. **Access the platform**:
   - Frontend: http://localhost:3000
   - API: http://localhost:3000/api
   - Health Check: http://localhost:3000/api/health

### Production Deployment

1. **Setup production environment**:
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your production values
   ```

2. **Deploy to production**:
   ```bash
   ./scripts/deploy.sh production
   ```

3. **Access services**:
   - Platform: https://your-domain.com
   - Grafana: http://localhost:3001
   - Prometheus: http://localhost:9090

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://user:pass@host:27017/db` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `ENCRYPTION_KEY` | Obfuscation encryption key | `32-character-key` |
| `DISCORD_WEBHOOK_URL` | Discord notifications | `https://discord.com/api/webhooks/...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit per window | `100` |
| `SMTP_HOST` | Email server host | - |
| `STRIPE_SECRET_KEY` | Payment processing | - |

## Architecture

### Services

1. **API Server** (`api`):
   - Node.js Express application
   - Handles all API requests
   - Port: 3000

2. **Database** (`mongodb`):
   - MongoDB 7.0
   - Persistent data storage
   - Port: 27017

3. **Cache** (`redis`):
   - Redis for caching and sessions
   - Port: 6379

4. **Reverse Proxy** (`nginx`):
   - Load balancing and SSL termination
   - Ports: 80, 443

5. **Monitoring** (Production only):
   - Prometheus for metrics
   - Grafana for dashboards

### Network Architecture

```
Internet → Nginx (80/443) → API Server (3000)
                          ↓
                     MongoDB (27017)
                          ↓
                     Redis (6379)
```

## SSL/TLS Configuration

### Let's Encrypt (Recommended)

1. **Install Certbot**:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. **Obtain certificate**:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. **Auto-renewal**:
   ```bash
   sudo crontab -e
   # Add: 0 12 * * * /usr/bin/certbot renew --quiet
   ```

### Manual SSL Setup

1. Place certificates in `nginx/ssl/`:
   - `fullchain.pem` - Full certificate chain
   - `privkey.pem` - Private key

2. Update `nginx/nginx.prod.conf` with certificate paths.

## Database Management

### Backup

```bash
# Manual backup
docker exec enigmacode-mongodb-prod mongodump --out /backups/manual --authenticationDatabase admin -u admin -p password

# Automated backup (add to cron)
0 2 * * * docker exec enigmacode-mongodb-prod mongodump --out /backups/$(date +\%Y\%m\%d) --authenticationDatabase admin -u admin -p password
```

### Restore

```bash
docker exec enigmacode-mongodb-prod mongorestore /backups/backup-folder --authenticationDatabase admin -u admin -p password
```

### Indexes

The platform automatically creates performance indexes on startup:
- User email/username (unique)
- Project owner and creation date
- Key strings and validation
- Analytics timestamps

## Monitoring

### Health Checks

- **Application**: `GET /api/health`
- **Database**: Automatic connection testing
- **Docker**: Built-in health checks

### Metrics (Production)

1. **Prometheus Metrics**:
   - Request rates and response times
   - Error rates
   - System resources

2. **Grafana Dashboards**:
   - API performance
   - Database metrics
   - System health

3. **Log Aggregation**:
   - Application logs in `logs/`
   - Nginx access/error logs
   - Container logs via Docker

### Alerts

Configure alerts in Grafana for:
- High error rates (>5%)
- Slow response times (>1s average)
- Database connection issues
- High memory usage (>80%)

## Performance Optimization

### Database Optimization

1. **Connection Pooling**:
   - Max pool size: 10 connections
   - Connection timeout: 5s

2. **Query Optimization**:
   - Proper indexing
   - Query result limiting
   - Aggregation pipelines

3. **Caching Strategy**:
   - Redis for session storage
   - Application-level caching
   - CDN for static assets

### Application Optimization

1. **Memory Management**:
   - Garbage collection tuning
   - Memory leak monitoring
   - Resource limits in Docker

2. **CPU Optimization**:
   - Async/await patterns
   - Worker threads for heavy tasks
   - Load balancing

## Security Considerations

### Network Security

1. **Firewall Rules**:
   ```bash
   # Allow only necessary ports
   ufw allow 22    # SSH
   ufw allow 80    # HTTP
   ufw allow 443   # HTTPS
   ufw enable
   ```

2. **Container Security**:
   - Non-root user execution
   - Read-only file systems where possible
   - Security scanning

### Application Security

1. **Authentication**:
   - JWT token validation
   - Rate limiting
   - Password hashing (bcrypt)

2. **Data Protection**:
   - Encryption at rest
   - TLS in transit
   - Input validation

3. **API Security**:
   - CORS configuration
   - Security headers
   - Request size limits

## Troubleshooting

### Common Issues

1. **Database Connection Failed**:
   ```bash
   # Check MongoDB container
   docker logs enigmacode-mongodb-prod
   
   # Verify credentials
   docker exec -it enigmacode-mongodb-prod mongo -u admin -p
   ```

2. **High Memory Usage**:
   ```bash
   # Check container resources
   docker stats
   
   # Restart API container
   docker-compose restart api
   ```

3. **SSL Certificate Issues**:
   ```bash
   # Check certificate validity
   openssl x509 -in /etc/letsencrypt/live/domain/fullchain.pem -text -noout
   
   # Renew certificate
   sudo certbot renew
   ```

### Log Analysis

```bash
# Application logs
docker-compose logs -f api

# Database logs
docker-compose logs -f mongodb

# Nginx logs
tail -f logs/nginx/access.log
tail -f logs/nginx/error.log
```

### Performance Testing

```bash
# Run benchmark
npm run benchmark

# Load testing
npm run load-test

# Heavy load test
npm run load-test:heavy
```

## Scaling

### Horizontal Scaling

1. **API Servers**:
   - Multiple API containers behind load balancer
   - Session storage in Redis
   - Stateless application design

2. **Database Scaling**:
   - MongoDB replica sets
   - Read replicas for analytics
   - Sharding for large datasets

### Vertical Scaling

1. **Resource Allocation**:
   - Increase container memory/CPU limits
   - Optimize database configuration
   - SSD storage for better I/O

## Maintenance

### Regular Tasks

1. **Daily**:
   - Monitor error logs
   - Check system resources
   - Verify backup completion

2. **Weekly**:
   - Update security patches
   - Review performance metrics
   - Clean up old logs

3. **Monthly**:
   - Update dependencies
   - Review and optimize queries
   - Capacity planning

### Update Process

1. **Backup current state**
2. **Test updates in staging**
3. **Deploy during maintenance window**
4. **Verify functionality**
5. **Monitor for issues**

## Support

For deployment issues:
1. Check logs first
2. Review this documentation
3. Test in development environment
4. Contact support with specific error messages

---

**Last Updated**: December 2024
**Version**: 1.0.0
