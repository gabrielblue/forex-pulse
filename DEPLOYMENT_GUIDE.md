# 🚀 Forex Pulse Trading Bot - Complete Deployment Guide

## Overview

This guide covers the complete deployment of your Forex Pulse Trading Bot with advanced features including:

- **VPS Deployment** (London for optimal latency)
- **Mean Reversion Alpha Strategy**
- **Dynamic Allocation Engine**
- **Background Paper Trading Backtester**
- **Enhanced MT5 Bridge** with slippage retry/reprice
- **Real-time Market Analysis**

## 🏗️ VPS Deployment (London)

### Prerequisites

1. **VPS Provider**: DigitalOcean, AWS (eu-west-2), or Vultr London
2. **Specifications**: 2 vCPU, 4GB RAM, 80GB SSD, Ubuntu 22.04 LTS
3. **Domain**: Your domain name (optional but recommended)

### Quick Deployment

```bash
# Clone the repository
git clone https://github.com/gabrielblue/forex-pulse.git
cd forex-pulse

# Run the deployment script
./deployment/deploy-vps.sh your-domain.com
```

### Manual Deployment Steps

If you prefer manual deployment, follow the detailed steps in `deployment/vps-london-runbook.md`.

## 🔧 Configuration

### 1. Environment Variables

Update `/home/trading/.env` on your VPS:

```bash
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
```

### 2. Database Migration

Apply the journaling tables migration in your Supabase SQL Editor:

```sql
-- Copy and paste the content from:
-- supabase/migrations/20250822_add_journaling_tables.sql
```

## 🧠 Advanced Trading Features

### Mean Reversion Alpha Strategy

**Purpose**: Trades range-bound markets with strict volatility filters

**Key Features**:
- **Time Windows**: Late US (21:00-23:00 UTC) and Early Asia (00:00-02:00 UTC)
- **Filters**: ATR < 30th percentile, Bollinger width < 2%, RSI extremes (25/75)
- **Risk**: 0.3% per trade, max 3 concurrent positions
- **Exit**: ATR-normalized stops, partial profits at 1R, 1.5R, 2R

**Configuration**:
```typescript
const meanReversionConfig = {
  enabled: true,
  riskPerTrade: 0.3,
  maxPositions: 3,
  timeWindows: {
    lateUS: { start: '21:00', end: '23:00' },
    earlyAsia: { start: '00:00', end: '02:00' }
  },
  filters: {
    atrPercentile: 30,
    bollingerWidth: 0.02,
    rsiExtreme: 25,
    minRange: 10,
    maxSpread: 3
  }
};
```

### Dynamic Allocation Engine

**Purpose**: Performance-weighted allocation across multiple alpha strategies

**Key Features**:
- **Rebalancing**: Every 24 hours
- **Performance Metrics**: Win rate, Sharpe ratio, average return
- **Risk Caps**: 40% max per alpha, 15% max drawdown
- **Automatic Exclusion**: Alphas exceeding risk limits

**Configuration**:
```typescript
const allocationConfig = {
  enabled: true,
  rebalanceInterval: 24,
  maxAllocationPerAlpha: 0.4,
  riskCaps: {
    maxDrawdown: 0.15,
    maxDailyLoss: 0.05,
    maxConcurrentPositions: 5
  }
};
```

### Background Paper Trading Backtester

**Purpose**: Live strategy testing without real money

**Key Features**:
- **Real-time Testing**: Runs alongside live analysis
- **Performance Tracking**: Win rate, profit factor, Sharpe ratio
- **Risk Management**: Daily loss limits, drawdown protection
- **Database Integration**: Saves results to Supabase

**Configuration**:
```typescript
const backtestConfig = {
  enabled: true,
  updateInterval: 30, // seconds
  maxConcurrentTrades: 10,
  enabledPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
  alphas: { meanReversion: true },
  riskManagement: {
    maxRiskPerTrade: 0.5,
    maxDailyLoss: 2.0,
    maxDrawdown: 5.0
  }
};
```

## 🔄 Enhanced MT5 Bridge

### New Endpoints

```bash
# Modify order
POST /mt5/modify_order
{
  "session_id": "string",
  "ticket": 12345,
  "sl": 1.2000,
  "tp": 1.2100,
  "price": 1.2050
}

# Cancel order
POST /mt5/cancel_order
{
  "session_id": "string",
  "ticket": 12345
}

# Close position
POST /mt5/close_position
{
  "session_id": "string",
  "ticket": 12345,
  "volume": 0.01
}

# Get ticks
GET /mt5/ticks?symbol=EURUSD&limit=1000

# Get order book
GET /mt5/orderbook?symbol=EURUSD
```

### Slippage Retry/Reprice

The bridge now includes intelligent retry logic:

- **Max Retries**: 3 attempts
- **Price Changes**: Automatic retry with updated prices
- **Time in Force**: IOC, FOK, GTC support
- **Slippage Control**: Configurable max slippage points

## 📊 Real-time Market Analysis

### Market Data Analysis Component

The frontend now displays real-time:

- **Order Book Imbalance**: Bid vs ask volume ratios
- **Cumulative Volume Delta**: Net buying/selling pressure
- **Volume Aggregates**: 1M, 5M, 15M, 1H volume profiles
- **Spread Analysis**: Real-time spread monitoring

### Data Sources

- **Ticks**: Real-time price data from MT5
- **Order Book**: Level 2 depth of market
- **Volume**: Aggregated across timeframes

## 🚀 Getting Started

### 1. Local Development

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Start MT5 bridge
python3 mt5_bridge.py

# Run patterns analysis
npm run patterns:run
```

### 2. VPS Deployment

```bash
# SSH to your VPS
ssh user@your-vps-ip

# Run deployment script
./deployment/deploy-vps.sh your-domain.com

# Update environment variables
nano /home/trading/.env

# Check status
sudo systemctl status mt5-bridge
pm2 status
```

### 3. MT5 Terminal Setup

**Option A: Windows VPS (Recommended)**
1. Rent Windows VPS in London
2. Install MT5 and log into broker
3. Keep terminal open 24/5
4. Update bridge URL to point to Windows VPS

**Option B: Linux with Wine**
```bash
sudo apt install wine wine32 wine64
wine mt5setup.exe
```

## 📈 Performance Monitoring

### Health Checks

```bash
# Check system health
sudo su - trading -c "~/health-check.sh"

# View MT5 Bridge logs
sudo journalctl -u mt5-bridge -f

# View app logs
pm2 logs trading-app
```

### Performance Metrics

Access performance data through the bot's status methods:

```typescript
// Get mean reversion status
const meanReversionStatus = tradingBot.getMeanReversionStatus();

// Get allocation status
const allocationStatus = tradingBot.getAllocationStatus();

// Get backtest status
const backtestStatus = tradingBot.getBacktestStatus();
```

## 🔒 Security & Risk Management

### Risk Limits

- **Per Trade**: 2% maximum risk
- **Daily Loss**: 5% maximum daily loss
- **Drawdown**: 15% maximum drawdown
- **Concurrent Positions**: 5 maximum

### Security Features

- **Firewall**: UFW with minimal open ports
- **Fail2ban**: Brute force protection
- **SSL**: Automatic Let's Encrypt certificates
- **Backups**: Daily automated backups

## 📊 Database Schema

### New Tables

1. **trade_journal**: High-level trade entries
2. **fills**: Granular execution info
3. **risk_limits**: Runtime risk configuration
4. **drift_events**: Model/data drift alerts

### Row Level Security (RLS)

All tables include RLS policies for user-specific data access.

## 🎯 Trading Strategy Summary

### Aggressive Settings (Default)

- **Regime Boost**: 80% threshold, 15-25% volume boost
- **Session Trading**: 1.5x multiplier during London/NY sessions
- **Risk Management**: 2% per trade, 5% daily loss
- **Trading Pairs**: EUR/USD, GBP/USD, USD/JPY, XAU/USD (Gold)

### Alpha Strategies

1. **Mean Reversion**: Range-bound markets, low volatility
2. **Dynamic Allocation**: Performance-weighted across alphas
3. **Paper Backtesting**: Live strategy validation

## 🆘 Troubleshooting

### Common Issues

1. **MT5 Bridge Not Starting**
   ```bash
   sudo systemctl status mt5-bridge
   sudo journalctl -u mt5-bridge -f
   ```

2. **App Not Loading**
   ```bash
   pm2 status
   pm2 logs trading-app
   ```

3. **Database Connection Issues**
   - Check Supabase URL and keys
   - Verify RLS policies
   - Check network connectivity

### Support Commands

```bash
# Restart services
sudo systemctl restart mt5-bridge
pm2 restart trading-app
sudo systemctl restart nginx

# View logs
sudo journalctl -u mt5-bridge -f
pm2 logs trading-app
sudo tail -f /var/log/nginx/error.log

# Health check
sudo su - trading -c "~/health-check.sh"
```

## 📞 Support

For issues or questions:

1. Check the logs using the commands above
2. Review the deployment runbook
3. Verify all environment variables are set
4. Ensure MT5 terminal is running and connected

## 🎉 Success Metrics

Your bot is successfully deployed when:

- ✅ MT5 Bridge responds to health checks
- ✅ Trading app loads without errors
- ✅ Paper backtester is running
- ✅ Database migrations are applied
- ✅ SSL certificate is installed (if using domain)
- ✅ Health check script shows all green

---

**🚀 Your Forex Pulse Trading Bot is now ready for world-class trading!**