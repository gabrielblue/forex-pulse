# MT5 Connection Guide for Real Trading

## ⚠️ CRITICAL: Required for Real Trading

To execute **REAL TRADES** on your Exness account, you must have:

1. **MetaTrader 5 (MT5) Terminal** - Installed and running
2. **MT5 Bridge Service** - Python service connecting web app to MT5
3. **Exness Account** - Logged into MT5

## Setup Steps

### 1. Install MetaTrader 5
- Download from: https://www.metatrader5.com/
- Install and open the application
- Login with your Exness credentials

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

Required packages:
- MetaTrader5
- fastapi
- uvicorn

### 3. Start MT5 Bridge Service
```bash
python mt5_bridge.py
```

The bridge should start on `http://localhost:8001`

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
✅ MT5 initialized successfully
```

### 4. Connect in the Web App

1. Click "Connect to Exness" in the bot dashboard
2. Enter your MT5 credentials:
   - **Login**: Your MT5 account number
   - **Password**: Your MT5 password
   - **Server**: Your broker server (e.g., "Exness-MT5Trial")
3. Click "Connect"

### 5. Verify Connection

You should see:
- ✅ "Connected to Exness" status
- Account balance displayed
- Real-time market data

## Trading Flow

### When Auto-Trading is ENABLED:

1. **Signal Generation** (every 1 second)
   - Bot analyzes market conditions
   - Generates trading signals
   - Saves to database

2. **Signal Execution** (automatic)
   - Validates signal criteria
   - Calculates position size
   - **Sends REAL order to Exness via MT5 Bridge**
   - Receives ticket ID from MT5
   - Logs trade to database

3. **Position Management**
   - Monitors open positions
   - Tracks P&L in real-time
   - Auto-closes at TP/SL levels

### Current Configuration (Ultra Aggressive Day Trading):

- **Signal Interval**: 1 second
- **Min Confidence**: 10% (very low for maximum trades)
- **Max Daily Signals**: 2000
- **Base Volume**: 0.10 - 2.0 lots (dynamic based on confidence)
- **Risk per Trade**: Up to 15%
- **Max Daily Loss**: 40%

## Important Warnings

⚠️ **REAL MONEY AT RISK**
- All trades are executed on your REAL Exness account
- Money can be lost rapidly with aggressive settings
- Always test with DEMO account first

⚠️ **MT5 Bridge Must Be Running**
- If bridge is offline, trades will FAIL
- Keep Python service running while bot is active
- Monitor console logs for errors

⚠️ **Account Permissions**
- Ensure MT5 account allows automated trading
- Check that your account has sufficient balance
- Verify margin requirements are met

## Troubleshooting

### "MT5 Bridge service is not running"
- Start Python bridge: `python mt5_bridge.py`
- Check if port 8001 is available
- Verify MT5 terminal is open

### "Failed to place order on Exness"
- Check MT5 login credentials
- Verify account has trading permissions
- Ensure sufficient margin available
- Check symbol is valid and market is open

### "Not connected to Exness"
- Re-connect through web interface
- Verify MT5 terminal is logged in
- Check bridge service logs

### Positions Not Showing
- Verify MT5 bridge is running
- Check database sync
- Refresh the dashboard

## Testing Before Live Trading

1. **Use DEMO Account First**
   - Connect with demo credentials
   - Test signal generation
   - Verify order execution
   - Monitor for errors

2. **Start with Low Volume**
   - Begin with minimum lot sizes
   - Gradually increase as confidence grows
   - Monitor performance metrics

3. **Enable Risk Limits**
   - Set max daily loss
   - Configure position limits
   - Use emergency stop if needed

## Architecture

```
Web App (React)
    ↓
Trading Bot
    ↓
Order Manager
    ↓
Exness API Wrapper
    ↓ HTTP (localhost:8001)
MT5 Bridge (Python)
    ↓ MT5 API
MetaTrader 5 Terminal
    ↓ FIX Protocol
Exness Servers (REAL TRADING)
```

## Files Modified for Real Trading

- `src/lib/trading/orderManager.ts` - Now calls real Exness API
- `src/lib/trading/exnessApi.ts` - Communicates with MT5 Bridge
- `src/lib/trading/tradingBot.ts` - Manages bot lifecycle
- `src/lib/trading/botSignalManager.ts` - Generates and executes signals
- `mt5_bridge.py` - Python service connecting to MT5

## Monitoring

### Check Logs For:
- ✅ "REAL ORDER EXECUTED on Exness - Ticket: XXXXX"
- ✅ "Successfully connected to real Exness account"
- ❌ "MT5 Bridge not available"
- ❌ "Failed to place order on Exness"

### Dashboard Indicators:
- Connection status (green = connected)
- Active positions count
- Today's P&L
- Order execution logs

## Emergency Stop

If something goes wrong:

1. Click "EMERGENCY STOP" button
2. Disable auto-trading
3. Close all positions manually
4. Stop MT5 bridge service
5. Review logs and fix issues

## Support

For issues with:
- MT5 Bridge: Check `mt5_bridge.py` logs
- Exness API: See `MT5_SETUP_INSTRUCTIONS.md`
- Trading Bot: Enable debug logging in browser console
