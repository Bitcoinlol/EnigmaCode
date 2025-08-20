#!/bin/bash

# EnigmaCode Platform Backup Script
set -e

# Configuration
BACKUP_BASE_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_BASE_DIR/$TIMESTAMP"
RETENTION_DAYS=30

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

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
}

# Backup MongoDB
backup_mongodb() {
    log "Starting MongoDB backup..."
    
    if docker ps | grep -q enigmacode-mongodb; then
        CONTAINER_NAME="enigmacode-mongodb"
    elif docker ps | grep -q enigmacode-mongodb-prod; then
        CONTAINER_NAME="enigmacode-mongodb-prod"
    else
        warn "No MongoDB container found running"
        return 1
    fi
    
    # Create MongoDB backup
    docker exec $CONTAINER_NAME mongodump \
        --out /tmp/backup_$TIMESTAMP \
        --authenticationDatabase admin \
        --username $MONGO_ROOT_USERNAME \
        --password $MONGO_ROOT_PASSWORD
    
    # Copy backup from container
    docker cp $CONTAINER_NAME:/tmp/backup_$TIMESTAMP "$BACKUP_DIR/mongodb"
    
    # Cleanup container backup
    docker exec $CONTAINER_NAME rm -rf /tmp/backup_$TIMESTAMP
    
    log "MongoDB backup completed"
}

# Backup Redis
backup_redis() {
    log "Starting Redis backup..."
    
    if docker ps | grep -q enigmacode-redis; then
        CONTAINER_NAME="enigmacode-redis"
    elif docker ps | grep -q enigmacode-redis-prod; then
        CONTAINER_NAME="enigmacode-redis-prod"
    else
        warn "No Redis container found running"
        return 1
    fi
    
    # Trigger Redis save
    docker exec $CONTAINER_NAME redis-cli BGSAVE
    
    # Wait for save to complete
    sleep 5
    
    # Copy Redis dump
    docker cp $CONTAINER_NAME:/data/dump.rdb "$BACKUP_DIR/redis_dump.rdb"
    
    log "Redis backup completed"
}

# Backup application files
backup_files() {
    log "Starting file backup..."
    
    # Backup uploads directory
    if [ -d "./uploads" ]; then
        cp -r ./uploads "$BACKUP_DIR/"
        log "Uploads directory backed up"
    fi
    
    # Backup logs
    if [ -d "./logs" ]; then
        cp -r ./logs "$BACKUP_DIR/"
        log "Logs directory backed up"
    fi
    
    # Backup configuration files
    mkdir -p "$BACKUP_DIR/config"
    
    # Copy important config files
    [ -f ".env" ] && cp .env "$BACKUP_DIR/config/"
    [ -f ".env.production" ] && cp .env.production "$BACKUP_DIR/config/"
    [ -f "docker-compose.yml" ] && cp docker-compose.yml "$BACKUP_DIR/config/"
    [ -f "docker-compose.prod.yml" ] && cp docker-compose.prod.yml "$BACKUP_DIR/config/"
    
    log "Configuration files backed up"
}

# Backup SSL certificates
backup_ssl() {
    log "Starting SSL backup..."
    
    if [ -d "/etc/letsencrypt" ]; then
        sudo cp -r /etc/letsencrypt "$BACKUP_DIR/"
        log "Let's Encrypt certificates backed up"
    elif [ -d "./nginx/ssl" ]; then
        cp -r ./nginx/ssl "$BACKUP_DIR/"
        log "SSL certificates backed up"
    else
        warn "No SSL certificates found"
    fi
}

# Create backup manifest
create_manifest() {
    log "Creating backup manifest..."
    
    cat > "$BACKUP_DIR/manifest.txt" << EOF
EnigmaCode Platform Backup
Timestamp: $TIMESTAMP
Date: $(date)
Backup Directory: $BACKUP_DIR

Contents:
$(find "$BACKUP_DIR" -type f | sort)

Checksums:
$(find "$BACKUP_DIR" -type f -exec sha256sum {} \;)
EOF
    
    log "Backup manifest created"
}

# Compress backup
compress_backup() {
    log "Compressing backup..."
    
    cd "$BACKUP_BASE_DIR"
    tar -czf "${TIMESTAMP}.tar.gz" "$TIMESTAMP"
    
    if [ $? -eq 0 ]; then
        rm -rf "$TIMESTAMP"
        log "Backup compressed to ${TIMESTAMP}.tar.gz"
    else
        error "Failed to compress backup"
        return 1
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than $RETENTION_DAYS days)..."
    
    find "$BACKUP_BASE_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    local deleted_count=$(find "$BACKUP_BASE_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS | wc -l)
    log "Cleaned up $deleted_count old backup files"
}

# Verify backup
verify_backup() {
    log "Verifying backup..."
    
    local backup_file="$BACKUP_BASE_DIR/${TIMESTAMP}.tar.gz"
    
    if [ -f "$backup_file" ]; then
        # Test archive integrity
        tar -tzf "$backup_file" > /dev/null
        
        if [ $? -eq 0 ]; then
            local size=$(du -h "$backup_file" | cut -f1)
            log "Backup verification successful - Size: $size"
        else
            error "Backup verification failed - Archive is corrupted"
            return 1
        fi
    else
        error "Backup file not found: $backup_file"
        return 1
    fi
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ ! -z "$DISCORD_WEBHOOK_URL" ]; then
        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{\"content\":\"🔄 **EnigmaCode Backup $status**\n$message\nTimestamp: $TIMESTAMP\"}" \
             "$DISCORD_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Main backup function
main() {
    log "Starting EnigmaCode platform backup..."
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    if [ -f ".env.production" ]; then
        export $(cat .env.production | grep -v '^#' | xargs)
    fi
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    backup_mongodb || warn "MongoDB backup failed"
    backup_redis || warn "Redis backup failed"
    backup_files
    backup_ssl || warn "SSL backup failed"
    
    # Create manifest and compress
    create_manifest
    compress_backup
    
    # Verify backup
    if verify_backup; then
        cleanup_old_backups
        send_notification "Completed" "Backup completed successfully"
        log "Backup process completed successfully!"
    else
        send_notification "Failed" "Backup verification failed"
        error "Backup process failed!"
        exit 1
    fi
}

# Handle script arguments
case "${1:-full}" in
    "mongodb")
        log "Running MongoDB-only backup..."
        create_backup_dir
        backup_mongodb
        create_manifest
        compress_backup
        verify_backup
        ;;
    "files")
        log "Running files-only backup..."
        create_backup_dir
        backup_files
        backup_ssl
        create_manifest
        compress_backup
        verify_backup
        ;;
    "full"|*)
        main
        ;;
esac
