#!/bin/bash

# EnigmaCode Platform Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

echo -e "${GREEN}🚀 EnigmaCode Platform Deployment Script${NC}"
echo -e "${YELLOW}Environment: $ENVIRONMENT${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    if [ "$ENVIRONMENT" = "production" ] && [ ! -f ".env.production" ]; then
        print_error "Production environment file (.env.production) not found"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Create backup
create_backup() {
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "💾 Creating backup..."
        mkdir -p "$BACKUP_DIR"
        
        # Backup database
        if docker ps | grep -q enigmacode-mongodb-prod; then
            docker exec enigmacode-mongodb-prod mongodump --out /backups/$(basename $BACKUP_DIR) --authenticationDatabase admin -u $MONGO_ROOT_USERNAME -p $MONGO_ROOT_PASSWORD
            print_status "Database backup created"
        fi
        
        # Backup uploads
        if [ -d "./uploads" ]; then
            cp -r ./uploads "$BACKUP_DIR/"
            print_status "Uploads backup created"
        fi
        
        # Backup logs
        if [ -d "./logs" ]; then
            cp -r ./logs "$BACKUP_DIR/"
            print_status "Logs backup created"
        fi
    fi
}

# Build and deploy
deploy() {
    echo "🏗️  Building and deploying..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        # Load production environment
        export $(cat .env.production | xargs)
        
        # Pull latest images
        docker-compose -f docker-compose.prod.yml pull
        
        # Build application
        docker-compose -f docker-compose.prod.yml build --no-cache
        
        # Deploy with zero downtime
        docker-compose -f docker-compose.prod.yml up -d --remove-orphans
        
        print_status "Production deployment completed"
    else
        # Development deployment
        docker-compose up -d --build
        print_status "Development deployment completed"
    fi
}

# Health check
health_check() {
    echo "🏥 Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            print_status "Health check passed"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - waiting for service..."
        sleep 5
        ((attempt++))
    done
    
    print_error "Health check failed after $max_attempts attempts"
    return 1
}

# Setup SSL certificates (production only)
setup_ssl() {
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "🔒 Setting up SSL certificates..."
        
        if [ ! -d "/etc/letsencrypt" ]; then
            print_warning "Let's Encrypt not found. Please set up SSL certificates manually."
        else
            print_status "SSL certificates found"
        fi
    fi
}

# Setup monitoring
setup_monitoring() {
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "📊 Setting up monitoring..."
        
        # Create monitoring directories
        mkdir -p ./monitoring
        
        # Start monitoring services
        docker-compose -f docker-compose.prod.yml up -d prometheus grafana
        
        print_status "Monitoring services started"
        echo "Grafana available at: http://localhost:3001"
        echo "Prometheus available at: http://localhost:9090"
    fi
}

# Cleanup old containers and images
cleanup() {
    echo "🧹 Cleaning up..."
    
    # Remove stopped containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (be careful in production)
    if [ "$ENVIRONMENT" != "production" ]; then
        docker volume prune -f
    fi
    
    print_status "Cleanup completed"
}

# Main deployment flow
main() {
    echo "Starting deployment process..."
    
    check_prerequisites
    create_backup
    deploy
    setup_ssl
    health_check
    setup_monitoring
    cleanup
    
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo ""
    echo "📋 Service URLs:"
    echo "   API: http://localhost:3000"
    echo "   Health Check: http://localhost:3000/api/health"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "   Monitoring: http://localhost:3001 (Grafana)"
        echo "   Metrics: http://localhost:9090 (Prometheus)"
    fi
    
    echo ""
    echo "📖 Useful commands:"
    echo "   View logs: docker-compose logs -f"
    echo "   Stop services: docker-compose down"
    echo "   Restart: docker-compose restart"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "   Production logs: docker-compose -f docker-compose.prod.yml logs -f"
        echo "   Production stop: docker-compose -f docker-compose.prod.yml down"
    fi
}

# Run main function
main
