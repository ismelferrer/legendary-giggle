#!/bin/bash

# WhatsApp Worker Render Deployment Script
# This script helps prepare and deploy the WhatsApp Worker to Render

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 WhatsApp Worker Render Deployment${NC}"
echo -e "${GREEN}====================================${NC}"

# Function to check if required tools are installed
check_requirements() {
    echo -e "${YELLOW}🔍 Checking requirements...${NC}"
    
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ Git is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is required but not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All requirements met${NC}"
}

# Function to validate package.json
validate_package() {
    echo -e "${YELLOW}📦 Validating package.json...${NC}"
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found${NC}"
        exit 1
    fi
    
    # Check for required scripts
    if ! grep -q '"start"' package.json; then
        echo -e "${RED}❌ start script not found in package.json${NC}"
        exit 1
    fi
    
    # Check for required dependencies
    local required_deps=("whatsapp-web.js" "@supabase/supabase-js" "express" "bull" "redis")
    for dep in "${required_deps[@]}"; do
        if ! grep -q "\"$dep\"" package.json; then
            echo -e "${YELLOW}⚠️  Warning: $dep not found in dependencies${NC}"
        fi
    done
    
    echo -e "${GREEN}✅ Package.json validated${NC}"
}

# Function to check environment configuration
check_env_config() {
    echo -e "${YELLOW}🔧 Checking environment configuration...${NC}"
    
    if [ ! -f ".env.example" ]; then
        echo -e "${YELLOW}⚠️  .env.example not found${NC}"
    else
        echo -e "${GREEN}✅ .env.example found${NC}"
    fi
    
    if [ ! -f "render.yaml" ]; then
        echo -e "${YELLOW}⚠️  render.yaml not found - creating one...${NC}"
        echo "Please ensure render.yaml is configured properly"
    else
        echo -e "${GREEN}✅ render.yaml found${NC}"
    fi
}

# Function to run tests
run_tests() {
    echo -e "${YELLOW}🧪 Running tests...${NC}"
    
    # Install dependencies first
    npm install
    
    # Run basic syntax check
    node -c index.js
    echo -e "${GREEN}✅ Syntax check passed${NC}"
    
    # Test configuration loading
    node -e "
        try {
            require('./src/config');
            console.log('✅ Configuration loads successfully');
        } catch (error) {
            console.error('❌ Configuration error:', error.message);
            process.exit(1);
        }
    "
}

# Function to prepare for deployment
prepare_deployment() {
    echo -e "${YELLOW}📋 Preparing for deployment...${NC}"
    
    # Clean node_modules and reinstall
    rm -rf node_modules package-lock.json
    npm install
    
    # Ensure logs directory exists in gitignore
    if ! grep -q "logs/" .gitignore 2>/dev/null; then
        echo "logs/" >> .gitignore
        echo -e "${GREEN}✅ Added logs/ to .gitignore${NC}"
    fi
    
    # Ensure .wwebjs_auth is in gitignore
    if ! grep -q ".wwebjs_auth/" .gitignore 2>/dev/null; then
        echo ".wwebjs_auth/" >> .gitignore
        echo -e "${GREEN}✅ Added .wwebjs_auth/ to .gitignore${NC}"
    fi
    
    echo -e "${GREEN}✅ Deployment preparation complete${NC}"
}

# Function to show deployment instructions
show_instructions() {
    echo -e "${BLUE}📋 Render Deployment Instructions${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo ""
    echo -e "${YELLOW}1. Create a Render account:${NC}"
    echo "   https://render.com"
    echo ""
    echo -e "${YELLOW}2. Create a new Web Service:${NC}"
    echo "   - Connect your GitHub repository"
    echo "   - Select this repository and branch"
    echo "   - Choose 'Docker' or 'Node' environment"
    echo ""
    echo -e "${YELLOW}3. Configure Environment Variables:${NC}"
    echo "   Required variables:"
    echo "   - SUPABASE_URL=https://your-project.supabase.co"
    echo "   - SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
    echo "   - USE_SUPABASE_AUTH=true"
    echo "   - WEBSERVICE_API_URL=https://your-webservice.render.com"
    echo "   - REDIS_URL=redis://your-redis-url (use Render Redis add-on)"
    echo ""
    echo -e "${YELLOW}4. Optional variables:${NC}"
    echo "   - WHATSAPP_SESSION_NAME=your-session-name"
    echo "   - BOT_PREFIX=!"
    echo "   - LOG_LEVEL=info"
    echo ""
    echo -e "${YELLOW}5. Add Redis Add-on:${NC}"
    echo "   - Go to your service dashboard"
    echo "   - Click 'Add-ons' -> 'Redis'"
    echo "   - This will auto-configure REDIS_URL"
    echo ""
    echo -e "${YELLOW}6. Create Supabase table:${NC}"
    echo "   - Run scripts/create_supabase_table.sql in your Supabase SQL editor"
    echo ""
    echo -e "${YELLOW}7. Deploy:${NC}"
    echo "   - Push your code to GitHub"
    echo "   - Render will automatically deploy"
    echo ""
    echo -e "${GREEN}8. After deployment:${NC}"
    echo "   - Access /health endpoint to verify deployment"
    echo "   - Check /api/whatsapp/info for QR code"
    echo "   - Scan QR code with WhatsApp to authenticate"
    echo ""
}

# Function to show post-deployment checklist
show_checklist() {
    echo -e "${BLUE}✅ Post-Deployment Checklist${NC}"
    echo -e "${BLUE}===========================${NC}"
    echo ""
    echo "□ Service deployed successfully"
    echo "□ Health check (/health) returns 200"
    echo "□ Supabase table created"
    echo "□ Redis connection working"
    echo "□ Environment variables configured"
    echo "□ WhatsApp QR code generated"
    echo "□ WhatsApp authenticated"
    echo "□ Bot responds to messages"
    echo "□ Webservice integration working"
    echo ""
    echo -e "${YELLOW}Useful endpoints:${NC}"
    echo "- Health: https://your-app.onrender.com/health"
    echo "- Status: https://your-app.onrender.com/api/status"
    echo "- WhatsApp Info: https://your-app.onrender.com/api/whatsapp/info"
    echo "- Stats: https://your-app.onrender.com/api/stats"
}

# Main execution
main() {
    check_requirements
    validate_package
    check_env_config
    run_tests
    prepare_deployment
    
    echo -e "${GREEN}🎉 Deployment preparation complete!${NC}"
    echo ""
    
    show_instructions
    show_checklist
    
    echo ""
    echo -e "${GREEN}🚀 Ready to deploy to Render!${NC}"
    echo -e "${YELLOW}Push your code to GitHub and connect it to Render.${NC}"
}

# Check if script is being run from correct directory
if [ ! -f "package.json" ] || [ ! -f "index.js" ]; then
    echo -e "${RED}❌ Please run this script from the whatsapp-worker directory${NC}"
    exit 1
fi

# Run main function
main