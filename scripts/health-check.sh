#!/bin/bash

# EnigmaCode Platform Health Check Script
set -e

# Configuration
HEALTH_ENDPOINT="http://localhost:3000/api/health"
API_ENDPOINT="http://localhost:3000/api"
TIMEOUT=10
MAX_RETRIES=3

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Status tracking
OVERALL_STATUS="HEALTHY"
ISSUES_FOUND=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    ISSUES_FOUND+=("WARNING: $1")
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    OVERALL_STATUS="UNHEALTHY"
    ISSUES_FOUND+=("ERROR: $1")
}

# Check API health endpoint
check_api_health() {
    log_info "Checking API health endpoint..."
    
    local response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        log_success "API health endpoint responding (HTTP $http_code)"
        return 0
    else
        log_error "API health endpoint failed (HTTP $http_code)"
        return 1
    fi
}

# Check API response time
check_api_response_time() {
    log_info "Checking API response time..."
    
    local start_time=$(date +%s%N)
    curl -s --max-time $TIMEOUT "$HEALTH_ENDPOINT" > /dev/null 2>&1
    local end_time=$(date +%s%N)
    
    local response_time=$(( (end_time - start_time) / 1000000 ))
    
    if [ $response_time -lt 1000 ]; then
        log_success "API response time: ${response_time}ms"
    elif [ $response_time -lt 3000 ]; then
        log_warning "API response time slow: ${response_time}ms"
    else
        log_error "API response time critical: ${response_time}ms"
    fi
}

# Check Docker containers
check_containers() {
    log_info "Checking Docker containers..."
    
    local containers=("api" "mongodb" "redis" "nginx")
    local found_containers=0
    
    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$container"; then
            local status=$(docker ps --filter "name=$container" --format "{{.Status}}")
            log_success "Container $container: $status"
            ((found_containers++))
        else
            log_warning "Container $container: Not running"
        fi
    done
    
    if [ $found_containers -eq 0 ]; then
        log_error "No EnigmaCode containers found running"
    fi
}

# Check database connectivity
check_database() {
    log_info "Checking database connectivity..."
    
    if docker ps | grep -q mongodb; then
        local container_name=$(docker ps --filter "name=mongodb" --format "{{.Names}}" | head -1)
        
        if docker exec "$container_name" mongo --eval "db.stats()" > /dev/null 2>&1; then
            log_success "Database connectivity verified"
        else
            log_error "Database connectivity failed"
        fi
    else
        log_warning "MongoDB container not found"
    fi
}

# Check Redis connectivity
check_redis() {
    log_info "Checking Redis connectivity..."
    
    if docker ps | grep -q redis; then
        local container_name=$(docker ps --filter "name=redis" --format "{{.Names}}" | head -1)
        
        if docker exec "$container_name" redis-cli ping | grep -q "PONG"; then
            log_success "Redis connectivity verified"
        else
            log_error "Redis connectivity failed"
        fi
    else
        log_warning "Redis container not found"
    fi
}

# Check disk space
check_disk_space() {
    log_info "Checking disk space..."
    
    local usage=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ $usage -lt 80 ]; then
        log_success "Disk usage: ${usage}%"
    elif [ $usage -lt 90 ]; then
        log_warning "Disk usage high: ${usage}%"
    else
        log_error "Disk usage critical: ${usage}%"
    fi
}

# Check memory usage
check_memory() {
    log_info "Checking memory usage..."
    
    if command -v free > /dev/null; then
        local mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        
        if [ $mem_usage -lt 80 ]; then
            log_success "Memory usage: ${mem_usage}%"
        elif [ $mem_usage -lt 90 ]; then
            log_warning "Memory usage high: ${mem_usage}%"
        else
            log_error "Memory usage critical: ${mem_usage}%"
        fi
    else
        log_warning "Memory check not available (free command not found)"
    fi
}

# Check SSL certificate (if HTTPS)
check_ssl_certificate() {
    if [ ! -z "$SSL_DOMAIN" ]; then
        log_info "Checking SSL certificate for $SSL_DOMAIN..."
        
        local expiry_date=$(echo | openssl s_client -servername "$SSL_DOMAIN" -connect "$SSL_DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
        local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
        local current_epoch=$(date +%s)
        local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [ $days_until_expiry -gt 30 ]; then
            log_success "SSL certificate valid for $days_until_expiry days"
        elif [ $days_until_expiry -gt 7 ]; then
            log_warning "SSL certificate expires in $days_until_expiry days"
        else
            log_error "SSL certificate expires in $days_until_expiry days"
        fi
    fi
}

# Check log files for errors
check_logs() {
    log_info "Checking recent log files for errors..."
    
    local error_count=0
    
    # Check application logs
    if [ -d "./logs" ]; then
        local recent_errors=$(find ./logs -name "*.log" -mtime -1 -exec grep -i "error\|critical\|fatal" {} \; 2>/dev/null | wc -l)
        error_count=$((error_count + recent_errors))
    fi
    
    # Check Docker logs
    if docker ps --format "{{.Names}}" | grep -q "enigmacode"; then
        local container_errors=$(docker logs --since="24h" $(docker ps --filter "name=enigmacode" --format "{{.Names}}" | head -1) 2>&1 | grep -i "error\|critical\|fatal" | wc -l)
        error_count=$((error_count + container_errors))
    fi
    
    if [ $error_count -eq 0 ]; then
        log_success "No recent errors found in logs"
    elif [ $error_count -lt 10 ]; then
        log_warning "Found $error_count recent errors in logs"
    else
        log_error "Found $error_count recent errors in logs"
    fi
}

# Check API endpoints
check_api_endpoints() {
    log_info "Checking critical API endpoints..."
    
    local endpoints=("/auth/health" "/projects" "/keys")
    
    for endpoint in "${endpoints[@]}"; do
        local response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$API_ENDPOINT$endpoint" 2>/dev/null || echo "000")
        local http_code="${response: -3}"
        
        if [ "$http_code" = "200" ] || [ "$http_code" = "401" ]; then
            log_success "Endpoint $endpoint responding (HTTP $http_code)"
        else
            log_warning "Endpoint $endpoint issue (HTTP $http_code)"
        fi
    done
}

# Send notification if issues found
send_notification() {
    if [ ! -z "$DISCORD_WEBHOOK_URL" ] && [ ${#ISSUES_FOUND[@]} -gt 0 ]; then
        local message="🏥 **EnigmaCode Health Check**\n\n"
        message+="**Status**: $OVERALL_STATUS\n"
        message+="**Issues Found**: ${#ISSUES_FOUND[@]}\n\n"
        
        for issue in "${ISSUES_FOUND[@]}"; do
            message+="• $issue\n"
        done
        
        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{\"content\":\"$message\"}" \
             "$DISCORD_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Generate report
generate_report() {
    echo ""
    echo "=================================="
    echo "  EnigmaCode Health Check Report"
    echo "=================================="
    echo "Timestamp: $(date)"
    echo "Overall Status: $OVERALL_STATUS"
    echo "Issues Found: ${#ISSUES_FOUND[@]}"
    echo ""
    
    if [ ${#ISSUES_FOUND[@]} -gt 0 ]; then
        echo "Issues:"
        for issue in "${ISSUES_FOUND[@]}"; do
            echo "  • $issue"
        done
        echo ""
    fi
    
    echo "Recommendations:"
    if [ "$OVERALL_STATUS" = "UNHEALTHY" ]; then
        echo "  • Immediate attention required"
        echo "  • Check application logs"
        echo "  • Verify container status"
        echo "  • Consider restarting services"
    elif [ ${#ISSUES_FOUND[@]} -gt 0 ]; then
        echo "  • Monitor identified warnings"
        echo "  • Plan maintenance if needed"
        echo "  • Review resource usage"
    else
        echo "  • System is healthy"
        echo "  • Continue regular monitoring"
    fi
    
    echo "=================================="
}

# Main health check function
main() {
    echo "🏥 Starting EnigmaCode Platform Health Check..."
    echo ""
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs) 2>/dev/null || true
    fi
    
    if [ -f ".env.production" ]; then
        export $(cat .env.production | grep -v '^#' | xargs) 2>/dev/null || true
    fi
    
    # Run health checks
    check_api_health
    check_api_response_time
    check_containers
    check_database
    check_redis
    check_disk_space
    check_memory
    check_ssl_certificate
    check_logs
    check_api_endpoints
    
    # Send notification and generate report
    send_notification
    generate_report
    
    # Exit with appropriate code
    if [ "$OVERALL_STATUS" = "HEALTHY" ]; then
        exit 0
    else
        exit 1
    fi
}

# Handle script arguments
case "${1:-full}" in
    "quick")
        check_api_health
        check_containers
        generate_report
        ;;
    "api")
        check_api_health
        check_api_response_time
        check_api_endpoints
        generate_report
        ;;
    "infrastructure")
        check_containers
        check_database
        check_redis
        check_disk_space
        check_memory
        generate_report
        ;;
    "full"|*)
        main
        ;;
esac
