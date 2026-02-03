# Real Trading Setup Guide

## ✅ Your Bot is Already Configured for Real Trading

The trading bot is **already set up for real trading** by default:
- `orderManager.ts` line 39: `isPaperTradingMode = false`
- All order execution goes to real MT5 account when connected

## What You Need to Do

### Step 1: Start MT5 Bridge (Required for Real Data)
```bash
python mt5_bridge.py
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
✅ MT5 initialized successfully
```

### Step 2: Keep MetaTrader 5 Running
- Open MetaTrader 5 application
- Login to your Exness account
- Keep it running while the bot is active

### Step 3: Connect in Web App
1. Open the forex-pulse web app
2. Click "Connect to Exness"
3. Enter your MT5 credentials:
   - Login: Your MT5 account number
   - Password: Your MT5 password
   - Server: e.g., "Exness-MT5Trial"
4. Click "Connect"

### Step 4: Verify Real Trading
Look for these indicators:
- ✅ "Connected to Exness" status (green)
- Real account balance displayed
- Console shows: `REAL TRADE EXECUTED SUCCESSFULLY`

## How to Confirm You're Using Real Data

Check the browser console when trading:
- **Mock Data**: Shows `[MOCK] No session ID - returning mock data`
- **Real Data**: Shows `[INFO] Fetching historical data for XAUUSD 15M`

## Troubleshooting

### "MT5 Bridge not available"
→ Run: `python mt5_bridge.py`

### "Not connected to Exness"
→ Re-connect through the web interface
→ Ensure MT5 terminal is logged in

### Trades not executing
→ Check MT5 has automated trading enabled
→ Verify sufficient margin in account

## Emergency Stop
If you need to stop real trading immediately:
1. Click "EMERGENCY STOP" in the dashboard
2. Or run: `orderManager.emergencyStop()`
