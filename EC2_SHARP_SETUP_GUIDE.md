# EC2 Build Tools and Sharp Setup Guide

## Overview

This guide explains how to set up build tools on an EC2 Ubuntu instance and properly configure Sharp (a high-performance Node.js image processing library) to work correctly on the server.

> **Note:** Replace `<EC2_IP_ADDRESS>` with your actual EC2 instance IP and `<PATH_TO_KEY>/<KEY_NAME>.pem` with your SSH key path. For example, if your actual credentials are `ssh -i ~/episode-prod-key.pem ubuntu@54.163.229.144`, use those values.

## Problem Statement

Sharp is a native Node.js module that requires compilation. When deployed to EC2, it may fail with errors like:
- "Invalid ELF header"
- "Module not found"
- "Unexpected binary format"

These errors occur because:
1. Build tools are not installed on the EC2 instance
2. Sharp was compiled on a different system architecture
3. Pre-built binaries are incompatible with the EC2 environment

## Solution

Install build tools and rebuild Sharp from source on the EC2 instance.

---

## Quick Setup (Recommended)

### Method 1: Run the Complete Setup Script

The easiest way to set everything up is to use our all-in-one script:

```bash
# SSH into your EC2 instance
ssh -i <PATH_TO_KEY>/<KEY_NAME>.pem ubuntu@<EC2_IP_ADDRESS>

# Navigate to the project (or clone it if needed)
cd ~/episode-metadata

# Run the complete setup script
bash scripts/ec2-setup-complete.sh
```

This script will:
1. ✅ Install build-essential and dependencies (with sudo)
2. ✅ Rebuild Sharp from source
3. ✅ Restart the episode-api application
4. ✅ Verify everything is working

---

## Manual Setup (Step-by-Step)

If you prefer to run each step manually:

### Step 1: Install Build Tools

```bash
# SSH into your EC2 instance
ssh -i <PATH_TO_KEY>/<KEY_NAME>.pem ubuntu@<EC2_IP_ADDRESS>

# Install build-essential (requires sudo)
sudo apt-get update
sudo apt-get install -y build-essential

# Install additional dependencies for Sharp
sudo apt-get install -y \
  python3 \
  python3-pip \
  pkg-config \
  libpixman-1-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev
```

### Step 2: Navigate to Project

```bash
cd ~/episode-metadata
```

### Step 3: Rebuild Sharp from Source

```bash
# Remove existing Sharp installation
npm uninstall sharp

# Install Sharp with build-from-source flag
npm install --build-from-source=sharp sharp
```

### Step 4: Restart Application

```bash
# Start the application with PM2
pm2 start episode-api

# Save PM2 configuration
pm2 save
```

### Step 5: Verify Installation

```bash
# Check Sharp is working
node -e "const sharp = require('sharp'); console.log('Sharp version:', sharp.versions);"

# Check PM2 status
pm2 status

# Monitor logs
pm2 logs episode-api --lines 50
```

---

## Using Individual Scripts

We also provide individual scripts for each step:

### Install Build Tools Only

```bash
# Run with sudo
sudo bash scripts/setup-ec2-build-tools.sh
```

### Rebuild Sharp Only

```bash
# Run as regular user (no sudo needed)
bash scripts/rebuild-sharp.sh
```

---

## Automated Deployment

The deployment script (`.github/scripts/deploy-to-ec2.sh`) now automatically rebuilds Sharp during deployment:

```bash
# This is automatically run during CI/CD deployment
npm install
npm rebuild sharp --build-from-source
```

---

## Troubleshooting

### Error: "Invalid ELF header"

**Cause:** Sharp was compiled for a different architecture.

**Solution:** Rebuild Sharp from source:
```bash
npm uninstall sharp
npm install --build-from-source=sharp sharp
```

### Error: "command 'gcc' not found"

**Cause:** Build tools are not installed.

**Solution:** Install build-essential:
```bash
sudo apt-get update
sudo apt-get install -y build-essential
```

### Error: "Module version mismatch"

**Cause:** Sharp was compiled for a different Node.js version.

**Solution:** Rebuild Sharp:
```bash
npm rebuild sharp --build-from-source
```

### Sharp Import Fails

**Cause:** Missing system dependencies.

**Solution:** Install all required libraries:
```bash
sudo apt-get install -y libpixman-1-dev libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev
```

---

## Verification Commands

After setup, use these commands to verify everything is working:

```bash
# Check Sharp version and configuration
node -e "const sharp = require('sharp'); console.log('Sharp:', sharp.versions);"

# Check installed build tools
gcc --version
make --version
python3 --version

# Check PM2 status
pm2 status

# View application logs
pm2 logs episode-api --lines 100

# Test Sharp functionality in application
curl http://localhost:3002/health
```

---

## Why Build from Source?

Building Sharp from source ensures:
1. ✅ **Compatibility** - Compiled specifically for your EC2 instance architecture
2. ✅ **Performance** - Optimized for your specific system
3. ✅ **Reliability** - No binary compatibility issues
4. ✅ **Latest features** - Uses the most recent libvips features

---

## Package.json Configuration

The project's `package.json` already includes Sharp as a dependency:

```json
{
  "dependencies": {
    "sharp": "^0.34.5"
  }
}
```

No changes are needed to `package.json`. The `--build-from-source` flag is used during installation, not in the package definition.

---

## Additional Resources

- **Sharp Documentation**: https://sharp.pixelplumbing.com/
- **Sharp Installation Guide**: https://sharp.pixelplumbing.com/install
- **Build Requirements**: https://sharp.pixelplumbing.com/install#prerequisites

---

## File References

- **Complete Setup Script**: `scripts/ec2-setup-complete.sh`
- **Build Tools Setup**: `scripts/setup-ec2-build-tools.sh`
- **Sharp Rebuild Script**: `scripts/rebuild-sharp.sh`
- **Deployment Script**: `.github/scripts/deploy-to-ec2.sh`

---

## Support

If you encounter issues:

1. Check the PM2 logs: `pm2 logs episode-api`
2. Verify Sharp installation: `node -e "require('sharp').versions"`
3. Check build tools: `gcc --version && make --version`
4. Review this documentation for troubleshooting steps

For persistent issues, consider:
- Checking system resources (disk space, memory)
- Reviewing system logs: `journalctl -u pm2-*`
- Verifying Node.js version compatibility
