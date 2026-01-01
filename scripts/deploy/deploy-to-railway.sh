#!/bin/bash

# 🚀 Quick deployment script for Railway iframe support

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "🎯 Railway Iframe Support Deployment"
echo "======================================"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "❌ Git repository not found!"
    echo "💡 Initialize git first: git init"
    exit 1
fi

# Show current status
echo "📊 Current Git Status:"
git status --short
echo ""

# Ask for confirmation
read -p "🤔 Do you want to commit and push these changes? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

# Add all changes
echo "📦 Adding files..."
git add .

# Commit with message
echo "💾 Committing changes..."
git commit -m "feat: add iframe support for Railway deployment

- Created Express server with iframe-friendly headers
- Removed X-Frame-Options restrictions
- Added permissive Content-Security-Policy
- Configured CORS headers
- Added Railway deployment configuration
- Created test files and documentation"

# Push to remote
echo "🚀 Pushing to remote..."
git push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully deployed!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Check Railway dashboard for build status"
    echo "2. Wait for deployment to complete"
    echo "3. Test iframe embedding with your Railway URL"
    echo "4. Use tools/iframe/iframe-test.html for testing"
    echo ""
    echo "🎉 Done!"
else
    echo ""
    echo "❌ Push failed!"
    echo "💡 Check your git remote configuration"
    echo "   Run: git remote -v"
fi
