# Sharp Build Tools Quick Reference

> **Quick commands for setting up build tools and Sharp on EC2**

## TL;DR - One Command Setup

```bash
ssh -i ~/episode-prod-key.pem ubuntu@54.163.229.144 "cd ~/episode-metadata && bash scripts/ec2-setup-complete.sh"
```

## Individual Commands (Original Issue)

```bash
# 1. SSH into EC2
ssh -i ~/episode-prod-key.pem ubuntu@54.163.229.144

# 2. Install build tools
sudo apt-get install -y build-essential

# 3. Navigate to project
cd ~/episode-metadata

# 4. Rebuild Sharp from source
npm uninstall sharp
npm install --build-from-source=sharp sharp

# 5. Restart application
pm2 start episode-api
pm2 save
```

## Automated Scripts

| Script | Purpose | Requires Sudo |
|--------|---------|---------------|
| `scripts/ec2-setup-complete.sh` | Complete setup (all steps) | Yes |
| `scripts/setup-ec2-build-tools.sh` | Install build tools only | Yes |
| `scripts/rebuild-sharp.sh` | Rebuild Sharp only | No |

## Verification

```bash
# Check Sharp is working
node -e "const sharp = require('sharp'); console.log('Sharp:', sharp.versions);"

# Check application status
pm2 status
pm2 logs episode-api
```

## See Also

- Full documentation: [EC2_SHARP_SETUP_GUIDE.md](./EC2_SHARP_SETUP_GUIDE.md)
- Deployment script: [.github/scripts/deploy-to-ec2.sh](./.github/scripts/deploy-to-ec2.sh)
