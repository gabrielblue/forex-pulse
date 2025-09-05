# VPS London Deployment Runbook
## Low-Latency Trading Infrastructure Setup

### 1. VPS Selection & Initial Setup

#### Choose VPS Provider (London Datacenter)
- **Recommended**: DigitalOcean, AWS (eu-west-2), or Vultr London
- **Specs**: 2 vCPU, 4GB RAM, 80GB SSD, Ubuntu 22.04 LTS
- **Location**: London (eu-west-2) for lowest latency to major brokers

#### Initial Server Hardening
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y git curl build-essential python3-pip python3-venv nginx certbot python3-certbot-nginx

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8001/tcp  # MT5 Bridge
sudo ufw allow 5173/tcp  # Dev server (optional)
sudo ufw --force enable

# Create trading user
sudo adduser trading
sudo usermod -aG sudo trading
```

### 2. MT5 Bridge Deployment

#### Install Python Dependencies
```bash
# Switch to trading user
sudo su - trading

# Create virtual environment
python3 -m venv ~/.venvs/mt5
source ~/.venvs/mt5/bin/activate

# Install requirements
pip install fastapi uvicorn MetaTrader5 pydantic python-dotenv psutil
```

#### Deploy MT5 Bridge
```bash
# Clone or copy mt5_bridge.py to server
mkdir -p ~/trading-bot
# Upload mt5_bridge.py to ~/trading-bot/

# Create systemd service
sudo tee /etc/systemd/system/mt5-bridge.service > /dev/null <<EOF
[Unit]
Description=MT5 Bridge Service
After=network.target

[Service]
Type=simple
User=trading
WorkingDirectory=/home/trading/trading-bot
Environment=PATH=/home/trading/.venvs/mt5/bin
ExecStart=/home/trading/.venvs/mt5/bin/uvicorn mt5_bridge:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable mt5-bridge
sudo systemctl start mt5-bridge
sudo systemctl status mt5-bridge
```

### 3. Web Application Deployment

#### Install Node.js
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### Deploy Trading App
```bash
# Clone your repository
cd ~/trading-bot
git clone https://github.com/gabrielblue/forex-pulse.git app
cd app

# Install dependencies
npm ci

# Build for production
npm run build

# Install PM2 for process management
sudo npm install -g pm2
```

#### Configure PM2
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'trading-app',
    script: 'npm',
    args: 'run preview',
    cwd: '/home/trading/trading-bot/app',
    env: {
      NODE_ENV: 'production',
      PORT: 5173
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Nginx Configuration

#### Setup Reverse Proxy
```bash
sudo tee /etc/nginx/sites-available/trading-bot <<EOF
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    # MT5 Bridge API
    location /api/mt5/ {
        proxy_pass http://localhost:8001/mt5/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Trading App
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/trading-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### SSL Certificate (Optional)
```bash
# Install SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 5. MT5 Terminal Setup

#### Option A: Windows VPS (Recommended)
1. **Rent Windows VPS** in London (same provider)
2. **Install MT5** and log into your broker account
3. **Keep terminal open** 24/5
4. **Update bridge URL** to point to Windows VPS IP

#### Option B: Linux with Wine (Advanced)
```bash
# Install Wine
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install wine wine32 wine64

# Download and install MT5
wine mt5setup.exe
# Configure MT5 to run headless
```

### 6. Environment Configuration

#### Create Environment File
```bash
# Create .env file
cat > ~/trading-bot/.env <<EOF
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# MT5 Bridge Configuration
MT5_BRIDGE_URL=http://localhost:8001
MT5_LOGIN=your_mt5_login
MT5_PASSWORD=your_mt5_password
MT5_SERVER=your_mt5_server

# Trading Configuration
TRADING_MODE=live
RISK_PER_TRADE=2.0
MAX_DAILY_LOSS=5.0
ENABLED_PAIRS=EURUSD,GBPUSD,USDJPY,XAUUSD
EOF
```

### 7. Monitoring & Logs

#### Setup Log Monitoring
```bash
# View MT5 Bridge logs
sudo journalctl -u mt5-bridge -f

# View app logs
pm2 logs trading-app

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### Health Check Script
```bash
# Create health check
cat > ~/trading-bot/health-check.sh <<EOF
#!/bin/bash

# Check MT5 Bridge
if curl -s http://localhost:8001/ | grep -q "MT5 Bridge"; then
    echo "✅ MT5 Bridge: OK"
else
    echo "❌ MT5 Bridge: FAILED"
fi

# Check Trading App
if curl -s http://localhost:5173/ | grep -q "forex-pulse"; then
    echo "✅ Trading App: OK"
else
    echo "❌ Trading App: FAILED"
fi

# Check disk space
DISK_USAGE=\$(df / | tail -1 | awk '{print \$5}' | sed 's/%//')
if [ \$DISK_USAGE -lt 80 ]; then
    echo "✅ Disk Space: OK (\${DISK_USAGE}%)"
else
    echo "⚠️  Disk Space: WARNING (\${DISK_USAGE}%)"
fi
EOF

chmod +x ~/trading-bot/health-check.sh

# Add to crontab for regular checks
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/trading/trading-bot/health-check.sh") | crontab -
```

### 8. Performance Optimization

#### System Tuning
```bash
# Optimize for low latency
echo 'net.core.rmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem = 4096 87380 16777216' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv4.tcp_wmem = 4096 65536 16777216' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 9. Backup & Recovery

#### Setup Automated Backups
```bash
# Create backup script
cat > ~/trading-bot/backup.sh <<EOF
#!/bin/bash
BACKUP_DIR="/home/trading/backups"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Backup configuration
tar -czf \$BACKUP_DIR/config_\$DATE.tar.gz ~/.env ~/trading-bot/app/src/lib/trading/

# Backup logs
tar -czf \$BACKUP_DIR/logs_\$DATE.tar.gz /var/log/nginx/ /home/trading/.pm2/logs/

echo "Backup completed: \$DATE"
EOF

chmod +x ~/trading-bot/backup.sh

# Daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /home/trading/trading-bot/backup.sh") | crontab -
```

### 10. Security Hardening

#### Additional Security Measures
```bash
# Disable root SSH
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Install fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Regular security updates
echo '0 3 * * 0 apt update && apt upgrade -y' | sudo crontab -
```

### Deployment Checklist
- [ ] VPS provisioned in London
- [ ] System hardened and updated
- [ ] MT5 Bridge deployed and running
- [ ] Trading app deployed and accessible
- [ ] Nginx configured with SSL
- [ ] MT5 terminal connected and logged in
- [ ] Environment variables configured
- [ ] Monitoring and health checks active
- [ ] Backups configured
- [ ] Security measures implemented

### Post-Deployment Testing
1. **Test MT5 Bridge**: `curl http://your-domain.com/api/mt5/`
2. **Test Trading App**: Visit `https://your-domain.com`
3. **Test Order Placement**: Try a small paper trade
4. **Monitor Latency**: Check response times
5. **Verify Logs**: Ensure no errors in system logs

### Estimated Costs (Monthly)
- **VPS (London)**: $20-40
- **Windows VPS (MT5)**: $30-60
- **Domain + SSL**: $10-15
- **Total**: $60-115/month

### Support Commands
```bash
# Restart services
sudo systemctl restart mt5-bridge
pm2 restart trading-app
sudo systemctl restart nginx

# View status
sudo systemctl status mt5-bridge
pm2 status
sudo systemctl status nginx

# Check logs
sudo journalctl -u mt5-bridge -f
pm2 logs trading-app
```