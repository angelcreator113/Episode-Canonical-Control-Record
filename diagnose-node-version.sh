#!/bin/bash
set -x

echo "🔍 Diagnosing Node version issues..."

# Check what nvm thinks is installed
echo "📋 NVM versions:"
source /home/ubuntu/.nvm/nvm.sh
nvm list

# Check the actual binary
echo "📋 Checking Node 20 binary:"
if [ -f /home/ubuntu/.nvm/versions/node/v20.20.0/bin/node ]; then
    /home/ubuntu/.nvm/versions/node/v20.20.0/bin/node --version
    ls -lh /home/ubuntu/.nvm/versions/node/v20.20.0/bin/node
else
    echo "❌ Node 20 binary not found at expected path"
fi

# Check default node
echo "📋 Default node:"
which node
node --version

# Check PATH
echo "📋 Current PATH:"
echo $PATH

# Try to use Node 20
echo "📋 Switching to Node 20:"
nvm use 20
node --version
which node

echo "📋 Available Node versions in .nvm:"
ls -la /home/ubuntu/.nvm/versions/node/
