# Isso Comment System Deployment Guide

This guide explains how to deploy and configure Isso for anonymous commenting on your Contentful blog.

## Overview

Isso is a lightweight, privacy-focused commenting system that supports anonymous commenting. It stores comments in a SQLite database and provides a simple REST API.

## Deployment Options

### Option 1: Railway (Recommended - Free Tier Available)

1. **Prepare your repository**
   ```bash
   # Create a new directory for Isso deployment
   mkdir isso-server
   cd isso-server
   
   # Create Dockerfile
   cat > Dockerfile << 'EOF'
   FROM python:3.11-slim
   
   RUN pip install isso gunicorn
   
   WORKDIR /app
   COPY isso.conf /app/
   
   EXPOSE 8080
   
   CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--worker-class", "gevent", "--workers", "1", "isso.run:application"]
   EOF
   
   # Create configuration file
   cat > isso.conf << 'EOF'
   [general]
   dbpath = /tmp/comments.db
   host = https://yourdomain.com
   max-age = 15m
   notify = stdout
   
   [server]
   listen = http://0.0.0.0:8080/
   
   [markup]
   options = strikethrough, superscript, autolink
   allowed-elements = 
   allowed-attributes = 
   
   [hash]
   algorithm = pbkdf2
   
   [moderation]
   enabled = false
   
   [admin]
   enabled = true
   password = your-admin-password-here
   
   [guard]
   enabled = true
   ratelimit = 2
   direct-reply = 3
   reply-to-self = false
   require-author = false
   require-email = false
   EOF
   
   git init
   git add .
   git commit -m "Initial Isso server setup"
   ```

2. **Deploy to Railway**
   - Go to [Railway.app](https://railway.app)
   - Sign up/login with GitHub
   - Click "Deploy from GitHub repo"
   - Select your isso-server repository
   - Railway will automatically detect the Dockerfile and deploy

3. **Configure Environment Variables in Railway**
   - In Railway dashboard, go to Variables tab
   - Add: `PORT = 8080`
   - Add: `ISSO_SETTINGS = /app/isso.conf`

4. **Update Configuration**
   - Get your Railway app URL (e.g., `https://your-app-name.railway.app`)
   - Update `isso.conf` with your domain and Railway URL
   - Redeploy

### Option 2: Render (Free Tier Available)

1. **Create Web Service on Render**
   - Go to [Render.com](https://render.com)
   - Click "New Web Service"
   - Connect your GitHub repository
   - Use these settings:
     - **Build Command**: `pip install isso gunicorn`
     - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --worker-class gevent --workers 1 isso.run:application`

2. **Environment Variables**
   - `ISSO_SETTINGS = /opt/render/project/src/isso.conf`

### Option 3: DigitalOcean App Platform

1. **Create App**
   - Go to DigitalOcean App Platform
   - Create new app from GitHub
   - Use Docker deployment

2. **Configuration**
   - Set HTTP routes to your domain
   - Configure environment variables

### Option 4: Self-hosted VPS

1. **Install Isso on Ubuntu/Debian**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Python and pip
   sudo apt install python3 python3-pip nginx -y
   
   # Install Isso
   pip3 install isso
   
   # Create configuration directory
   sudo mkdir -p /etc/isso
   sudo chown $USER:$USER /etc/isso
   
   # Create configuration file
   cat > /etc/isso/isso.conf << 'EOF'
   [general]
   dbpath = /var/lib/isso/comments.db
   host = https://yourdomain.com
   max-age = 15m
   notify = stdout
   
   [server]
   listen = http://localhost:8080/
   
   [markup]
   options = strikethrough, superscript, autolink
   
   [moderation]
   enabled = false
   
   [admin]
   enabled = true
   password = your-secure-password
   
   [guard]
   enabled = true
   ratelimit = 2
   direct-reply = 3
   reply-to-self = false
   require-author = false
   require-email = false
   EOF
   
   # Create database directory
   sudo mkdir -p /var/lib/isso
   sudo chown $USER:$USER /var/lib/isso
   
   # Create systemd service
   sudo cat > /etc/systemd/system/isso.service << 'EOF'
   [Unit]
   Description=Isso Comment Server
   After=network.target
   
   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/lib/isso
   ExecStart=/usr/local/bin/isso -c /etc/isso/isso.conf run
   Restart=always
   
   [Install]
   WantedBy=multi-user.target
   EOF
   
   # Start and enable service
   sudo systemctl daemon-reload
   sudo systemctl enable isso
   sudo systemctl start isso
   ```

2. **Configure Nginx**
   ```bash
   sudo cat > /etc/nginx/sites-available/isso << 'EOF'
   server {
       listen 80;
       server_name comments.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           
           # CORS headers
           add_header Access-Control-Allow-Origin "https://yourdomain.com" always;
           add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
           add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
           
           if ($request_method = 'OPTIONS') {
               return 204;
           }
       }
   }
   EOF
   
   # Enable site
   sudo ln -s /etc/nginx/sites-available/isso /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   
   # Get SSL certificate with Certbot
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d comments.yourdomain.com
   ```

## Configuration

### Basic Configuration Options

```ini
[general]
# SQLite database path
dbpath = /path/to/comments.db

# Your website domain(s) - supports multiple domains
host = https://yourdomain.com, https://www.yourdomain.com

# Session timeout for anonymous users
max-age = 15m

# Notification method (stdout, smtp)
notify = stdout

[server]
# Server listen address
listen = http://localhost:8080/

[markup]
# Allowed markup options
options = strikethrough, superscript, autolink
allowed-elements = a, blockquote, br, code, del, em, h1, h2, h3, h4, h5, h6, hr, ins, li, ol, p, pre, strong, table, tbody, td, th, thead, tr, ul
allowed-attributes = href

[guard]
# Enable rate limiting and spam protection
enabled = true
ratelimit = 2
direct-reply = 3
reply-to-self = false

# Anonymous commenting settings
require-author = false
require-email = false

[admin]
# Enable admin interface at /admin
enabled = true
password = your-secure-admin-password
```

### Multi-language Support

Isso supports multiple languages. The client will automatically select the language based on the `data-isso-lang` attribute set by your Comments component.

## Environment Variables for Your Blog

After deploying Isso, update your blog's environment variables:

```bash
# In your .env file
NEXT_PUBLIC_ISSO_URL=https://comments.yourdomain.com
```

## Testing Your Setup

1. **Test Isso Server**
   ```bash
   # Check if Isso is running
   curl https://comments.yourdomain.com/info
   
   # Should return JSON with server info
   ```

2. **Test Comments on Your Blog**
   - Deploy your blog with the Isso URL configured
   - Visit any article page
   - Try posting an anonymous comment
   - Check that comments appear and persist

## Moderation

### Admin Interface

Access the admin interface at: `https://comments.yourdomain.com/admin`

Features:
- View all comments
- Delete spam/inappropriate comments
- Moderate pending comments (if moderation is enabled)

### Email Notifications

To receive email notifications for new comments, configure SMTP in `isso.conf`:

```ini
[smtp]
username = your-email@example.com
password = your-app-password
host = smtp.gmail.com
port = 587
security = starttls
to = your-email@example.com
from = "Blog Comments" <noreply@yourdomain.com>
```

## Backup and Maintenance

### Database Backup

```bash
# Create backup of comments database
cp /path/to/comments.db /path/to/backup/comments-$(date +%Y%m%d).db

# Automate with cron (daily backup)
echo "0 2 * * * cp /var/lib/isso/comments.db /backup/isso/comments-\$(date +\%Y\%m\%d).db" | crontab -
```

### Updates

```bash
# Update Isso
pip install --upgrade isso

# Restart service
sudo systemctl restart isso
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure your blog domain is listed in the `host` configuration
   - Check that CORS headers are properly set in your reverse proxy

2. **Comments Not Loading**
   - Verify Isso server is accessible from your blog domain
   - Check browser console for JavaScript errors
   - Ensure `NEXT_PUBLIC_ISSO_URL` is correctly set

3. **Database Permission Issues**
   - Ensure the Isso process has write access to the database directory
   - Check file permissions: `chown -R www-data:www-data /var/lib/isso`

### Logs

```bash
# View Isso logs (systemd)
sudo journalctl -u isso -f

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Security Considerations

1. **Use HTTPS** - Always serve Isso over HTTPS in production
2. **Rate Limiting** - Configure appropriate rate limits to prevent spam
3. **Admin Password** - Use a strong password for the admin interface
4. **Firewall** - Only expose necessary ports (80, 443)
5. **Regular Updates** - Keep Isso and server dependencies updated
6. **Backup** - Regular database backups are essential

## Cost Estimates

- **Railway/Render Free Tier**: $0/month (with limitations)
- **Railway Pro**: ~$5/month
- **Render Paid**: ~$7/month  
- **DigitalOcean Droplet**: $5-10/month
- **VPS providers**: $3-15/month

Choose based on your traffic expectations and technical comfort level.