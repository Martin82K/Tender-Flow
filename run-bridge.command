#!/bin/bash

# Navigate to the script's directory
cd "$(dirname "$0")"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         CRM MCP Bridge Server                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Starting MCP Bridge Server..."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed."
    echo "Please install Node.js from https://nodejs.org/"
    echo ""
    read -p "Press any key to close..."
    exit 1
fi

# Navigate to server directory
cd mcp-bridge-server

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
npm start

echo ""
echo "Server stopped."
read -p "Press any key to close..."
