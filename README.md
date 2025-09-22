# Sleep Detection Classroom Monitoring System

A comprehensive AI-powered system for monitoring student attention and sleep detection in classroom environments using computer vision and face recognition technology.

## Features

- 🎥 **Real-time Video Streaming** - Live camera feed with MJPEG streaming
- 👁️ **Sleep Detection** - AI-powered eye state analysis using TensorFlow
- 👤 **Face Recognition** - Automatic student identification
- 📚 **Course Management** - Track sleeping students by course
- 👨‍💼 **User Management** - Admin dashboard for student and teacher management
- 📊 **Behavior Reports** - Generate and manage student behavior reports
- 🔒 **Role-based Access** - Different access levels for admin, teacher, and student roles

## Tech Stack

### Backend
- **FastAPI** - Modern, fast web framework for Python
- **MongoDB** - NoSQL database for user and course data
- **TensorFlow** - Machine learning for sleep detection
- **OpenCV** - Computer vision processing
- **Face Recognition** - Face detection and recognition
- **Uvicorn** - ASGI server

### Frontend
- **React** - Frontend framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server

## AWS EC2 Deployment Guide

### Prerequisites
- AWS Account with EC2 access
- SSH key pair
- Domain name (optional, for SSL)

### Step 1: Launch EC2 Instance

1. **Login to AWS Console**
   ```bash
   # Navigate to EC2 Dashboard
   # Click "Launch Instance"
   ```

2. **Configure Instance**
   - **Name**: `sleep-detection-server`
   - **AMI**: Ubuntu Server 22.04 LTS (64-bit x86)
   - **Instance Type**: `t3.medium` (minimum) or `t3.large` (recommended)
   - **Key Pair**: Select your existing key pair or create new one
   - **Security Group**: Create new with following rules:
     ```
     Type        Protocol    Port Range    Source
     SSH         TCP         22           0.0.0.0/0
     HTTP        TCP         80           0.0.0.0/0
     HTTPS       TCP         443          0.0.0.0/0
     Custom TCP  TCP         8000         0.0.0.0/0  (FastAPI)
     Custom TCP  TCP         3000         0.0.0.0/0  (React Dev)
     Custom TCP  TCP         27017        10.0.0.0/8  (MongoDB - VPC only)
     ```

3. **Storage Configuration**
   - **Root Volume**: 30 GB gp3 (minimum)
   - **Additional Volume**: 20 GB for MongoDB data (optional)

### Step 2: Connect to EC2 Instance

```bash
# Connect via SSH
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Update system packages
sudo apt update && sudo apt upgrade -y
```

### Step 3: Install System Dependencies

```bash
# Install essential packages
sudo apt install -y wget curl git vim unzip software-properties-common

# Install Python and pip
sudo apt install -y python3 python3-pip python3-venv python3-dev

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install build tools for face_recognition
sudo apt install -y build-essential cmake pkg-config
sudo apt install -y libx11-dev libatlas-base-dev libgtk-3-dev libboost-python-dev

# Install system libraries for OpenCV
sudo apt install -y libopencv-dev python3-opencv
sudo apt install -y libavcodec-dev libavformat-dev libswscale-dev
sudo apt install -y libgstreamer-plugins-base1.0-dev libgstreamer1.0-dev
```

### Step 4: Install and Configure MongoDB

```bash
# Import MongoDB GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update and install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify MongoDB is running
sudo systemctl status mongod
```

### Step 5: Configure Firewall

```bash
# Enable UFW firewall
sudo ufw enable

# Allow necessary ports
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 8000
sudo ufw allow 3000

# Check firewall status
sudo ufw status
```

### Step 6: Clone and Setup Project

```bash
# Create project directory
sudo mkdir -p /var/www/sleep-detection
sudo chown ubuntu:ubuntu /var/www/sleep-detection
cd /var/www/sleep-detection

# Clone your project (replace with your repository URL)
git clone https://github.com/yourusername/your-repo.git .

# Or upload files via SCP
# scp -i your-key.pem -r ./Project ubuntu@your-ec2-ip:/var/www/sleep-detection/
```

### Step 7: Setup Backend

```bash
# Navigate to backend directory
cd /var/www/sleep-detection/Backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Python dependencies
pip install -r requirements.txt

# Create environment variables file
nano .env
```

**Add to `.env` file:**
```env
# Database
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=Project_sleep_classroom

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=False

# Security
SECRET_KEY=your-super-secret-key-change-this

# File paths
STATIC_DIR=/var/www/sleep-detection/Backend/static
MODEL_PATH=/var/www/sleep-detection/Backend/model/Eye_Detection.keras
FACE_LANDMARKS_PATH=/var/www/sleep-detection/Backend/shape_predictor_68_face_landmarks.dat
```

### Step 8: Setup Frontend

```bash
# Navigate to frontend directory
cd /var/www/sleep-detection/Frontend

# Install dependencies
npm install

# Create production build
npm run build

# Install serve for serving static files
sudo npm install -g serve pm2
```

### Step 9: Install and Configure Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/sleep-detection
```

**Add Nginx configuration:**
```nginx
upstream backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain or EC2 public IP
    
    client_max_body_size 50M;
    
    # Frontend (React build)
    location / {
        root /var/www/sleep-detection/Frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files (profile images, etc.)
    location /static/ {
        alias /var/www/sleep-detection/Backend/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Video streaming endpoint
    location /video_feed {
        proxy_pass http://backend/video_feed;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/sleep-detection /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Step 10: Create Systemd Service for Backend

```bash
# Create systemd service file
sudo nano /etc/systemd/system/sleep-detection-backend.service
```

**Add service configuration:**
```ini
[Unit]
Description=Sleep Detection Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/sleep-detection/Backend
Environment=PATH=/var/www/sleep-detection/Backend/venv/bin
ExecStart=/var/www/sleep-detection/Backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
# Reload systemd and start service
sudo systemctl daemon-reload
sudo systemctl start sleep-detection-backend
sudo systemctl enable sleep-detection-backend

# Check service status
sudo systemctl status sleep-detection-backend
```

### Step 11: Setup SSL with Let's Encrypt (Optional)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 12: Configure MongoDB Security

```bash
# Create MongoDB admin user
mongosh

# In MongoDB shell:
use admin
db.createUser({
  user: "admin",
  pwd: "your-strong-password",
  roles: ["userAdminAnyDatabase", "readWriteAnyDatabase"]
})

# Create application user
use Project_sleep_classroom
db.createUser({
  user: "sleep_app",
  pwd: "app-password",
  roles: ["readWrite"]
})

exit
```

**Update MongoDB configuration:**
```bash
sudo nano /etc/mongod.conf
```

```yaml
# Enable authentication
security:
  authorization: enabled

# Bind to localhost only (more secure)
net:
  bindIp: 127.0.0.1
  port: 27017
```

```bash
# Restart MongoDB
sudo systemctl restart mongod
```

### Step 13: Update Backend Configuration

```bash
# Update .env file with MongoDB credentials
nano /var/www/sleep-detection/Backend/.env
```

```env
MONGODB_URL=mongodb://sleep_app:app-password@localhost:27017/Project_sleep_classroom?authSource=Project_sleep_classroom
```

```bash
# Restart backend service
sudo systemctl restart sleep-detection-backend
```

### Step 14: Setup Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/sleep-detection
```

```bash
/var/log/sleep-detection/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload sleep-detection-backend
    endscript
}
```

### Step 15: Setup Monitoring and Backup

```bash
# Create backup script
nano /home/ubuntu/backup-mongodb.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --out "$BACKUP_DIR/mongodb_$DATE" --authenticationDatabase Project_sleep_classroom -u sleep_app -p app-password

# Keep only last 7 days of backups
find $BACKUP_DIR -name "mongodb_*" -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $DATE"
```

```bash
# Make script executable
chmod +x /home/ubuntu/backup-mongodb.sh

# Add to crontab for daily backups
crontab -e

# Add this line:
0 2 * * * /home/ubuntu/backup-mongodb.sh >> /home/ubuntu/backup.log 2>&1
```

### Step 16: Final Security Hardening

```bash
# Update SSH configuration
sudo nano /etc/ssh/sshd_config

# Recommended changes:
# PasswordAuthentication no
# PermitRootLogin no
# Port 2222  # Change default SSH port

# Restart SSH service
sudo systemctl restart ssh

# Install fail2ban for intrusion prevention
sudo apt install -y fail2ban

# Configure fail2ban
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[ssh]
enabled = true
port = 2222  # Match your SSH port
```

```bash
# Start fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### Step 17: Test Deployment

1. **Test Backend API:**
   ```bash
   curl http://your-domain.com/api/
   ```

2. **Test Frontend:**
   - Open browser: `http://your-domain.com`

3. **Test Video Streaming:**
   - Access the streaming endpoint through the web interface

4. **Check Logs:**
   ```bash
   # Backend logs
   sudo journalctl -u sleep-detection-backend -f
   
   # Nginx logs
   sudo tail -f /var/log/nginx/access.log
   sudo tail -f /var/log/nginx/error.log
   ```

### Step 18: Maintenance Commands

```bash
# Restart all services
sudo systemctl restart sleep-detection-backend nginx mongod

# Check service status
sudo systemctl status sleep-detection-backend nginx mongod

# Update project
cd /var/www/sleep-detection
git pull origin main
sudo systemctl restart sleep-detection-backend

# Monitor system resources
htop
df -h
free -m
```

## Troubleshooting

### Common Issues

1. **Camera Access Issues:**
   ```bash
   # Check camera permissions
   ls -la /dev/video*
   sudo usermod -a -G video ubuntu
   ```

2. **MongoDB Connection Issues:**
   ```bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Check MongoDB logs
   sudo tail -f /var/log/mongodb/mongod.log
   ```

3. **Face Recognition Installation Issues:**
   ```bash
   # Install additional dependencies
   sudo apt install -y libopenblas-dev liblapack-dev
   pip install --upgrade setuptools wheel
   ```

4. **Memory Issues:**
   ```bash
   # Add swap space
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

### Performance Optimization

1. **Enable Gzip in Nginx:**
   ```nginx
   gzip on;
   gzip_vary on;
   gzip_min_length 1024;
   gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
   ```

2. **Optimize TensorFlow:**
   ```bash
   # Set TensorFlow to use CPU optimization
   export TF_CPP_MIN_LOG_LEVEL=2
   export OMP_NUM_THREADS=4
   ```

## Security Considerations

- Always use HTTPS in production
- Regularly update system packages
- Use strong passwords for database users
- Implement rate limiting
- Monitor system logs
- Regular security audits
- Backup data regularly
- Use VPC for database access only

## Support

For issues and questions, please check the logs and ensure all dependencies are properly installed.

---

**Note:** Replace placeholder values (domain names, passwords, etc.) with your actual values before deployment.