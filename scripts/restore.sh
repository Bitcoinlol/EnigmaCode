#!/bin/bash

# EnigmaCode Platform Restore Script
set -e

# Configuration
BACKUP_BASE_DIR="./backups"
RESTORE_TIMESTAMP=""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Logging
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Show usage
usage() {
    echo "Usage: $0 [BACKUP_TIMESTAMP]"
    echo ""
    echo "Available backups:"
    ls -la "$BACKUP_BASE_DIR"/*.tar.gz 2>/dev/null | awk '{print $9}' | sed 's/.*\///' | sed 's/.tar.gz//' || echo "No backups found"
    exit 1
}

# Validate backup exists
validate_backup() {
    local backup_file="$BACKUP_BASE_DIR/${RESTORE_TIMESTAMP}.tar.gz"
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        usage
    fi
    
    # Test archive integrity
    tar -tzf "$backup_file" > /dev/null
    if [ $? -ne 0 ]; then
        error "Backup archive is corrupted: $backup_file"
        exit 1
    fi
    
    log "Backup validation successful"
}

# Extract backup
extract_backup() {
    log "Extracting backup: $RESTORE_TIMESTAMP"
    
    cd "$BACKUP_BASE_DIR"
    tar -xzf "${RESTORE_TIMESTAMP}.tar.gz"
    
    if [ $? -eq 0 ]; then
        log "Backup extracted successfully"
    else
        error "Failed to extract backup"
        exit 1
    fi
}

# Stop services
stop_services() {
    log "Stopping EnigmaCode services..."
    
    # Try production first, then development
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        docker-compose -f docker-compose.prod.yml down
        log "Production services stopped"
    elif docker-compose ps | grep -q "Up"; then
        docker-compose down
        log "Development services stopped"
    else
        warn "No running services found"
    fi
}

# Restore MongoDB
restore_mongodb() {
    log "Starting MongoDB restore..."
    
    local backup_path="$BACKUP_BASE_DIR/$RESTORE_TIMESTAMP/mongodb"
    
    if [ ! -d "$backup_path" ]; then
        warn "MongoDB backup not found in restore archive"
        return 1
    fi
    
    # Start MongoDB container if not running
    if ! docker ps | grep -q mongodb; then
        log "Starting MongoDB container..."
        if [ -f "docker-compose.prod.yml" ]; then
            docker-compose -f docker-compose.prod.yml up -d mongodb
            CONTAINER_NAME="enigmacode-mongodb-prod"
        else
            docker-compose up -d mongodb
            CONTAINER_NAME="enigmacode-mongodb"
        fi
        
        # Wait for MongoDB to be ready
        sleep 10
    else
        if docker ps | grep -q enigmacode-mongodb-prod; then
            CONTAINER_NAME="enigmacode-mongodb-prod"
        else
            CONTAINER_NAME="enigmacode-mongodb"
        fi
    fi
    
    # Copy backup to container
    docker cp "$backup_path" $CONTAINER_NAME:/tmp/restore
    
    # Restore database
    docker exec $CONTAINER_NAME mongorestore \
        --drop \
        --dir /tmp/restore \
        --authenticationDatabase admin \
        --username $MONGO_ROOT_USERNAME \
        --password $MONGO_ROOT_PASSWORD
    
    # Cleanup
    docker exec $CONTAINER_NAME rm -rf /tmp/restore
    
    log "MongoDB restore completed"
}

# Restore Redis
restore_redis() {
    log "Starting Redis restore..."
    
    local backup_file="$BACKUP_BASE_DIR/$RESTORE_TIMESTAMP/redis_dump.rdb"
    
    if [ ! -f "$backup_file" ]; then
        warn "Redis backup not found in restore archive"
        return 1
    fi
    
    # Start Redis container if not running
    if ! docker ps | grep -q redis; then
        log "Starting Redis container..."
        if [ -f "docker-compose.prod.yml" ]; then
            docker-compose -f docker-compose.prod.yml up -d redis
            CONTAINER_NAME="enigmacode-redis-prod"
        else
            docker-compose up -d redis
            CONTAINER_NAME="enigmacode-redis"
        fi
        
        # Wait for Redis to be ready
        sleep 5
    else
        if docker ps | grep -q enigmacode-redis-prod; then
            CONTAINER_NAME="enigmacode-redis-prod"
        else
            CONTAINER_NAME="enigmacode-redis"
        fi
    fi
    
    # Stop Redis to replace dump file
    docker exec $CONTAINER_NAME redis-cli SHUTDOWN NOSAVE || true
    sleep 2
    
    # Copy backup dump file
    docker cp "$backup_file" $CONTAINER_NAME:/data/dump.rdb
    
    # Restart Redis container
    docker restart $CONTAINER_NAME
    
    log "Redis restore completed"
}

# Restore files
restore_files() {
    log "Starting file restore..."
    
    # Restore uploads
    local uploads_path="$BACKUP_BASE_DIR/$RESTORE_TIMESTAMP/uploads"
    if [ -d "$uploads_path" ]; then
        rm -rf ./uploads
        cp -r "$uploads_path" ./uploads
        log "Uploads directory restored"
    fi
    
    # Restore configuration files
    local config_path="$BACKUP_BASE_DIR/$RESTORE_TIMESTAMP/config"
    if [ -d "$config_path" ]; then
        # Backup current configs
        mkdir -p ./config_backup_$(date +%Y%m%d_%H%M%S)
        [ -f ".env" ] && cp .env ./config_backup_$(date +%Y%m%d_%H%M%S)/
        [ -f ".env.production" ] && cp .env.production ./config_backup_$(date +%Y%m%d_%H%M%S)/
        
        # Restore configs (with confirmation)
        echo -n "Restore configuration files? This will overwrite current configs. (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            [ -f "$config_path/.env" ] && cp "$config_path/.env" ./
            [ -f "$config_path/.env.production" ] && cp "$config_path/.env.production" ./
            log "Configuration files restored"
        else
            log "Configuration files skipped"
        fi
    fi
}

# Restore SSL certificates
restore_ssl() {
    log "Starting SSL restore..."
    
    local ssl_path="$BACKUP_BASE_DIR/$RESTORE_TIMESTAMP/letsencrypt"
    local ssl_nginx_path="$BACKUP_BASE_DIR/$RESTORE_TIMESTAMP/ssl"
    
    if [ -d "$ssl_path" ]; then
        echo -n "Restore Let's Encrypt certificates? This requires sudo access. (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            sudo cp -r "$ssl_path" /etc/
            log "Let's Encrypt certificates restored"
        fi
    elif [ -d "$ssl_nginx_path" ]; then
        mkdir -p ./nginx/ssl
        cp -r "$ssl_nginx_path"/* ./nginx/ssl/
        log "SSL certificates restored"
    else
        warn "No SSL certificates found in backup"
    fi
}

# Start services
start_services() {
    log "Starting EnigmaCode services..."
    
    # Load environment variables
    if [ -f ".env.production" ]; then
        export $(cat .env.production | grep -v '^#' | xargs)
        docker-compose -f docker-compose.prod.yml up -d
        log "Production services started"
    elif [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
        docker-compose up -d
        log "Development services started"
    else
        error "No environment configuration found"
        exit 1
    fi
}

# Verify restore
verify_restore() {
    log "Verifying restore..."
    
    # Wait for services to be ready
    sleep 30
    
    # Check API health
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            log "API health check passed"
            break
        fi
        
        log "Attempt $attempt/$max_attempts - waiting for API..."
        sleep 10
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        error "API health check failed after restore"
        return 1
    fi
    
    # Check database connectivity
    if docker exec $(docker ps | grep mongodb | awk '{print $1}') mongo --eval "db.stats()" &> /dev/null; then
        log "Database connectivity verified"
    else
        error "Database connectivity check failed"
        return 1
    fi
    
    log "Restore verification completed successfully"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ ! -z "$DISCORD_WEBHOOK_URL" ]; then
        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{\"content\":\"🔄 **EnigmaCode Restore $status**\n$message\nTimestamp: $RESTORE_TIMESTAMP\"}" \
             "$DISCORD_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Cleanup extracted files
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$BACKUP_BASE_DIR/$RESTORE_TIMESTAMP"
    log "Cleanup completed"
}

# Main restore function
main() {
    # Check if timestamp provided
    if [ -z "$1" ]; then
        usage
    fi
    
    RESTORE_TIMESTAMP=$1
    
    log "Starting EnigmaCode platform restore..."
    log "Restore timestamp: $RESTORE_TIMESTAMP"
    
    # Validate backup
    validate_backup
    
    # Extract backup
    extract_backup
    
    # Load environment variables from backup if available
    local config_path="$BACKUP_BASE_DIR/$RESTORE_TIMESTAMP/config"
    if [ -f "$config_path/.env.production" ]; then
        export $(cat "$config_path/.env.production" | grep -v '^#' | xargs)
    elif [ -f "$config_path/.env" ]; then
        export $(cat "$config_path/.env" | grep -v '^#' | xargs)
    fi
    
    # Confirmation prompt
    echo -n "This will restore EnigmaCode platform from backup $RESTORE_TIMESTAMP. Continue? (y/N): "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log "Restore cancelled by user"
        cleanup
        exit 0
    fi
    
    # Stop services
    stop_services
    
    # Perform restore
    restore_mongodb || warn "MongoDB restore failed"
    restore_redis || warn "Redis restore failed"
    restore_files
    restore_ssl || warn "SSL restore failed"
    
    # Start services
    start_services
    
    # Verify restore
    if verify_restore; then
        send_notification "Completed" "Platform restored successfully from backup $RESTORE_TIMESTAMP"
        log "Restore process completed successfully!"
    else
        send_notification "Failed" "Platform restore verification failed"
        error "Restore verification failed!"
        exit 1
    fi
    
    # Cleanup
    cleanup
}

# Run main function
main "$@"
