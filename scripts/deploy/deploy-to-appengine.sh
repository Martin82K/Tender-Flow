#!/bin/bash

# 🚀 Google App Engine Deployment Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "🎯 Google App Engine Deployment"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud SDK is not installed!${NC}"
    echo ""
    echo "Install it with:"
    echo "  macOS: brew install --cask google-cloud-sdk"
    exit 1
fi

echo -e "${GREEN}✅ Google Cloud SDK found${NC}"
echo ""

# Get current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)

if [ -z "$CURRENT_PROJECT" ]; then
    echo -e "${YELLOW}⚠️  No project is currently set${NC}"
    read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    gcloud config set project "$PROJECT_ID"
else
    echo "Current project: $CURRENT_PROJECT"
    read -p "Use this project? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your Google Cloud Project ID: " PROJECT_ID
        gcloud config set project "$PROJECT_ID"
    else
        PROJECT_ID=$CURRENT_PROJECT
    fi
fi

echo ""
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo ""
echo "🚀 Deploying to App Engine..."
gcloud app deploy --quiet

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    
    # Get the service URL
    SERVICE_URL=$(gcloud app describe --format='value(defaultHostname)')
    
    echo "🎉 Your application is now live!"
    echo ""
    echo "📍 Service URL: https://$SERVICE_URL"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Open app: gcloud app browse"
    echo "  2. View logs: gcloud app logs tail"
    echo "  3. Test iframe embedding"
    echo ""
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi
