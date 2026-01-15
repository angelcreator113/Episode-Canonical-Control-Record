#!/bin/bash

# Episode Canonical Control - Start Script
# Starts both backend API server and frontend development server

echo "🚀 Starting Episode Canonical Control System..."
echo ""

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}📦 Backend Server${NC}"
echo "Starting API server on port 3002..."
cd "$SCRIPT_DIR" || exit

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

# Start backend in background
npm start &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend starting (PID: $BACKEND_PID)${NC}"

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

echo ""
echo -e "${BLUE}🎨 Frontend Development Server${NC}"
echo "Starting frontend on port 5173..."

# Start frontend
cd "$SCRIPT_DIR/frontend" || exit

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend starting (PID: $FRONTEND_PID)${NC}"

echo ""
echo -e "${GREEN}✅ System Started!${NC}"
echo ""
echo "📍 Frontend:  http://localhost:5173"
echo "📍 API:       http://localhost:3002"
echo "📍 Health:    http://localhost:3002/health"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Handle cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

# Wait for all background jobs
wait
