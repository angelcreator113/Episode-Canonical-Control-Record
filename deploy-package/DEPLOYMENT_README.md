# Deployment Package - Episode Canonical Control Record

**Created:** January 23, 2026  
**Package Size:** ~3 MB  
**Files:** 135 files  

---

## 📦 Package Contents

```
deploy-package/
├── backend/                    # Backend application (~1 MB)
│   ├── config/                # Database & app configuration
│   ├── controllers/           # Business logic controllers
│   ├── models/                # Sequelize database models
│   ├── routes/                # Express API routes
│   ├── services/              # Business logic services
│   ├── middleware/            # Express middleware
│   ├── migrations/            # Database migrations
│   ├── utils/                 # Utility functions
│   ├── app.js                 # Express app setup
│   ├── server.js              # Server entry point
│   ├── package.json           # Dependencies
│   └── .env.production        # Production environment config
│
└── frontend-build/            # Production frontend (~2 MB)
    ├── assets/                # Compiled JS/CSS bundles
    │   ├── index-DucqEtiK.js (1.43 MB) - Main application
    │   ├── index-EOx05SYK.css (273 KB) - Styles
    │   └── Other chunks
    └── index.html             # Entry HTML file
```

---

## 🚀 Deployment Instructions

### **Option 1: Deploy to AWS EC2**

#### 1. Upload to EC2
```bash
# From your local machine
scp -i your-key.pem -r deploy-package ec2-user@your-ec2-ip:/home/ec2-user/

# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip
```

#### 2. Set up Backend
```bash
cd /home/ec2-user/deploy-package/backend

# Install dependencies
npm install --production

# Update .env.production with actual values:
nano .env.production

# Required variables:
# - DB_HOST=episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com
# - DB_PASSWORD=Ayanna123!!
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - COGNITO_USER_POOL_ID
# - S3_BUCKET_NAME

# Run migrations
NODE_ENV=production node_modules/.bin/sequelize db:migrate

# Start with PM2
npm install -g pm2
pm2 start server.js --name "episode-api" --env production
pm2 save
pm2 startup
```

#### 3. Set up Frontend (Nginx)
```bash
# Install Nginx
sudo yum install nginx -y

# Copy frontend build
sudo cp -r /home/ec2-user/deploy-package/frontend-build/* /usr/share/nginx/html/

# Configure Nginx
sudo nano /etc/nginx/conf.d/episode.conf
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name dev.primepisodes.com;
    root /usr/share/nginx/html;
    index index.html;

    # Frontend - SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

### **Option 2: Deploy with Docker**

#### 1. Create Dockerfile for Backend
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./
EXPOSE 3002
CMD ["node", "server.js"]
```

#### 2. Create docker-compose.yml
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3002:3002"
    env_file:
      - backend/.env.production
    restart: always
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend-build:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - api
    restart: always
```

#### 3. Deploy
```bash
docker-compose up -d
```

---

## 🔧 Environment Configuration

### Backend (.env.production)

**Current values from .env.production:**
```env
NODE_ENV=production
PORT=3002

# Database
DB_HOST=episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=episode_metadata
DB_USER=postgres
DB_PASSWORD=Ayanna123!!

# AWS (FILL IN)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=primepisodes-assets

# Cognito (FILL IN)
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_REGION=us-east-1
```

**⚠️ IMPORTANT:** Update these values before deployment:
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- COGNITO_USER_POOL_ID
- COGNITO_CLIENT_ID

---

## ✅ Pre-Deployment Checklist

- [ ] Update `.env.production` with actual AWS credentials
- [ ] Verify RDS database is accessible from EC2
- [ ] Confirm S3 bucket exists: `primepisodes-assets`
- [ ] Verify Cognito User Pool is created
- [ ] Update security group to allow EC2 → RDS (port 5432)
- [ ] Update security group to allow Internet → EC2 (ports 80, 443)
- [ ] Run database migrations
- [ ] Test API endpoint: `http://your-ec2-ip:3002/health`
- [ ] Test frontend: `http://your-ec2-ip/`
- [ ] Configure DNS: dev.primepisodes.com → EC2 IP
- [ ] Set up SSL certificate (Let's Encrypt or AWS ACM)

---

## 🧪 Testing After Deployment

### 1. Backend Health Check
```bash
curl http://your-ec2-ip:3002/health
# Expected: {"status": "ok"}
```

### 2. Database Connection
```bash
curl http://your-ec2-ip:3002/api/shows
# Expected: [] or list of shows
```

### 3. Frontend Access
```bash
curl http://your-ec2-ip/
# Expected: HTML content with React app
```

### 4. Full Integration Test
- Visit `http://your-ec2-ip/` in browser
- Should see login page or home page
- Check browser console for API errors
- Test creating an episode
- Test uploading an asset

---

## 📊 Deployment Resources

### AWS Resources Required

**Compute:**
- ✅ EC2 Instance: i-02ae7608c531db485
- ⏳ Configure security groups for ports 80, 443, 3002

**Database:**
- ✅ RDS Instance: episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com
- ⏳ Run migrations

**Storage:**
- ✅ S3 Bucket: primepisodes-assets
- ⏳ Verify IAM permissions

**Auth:**
- ⏳ Cognito User Pool (needs configuration)

**Networking:**
- ⏳ Route 53: dev.primepisodes.com → EC2 IP
- ⏳ SSL Certificate (ACM or Let's Encrypt)

---

## 🔒 Security Considerations

1. **Environment Variables:** Never commit `.env.production` with real credentials
2. **Database Password:** Consider using AWS Secrets Manager
3. **AWS Keys:** Use IAM roles instead of access keys when possible
4. **HTTPS:** Always use SSL/TLS in production
5. **Security Groups:** Restrict RDS access to EC2 security group only
6. **CORS:** Configure proper CORS headers in Express
7. **Rate Limiting:** Consider adding rate limiting to API

---

## 📈 Monitoring & Logs

### Backend Logs
```bash
# PM2 logs
pm2 logs episode-api

# Application logs (if configured)
tail -f /var/log/episode-api.log
```

### Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Database Monitoring
- Use AWS RDS Console for database metrics
- CloudWatch for EC2 monitoring

---

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check logs
pm2 logs episode-api

# Common issues:
# - Database connection failed → Check security groups
# - Missing environment variables → Verify .env.production
# - Port already in use → Check: lsof -i :3002
```

### Frontend shows white screen
```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify files copied correctly
ls -la /usr/share/nginx/html/

# Check API endpoint in browser console
# Should be pointing to correct backend URL
```

### Cannot connect to RDS
```bash
# Test from EC2
psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com -U postgres -d episode_metadata

# If fails:
# - Check security group allows EC2 → RDS on port 5432
# - Verify RDS is in same VPC or publicly accessible
# - Confirm password is correct
```

---

## 📞 Support

For deployment issues, refer to:
- [AWS_INFRASTRUCTURE_SETUP.md](../AWS_INFRASTRUCTURE_SETUP.md)
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
- [PROJECT_MANAGER_HANDOFF.md](../PROJECT_MANAGER_HANDOFF.md)

---

**Next Steps:**
1. Choose deployment method (EC2 direct or Docker)
2. Complete Pre-Deployment Checklist
3. Deploy backend and frontend
4. Run tests
5. Configure DNS and SSL
6. Monitor application

**Estimated Deployment Time:** 1-2 hours (first time)
