#!/bin/bash

# Google Cloud Run Deployment Script (without Docker)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "Google Cloud Run Deployment"
echo "==========================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}ERROR: Google Cloud SDK (gcloud) is not installed.${NC}"
  echo "Install it from: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

echo -e "${GREEN}gcloud found${NC}"
echo ""

CURRENT_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ -z "$CURRENT_PROJECT" ]; then
  echo -e "${YELLOW}No gcloud project is currently set.${NC}"
  read -p "Enter your Google Cloud Project ID: " PROJECT_ID
  gcloud config set project "$PROJECT_ID" >/dev/null
else
  echo "Current project: $CURRENT_PROJECT"
  read -p "Use this project? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    gcloud config set project "$PROJECT_ID" >/dev/null
  else
    PROJECT_ID="$CURRENT_PROJECT"
  fi
fi

SERVICE_NAME="excelmerger-pro"
REGION="europe-west1"

echo ""
echo "Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Service Name: $SERVICE_NAME"
echo "  Region: $REGION"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Deployment cancelled.${NC}"
  exit 0
fi

echo ""
echo "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com

echo ""
echo "Deploying to Cloud Run from source (buildpacks)..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "NODE_ENV=production"

echo ""
echo -e "${GREEN}Deployment successful!${NC}"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')"
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Logs: gcloud run logs tail --service $SERVICE_NAME --region $REGION"
