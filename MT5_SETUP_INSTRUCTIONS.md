# MetaTrader 5 Bridge Setup Instructions

This guide will help you set up REAL MetaTrader 5 integration with your Exness accounts for live trading.

## Prerequisites

1. **MetaTrader 5 Terminal** - Download and install from Exness
2. **Python 3.8+** - Required for the bridge service
3. **Valid Exness Account** - Demo or Live account credentials

## Step 1: Install MetaTrader 5 Terminal

1. Download MT5 from Exness website
2. Install and login with your Exness credentials
3. **CRITICAL**: Keep the terminal running and logged in at all times
4. Verify you can see live prices and your account information in MT5

## Step 2: Install Python Dependencies

```bash
# Install required packages
pip install -r requirements.txt

# Or install individually:
pip install MetaTrader5==5.0.45
pip install fastapi==0.104.1
pip install uvicorn==0.24.0
pip install pydantic==2.5.0
```

## Step 3: Run the MT5 Bridge Service

**IMPORTANT**: You MUST run this Python service for real trading to work!

```bash
# Start the bridge service
python mt5_bridge.py
```

The service will start on `http://localhost:8001` and connect to your MT5 terminal.

**You should see output like:**
```
✅ MT5 Bridge Service started successfully
📊 MT5 Version: (5, 0, 4560, 0)
🌐 Terminal Info: TerminalInfo(...)
```

## Step 4: Configure Environment Variable (Optional)

If running the bridge on a different server:

```bash
# Update the MT5_BRIDGE_URL in exnessApi.ts
# Default: http://localhost:8001
```

## Step 5: Connect Your Real Account

1. **Ensure MT5 terminal is running and logged in to your account**
2. **Start the bridge service**: `python mt5_bridge.py`
3. **In the web app**: Go to Exness Integration tab
4. **Enter your MT5 credentials** (same as MT5 terminal)
5. **Click "Test Connection"** first to verify
6. **Click "Connect to Exness"** to establish full connection
7. **Verify account info** appears correctly

## Real Trading Workflow

1. **Demo Testing First**:
   - Use demo account credentials with Trial servers
   - Test all functions (connect, get account info, place orders)
   - Verify the system works correctly

2. **Live Trading Setup**:
   - Switch to live account credentials with Real servers
   - Start with small position sizes
   - Monitor all trades carefully

3. **Bridge Service Endpoints**:

- `GET /` - Health check
- `POST /mt5/connect` - Connect to MT5 account
- `POST /mt5/account_info` - Get account information
- `POST /mt5/place_order` - Place trading orders
- `GET /mt5/sessions` - View active sessions

## Troubleshooting

### Common Issues:

1. **"MT5 Bridge service is not running"**
   - Make sure you ran `python mt5_bridge.py`
   - Check if the service is running on http://localhost:8001
   - Verify no firewall is blocking the connection

2. **"MT5 initialization failed"**
   - Ensure MT5 terminal is running
   - Make sure terminal is logged in to your account
   - Try restarting the terminal

3. **"Login failed"**
   - Verify your account credentials
   - Check if the server name is correct
   - Ensure account is not locked
   - Make sure MT5 terminal is logged in with the same credentials

4. **"Failed to get account information"**
   - MT5 terminal might be disconnected
   - Check internet connection
   - Restart MT5 terminal

5. **"Symbol not found"**
   - Ensure the trading symbol is available in your MT5
   - Check if market is open
   - Verify symbol spelling (EURUSD, GBPUSD, etc.)

6. **Connection works but no real data**
   - Check if MT5 terminal shows live prices
   - Verify account is properly funded
   - Ensure trading permissions are enabled

### Bridge Service Logs:

The bridge service provides detailed logs for debugging:
- Connection attempts
- Account information retrieval
- Order placement results
- Error messages with details

### Testing Checklist:

✅ MT5 terminal installed and running
✅ Logged in to your Exness account in MT5
✅ Python dependencies installed
✅ Bridge service running (`python mt5_bridge.py`)
✅ Bridge service accessible at http://localhost:8001
✅ Test connection successful in web app
✅ Real account information displayed
✅ Can place test orders (demo account first)

## Security Notes

1. The bridge service runs locally by default
2. Only expose it externally if you understand the security implications
3. Consider using HTTPS in production
4. Monitor the logs for unauthorized access attempts

## Production Deployment

For production use:

1. Run the bridge service on a secure server
2. Use environment variables for configuration
3. Implement proper authentication
4. Use HTTPS/SSL certificates
5. Monitor service health and logs
6. Set up automatic restart on failure

## IMPORTANT: Demo vs Live Testing

**ALWAYS test with demo accounts first:**
1. Create an Exness demo account
2. Use Trial servers (ExnessKE-MT5Trial01, etc.)
3. Test all functionality thoroughly
4. Verify orders are placed correctly
5. Check account balance updates
6. **Only after successful demo testing, switch to live accounts**

**For live trading:**
1. Use Real servers (ExnessKE-MT5Real01, etc.)
2. Start with minimum position sizes (0.01 lots)
3. Monitor every trade carefully
4. Have stop losses on every position
5. Never risk more than you can afford to lose

## Real vs Simulation Mode

- **Real Mode**: MT5 Bridge running + MT5 terminal connected = Real trading
- **Simulation Mode**: No bridge service = Simulated trading for testing UI

The system automatically detects which mode based on bridge availability.