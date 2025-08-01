#!/bin/bash

# WhatsApp Worker Startup Script
# Usage: ./scripts/start.sh [production|development]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default environment
ENV=${1:-development}

echo -e "${GREEN}🚀 Starting WhatsApp Worker...${NC}"
echo -e "${YELLOW}Environment: $ENV${NC}"

# Function to check if a service is running
check_service() {
    local service=$1
    local port=$2
    
    if command -v $service &> /dev/null; then
        echo -e "${GREEN}✅ $service is installed${NC}"
    else
        echo -e "${RED}❌ $service is not installed${NC}"
        exit 1
    fi
    
    if [ ! -z "$port" ]; then
        if nc -z localhost $port 2>/dev/null; then
            echo -e "${GREEN}✅ $service is running on port $port${NC}"
        else
            echo -e "${RED}❌ $service is not running on port $port${NC}"
            exit 1
        fi
    fi
}

# Function to install dependencies
install_deps() {
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
}

# Function to setup environment
setup_env() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}📋 Creating .env file from template...${NC}"
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please configure your .env file before running the worker${NC}"
    else
        echo -e "${GREEN}✅ .env file exists${NC}"
    fi
}

# Function to create directories
create_dirs() {
    echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
    mkdir -p logs
    echo -e "${GREEN}✅ Directories created${NC}"
}

# Function to check Redis
check_redis() {
    echo -e "${YELLOW}🔍 Checking Redis connection...${NC}"
    
    # Check if Redis is running
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis is running${NC}"
    else
        echo -e "${RED}❌ Redis is not running${NC}"
        echo -e "${YELLOW}💡 Starting Redis...${NC}"
        
        # Try to start Redis (different methods for different OS)
        if command -v systemctl &> /dev/null; then
            sudo systemctl start redis-server
        elif command -v service &> /dev/null; then
            sudo service redis-server start
        elif command -v brew &> /dev/null; then
            brew services start redis
        else
            echo -e "${RED}❌ Could not start Redis automatically${NC}"
            echo -e "${YELLOW}Please start Redis manually:${NC}"
            echo "  - Ubuntu/Debian: sudo systemctl start redis-server"
            echo "  - macOS: brew services start redis"
            echo "  - Docker: docker run -d -p 6379:6379 redis:alpine"
            exit 1
        fi
        
        # Wait a moment and check again
        sleep 2
        if redis-cli ping &> /dev/null; then
            echo -e "${GREEN}✅ Redis started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start Redis${NC}"
            exit 1
        fi
    fi
}

# Function to check webservice
check_webservice() {
    echo -e "${YELLOW}🔍 Checking webservice connection...${NC}"
    
    # Get webservice URL from .env
    WEBSERVICE_URL=$(grep WEBSERVICE_API_URL .env | cut -d '=' -f2)
    
    if [ -z "$WEBSERVICE_URL" ]; then
        echo -e "${YELLOW}⚠️  WEBSERVICE_API_URL not configured in .env${NC}"
        return
    fi
    
    # Remove quotes if present
    WEBSERVICE_URL=$(echo $WEBSERVICE_URL | tr -d '"' | tr -d "'")
    
    # Check if webservice is reachable
    if curl -s --max-time 5 "$WEBSERVICE_URL/health" &> /dev/null; then
        echo -e "${GREEN}✅ Webservice is reachable at $WEBSERVICE_URL${NC}"
    else
        echo -e "${YELLOW}⚠️  Webservice not reachable at $WEBSERVICE_URL${NC}"
        echo -e "${YELLOW}Worker will continue but may have limited functionality${NC}"
    fi
}

# Main startup sequence
main() {
    echo -e "${GREEN}===================================${NC}"
    echo -e "${GREEN} WhatsApp Worker Startup Script   ${NC}"
    echo -e "${GREEN}===================================${NC}"
    
    # Check Node.js
    check_service "node"
    
    # Check npm
    check_service "npm"
    
    # Install dependencies
    install_deps
    
    # Setup environment
    setup_env
    
    # Create directories
    create_dirs
    
    # Check Redis
    check_redis
    
    # Check webservice
    check_webservice
    
    echo -e "${GREEN}===================================${NC}"
    echo -e "${GREEN}✅ Pre-flight checks completed${NC}"
    echo -e "${GREEN}🚀 Starting WhatsApp Worker...${NC}"
    echo -e "${GREEN}===================================${NC}"
    
    # Set NODE_ENV
    export NODE_ENV=$ENV
    
    # Start the worker based on environment
    if [ "$ENV" = "production" ]; then
        echo -e "${YELLOW}Starting in production mode...${NC}"
        npm start
    else
        echo -e "${YELLOW}Starting in development mode...${NC}"
        if command -v nodemon &> /dev/null; then
            npm run dev
        else
            echo -e "${YELLOW}nodemon not found, installing...${NC}"
            npm install -g nodemon
            npm run dev
        fi
    fi
}

# Trap signals for graceful shutdown
trap 'echo -e "${YELLOW}🛑 Shutting down...${NC}"; exit 0' SIGINT SIGTERM

# Check if script is being run from correct directory
if [ ! -f "package.json" ] || [ ! -f "index.js" ]; then
    echo -e "${RED}❌ Please run this script from the whatsapp-worker directory${NC}"
    echo -e "${YELLOW}Usage: ./scripts/start.sh [production|development]${NC}"
    exit 1
fi

# Make sure script is executable
chmod +x "$0"

# Run main function
main