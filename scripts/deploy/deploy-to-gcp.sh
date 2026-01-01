#!/bin/bash

# 🚀 Google Cloud Run Deployment Script

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "🎯 Google Cloud Run Deployment"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud SDK is not installed!${NC}"
    echo ""
    echo "Install it with:"
    echo "  macOS: brew install --cask google-cloud-sdk"
    echo "  Or visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo -e "${GREEN}✅ Google Cloud SDK found${NC}"
echo ""

# Get current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)

if [ -z "$CURRENT_PROJECT" ]; then
    echo -e "${YELLOW}⚠️  No project is currently set${NC}"
    echo ""
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
echo "📋 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Service Name: excelmerger-pro"
echo "  Region: europe-west1"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Deployment cancelled${NC}"
    exit 0
fi

echo ""
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

echo ""
echo "📦 Building Docker image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/excelmerger-pro

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo ""
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy excelmerger-pro \
  --image gcr.io/$PROJECT_ID/excelmerger-pro \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "NODE_ENV=production"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    
    # Get the service URL
    SERVICE_URL=$(gcloud run services describe excelmerger-pro \
      --region europe-west1 \
      --format 'value(status.url)')
    
    echo "🎉 Your application is now live!"
    echo ""
    echo "📍 Service URL: $SERVICE_URL"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Test the application: open $SERVICE_URL"
    echo "  2. Test iframe embedding with the URL"
    echo "  3. Set up custom domain (optional)"
    echo ""
    echo "🔍 Useful commands:"
    echo "  View logs: gcloud run logs tail --service excelmerger-pro --region europe-west1"
    echo "  Update service: ./scripts/deploy/deploy-to-gcp.sh"
    echo "  Delete service: gcloud run services delete excelmerger-pro --region europe-west1"
    echo ""
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo "Check the logs above for errors."
    exit 1
fi
