#!/bin/bash

# VPS Deployment Script for Forex Pulse Trading Bot
# Run this script on your London VPS for optimal latency

set -e

echo "🚀 Starting VPS deployment for Forex Pulse Trading Bot..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TRADING_USER="trading"
PROJECT_DIR="/home/$TRADING_USER/trading-bot"
DOMAIN="${1:-your-domain.com}"  # Pass domain as first argument

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  User: $TRADING_USER"
echo "  Project Directory: $PROJECT_DIR"
echo "  Domain: $DOMAIN"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
sudo apt install -y git curl build-essential python3-pip python3-venv nginx certbot python3-certbot-nginx ufw fail2ban

# Configure firewall
print_status "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8001/tcp  # MT5 Bridge
sudo ufw allow 5173/tcp  # Dev server (optional)
sudo ufw --force enable

# Create trading user if it doesn't exist
if ! id "$TRADING_USER" &>/dev/null; then
    print_status "Creating trading user..."
    sudo adduser --disabled-password --gecos "" $TRADING_USER
    sudo usermod -aG sudo $TRADING_USER
    sudo mkdir -p /home/$TRADING_USER/.ssh
    sudo chown -R $TRADING_USER:$TRADING_USER /home/$TRADING_USER/.ssh
    sudo chmod 700 /home/$TRADING_USER/.ssh
fi

# Switch to trading user
print_status "Switching to trading user..."
sudo su - $TRADING_USER << 'EOF'

# Create project directory
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Create Python virtual environment
python3 -m venv ~/.venvs/mt5
source ~/.venvs/mt5/bin/activate

# Install Python dependencies
pip install fastapi uvicorn MetaTrader5 pydantic python-dotenv psutil

# Clone the repository
git clone https://github.com/gabrielblue/forex-pulse.git app
cd app

# Install Node.js dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install npm dependencies
npm ci

# Build for production
npm run build

# Install PM2 globally
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'PM2EOF'
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
PM2EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Create environment file
cat > ~/.env << 'ENVEOF'
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
ENVEOF

# Create systemd service for MT5 Bridge
sudo tee /etc/systemd/system/mt5-bridge.service > /dev/null << 'SERVICEEOF'
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
SERVICEEOF

# Enable and start MT5 Bridge service
sudo systemctl daemon-reload
sudo systemctl enable mt5-bridge
sudo systemctl start mt5-bridge

# Create health check script
cat > ~/health-check.sh << 'HEALTHEOF'
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
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo "✅ Disk Space: OK (${DISK_USAGE}%)"
else
    echo "⚠️  Disk Space: WARNING (${DISK_USAGE}%)"
fi
HEALTHEOF

chmod +x ~/health-check.sh

# Add health check to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/trading/health-check.sh") | crontab -

# Create backup script
cat > ~/backup.sh << 'BACKUPEOF'
#!/bin/bash
BACKUP_DIR="/home/trading/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup configuration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz ~/.env ~/trading-bot/app/src/lib/trading/

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/log/nginx/ ~/.pm2/logs/

echo "Backup completed: $DATE"
BACKUPEOF

chmod +x ~/backup.sh

# Add daily backup to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /home/trading/backup.sh") | crontab -

EOF

# Configure Nginx
print_status "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/trading-bot > /dev/null << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

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
NGINXEOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/trading-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Security hardening
print_status "Applying security hardening..."

# Disable root SSH
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Configure fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Regular security updates
echo '0 3 * * 0 apt update && apt upgrade -y' | sudo crontab -

# System optimization for low latency
print_status "Optimizing system for low latency..."
echo 'net.core.rmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem = 4096 87380 16777216' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv4.tcp_wmem = 4096 65536 16777216' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Install SSL certificate if domain is provided
if [ "$DOMAIN" != "your-domain.com" ]; then
    print_status "Installing SSL certificate for $DOMAIN..."
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
else
    print_warning "No domain provided. SSL certificate not installed."
    print_warning "Update the domain in the script and run: sudo certbot --nginx -d your-domain.com"
fi

# Final status check
print_status "Performing final status check..."
sudo su - $TRADING_USER -c "~/health-check.sh"

print_status "VPS deployment completed successfully!"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Update environment variables in /home/$TRADING_USER/.env"
echo "2. Install MT5 terminal on this VPS or a Windows VPS"
echo "3. Configure your broker credentials"
echo "4. Test the application at http://$DOMAIN"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "  Check MT5 Bridge: sudo systemctl status mt5-bridge"
echo "  Check Trading App: pm2 status"
echo "  View logs: sudo journalctl -u mt5-bridge -f"
echo "  Health check: sudo su - $TRADING_USER -c '~/health-check.sh'"
echo "  Backup: sudo su - $TRADING_USER -c '~/backup.sh'"
echo ""
echo -e "${GREEN}🎉 Your Forex Pulse Trading Bot is now deployed on VPS!${NC}"