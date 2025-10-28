# Exness Trading Bot Setup & Troubleshooting Guide

## Overview
This guide will help you set up and use the Exness trading bot with real trade execution capabilities.

## Recent Fixes Applied

### Worker Loop Error Resolution ✅
The "An error was thrown during the worker loop" error has been fixed by implementing proper error handling in all asynchronous worker loops:

1. **Signal Generation Loop** (`botSignalManager.ts`)
   - Added `.catch()` handlers to all async operations in `setInterval`
   - Implemented timeout protection for trading capability checks
   - Enhanced connection verification before each operation cycle
   - Individual error handling for each symbol analysis

2. **Signal Processing Loop** (`signalProcessor.ts`)
   - Wrapped async calls with proper error handling
   - Added `.finally()` to ensure cleanup even on errors
   - Individual error logging with stack traces

3. **Real-Time Data Feed Loop** (`realTimeDataFeed.ts`)
   - Converted async/await in `setInterval` to promise chains
   - Added error handling per symbol price fetch
   - Prevented single symbol failures from crashing the entire feed

4. **Enhanced Connection Verification** (`exnessApi.ts`)
   - Added `healthCheck()` method for connection monitoring
   - Improved `verifyTradingCapabilities()` with better error handling
   - Added `getConnectionDiagnostics()` for troubleshooting
   - Refreshes account info during verification to ensure latest state

## Prerequisites

### 1. MetaTrader 5 Terminal
- Download and install MetaTrader 5 from Exness
- Log in with your Exness account credentials
- Keep MT5 terminal running while the bot operates

### 2. Python MT5 Bridge Service
The bot requires a Python bridge service to communicate with MT5:

```bash
# Install required Python packages
pip install MetaTrader5 flask flask-cors

# Start the MT5 bridge service (must run on port 8001)
python mt5_bridge.py
```

The bridge service should be running at `http://localhost:8001`

### 3. Exness Account
- Demo account (recommended for testing)
- Live account (for real trading - use with caution)

## Setup Instructions

### Step 1: Start the MT5 Bridge
1. Ensure MetaTrader 5 is running and logged in
2. Start the Python bridge service:
   ```bash
   python mt5_bridge.py
   ```
3. Verify the bridge is running by visiting `http://localhost:8001` in your browser

### Step 2: Connect to Exness
1. Open your trading application
2. Navigate to the Exness Integration section
3. Enter your credentials:
   - **Account Number**: Your MT5 account number
   - **Password**: Your MT5 password
   - **Server**: Your Exness server (e.g., "Exness-Trial" for demo, "Exness-Real" for live)
4. Click "Test Connection" to verify
5. Click "Connect to Exness"

### Step 3: Configure Bot Settings
1. Navigate to the Trading Bot settings
2. Configure your risk parameters:
   - **Min Confidence**: Minimum signal confidence (default: 80%)
   - **Max Risk Per Trade**: Maximum risk percentage (default: 2%)
   - **Max Daily Loss**: Daily loss limit (default: 5%)
   - **Enabled Pairs**: Select currency pairs to trade

### Step 4: Start the Bot
1. Click "Start Bot" to begin signal generation
2. The bot will start analyzing markets every 1 second
3. Signals will be generated and saved to the database

### Step 5: Enable Auto-Trading (Optional)
⚠️ **WARNING**: Auto-trading will execute REAL trades on your Exness account!

1. Ensure you're connected to Exness
2. Review and adjust risk settings
3. Click "Enable Auto-Trading"
4. The bot will automatically execute high-confidence signals

## Connection Verification

### Check Connection Status
You can verify your connection at any time:

```javascript
// In browser console
import { exnessAPI } from '@/lib/trading/exnessApi';

// Check if connected
console.log(exnessAPI.isConnectedToExness());

// Get detailed diagnostics
console.log(exnessAPI.getConnectionDiagnostics());

// Perform health check
await exnessAPI.healthCheck();
```

### Connection Diagnostics
The diagnostics will show:
- `isConnected`: Whether API is connected to MT5
- `hasSessionId`: Whether there's an active session
- `hasAccountInfo`: Whether account data is available
- `lastUpdate`: Last time connection was updated
- `accountType`: 'demo' or 'live'
- `bridgeUrl`: MT5 bridge endpoint

## Troubleshooting

### "An error was thrown during the worker loop"
**Resolution**: This error has been fixed in the latest version with improved error handling.

**What was changed**:
- All async operations in worker loops now have proper `.catch()` handlers
- Timeout protection added to prevent hanging operations
- Individual error isolation prevents cascade failures
- Enhanced logging with stack traces for debugging

### "MT5 Bridge service is not running"
**Solution**:
1. Ensure MetaTrader 5 is running and logged in
2. Start the Python bridge: `python mt5_bridge.py`
3. Verify bridge is accessible at `http://localhost:8001`
4. Check firewall settings aren't blocking port 8001

### "Not connected to Exness"
**Solution**:
1. Verify MT5 terminal is logged in
2. Ensure MT5 bridge is running
3. Check credentials are correct
4. Try disconnecting and reconnecting
5. Check server name matches your account (Trial vs Real)

### "Trading not allowed on this account"
**Solution**:
1. Verify account is funded
2. Check margin level is sufficient
3. Ensure account permissions allow trading
4. For demo accounts, ensure they haven't expired

### "Account balance too low"
**Solution**:
- Minimum balance required: $100
- Fund your account or adjust minimum in risk settings
- For testing, use a demo account with virtual funds

### "Margin level too low"
**Solution**:
- Demo accounts: Minimum 50% margin level
- Live accounts: Minimum 200% margin level
- Close some positions to free up margin
- Reduce position sizes in risk settings

## Real Trade Execution Flow

When auto-trading is enabled, here's how trades are executed:

1. **Signal Generation** (every 1 second)
   - Bot analyzes market conditions for configured pairs
   - AI-powered analysis generates trading signals
   - Signals with confidence ≥ min threshold are saved

2. **Connection Verification**
   - Verifies Exness connection is active
   - Checks trading capabilities
   - Validates account balance and margin

3. **Risk Checks**
   - Validates against daily loss limits
   - Checks position limits
   - Verifies order frequency constraints
   - Calculates optimal position size

4. **Order Execution**
   - Sends order to MT5 via bridge
   - Real order placed on Exness account
   - Order ticket returned and logged
   - Position tracked in database

5. **Trade Management**
   - Stop loss and take profit set automatically
   - Positions monitored in real-time
   - Performance metrics updated

## Safety Features

### 1. Risk Management
- Maximum risk per trade: Configurable (default: 2%)
- Daily loss limit: Configurable (default: 5%)
- Position size limits: Prevents over-leveraging
- Minimum margin requirements: Ensures account safety

### 2. Connection Monitoring
- Health checks verify connection status
- Automatic reconnection on disconnect
- Bridge availability verification
- Session validation before operations

### 3. Error Recovery
- Worker loops continue on individual errors
- Failed trades logged for review
- Signals marked as cancelled on failure
- Emergency stop capability

### 4. Rate Limiting
- Minimum 1 second between signal generations
- Minimum 0.5 seconds between signal processing
- Minimum 0.1 seconds between orders
- Daily trade count limits

## Emergency Procedures

### Emergency Stop
If you need to stop all trading immediately:

1. Click "Emergency Stop" button in UI
2. Or run in console:
   ```javascript
   import { tradingBot } from '@/lib/trading/tradingBot';
   await tradingBot.emergencyStop('User initiated');
   ```

### Close All Positions
To close all open positions:

1. Click "Close All Positions" button
2. Or run in console:
   ```javascript
   import { tradingBot } from '@/lib/trading/tradingBot';
   await tradingBot.closeAllPositions();
   ```

### Disconnect from Exness
To safely disconnect:

1. Stop the bot first
2. Disable auto-trading
3. Click "Disconnect" in Exness Integration
4. Or run in console:
   ```javascript
   import { exnessAPI } from '@/lib/trading/exnessApi';
   exnessAPI.disconnect();
   ```

## Performance Monitoring

### View Trading Statistics
```javascript
import { orderManager } from '@/lib/trading/orderManager';

// Get trading statistics
const stats = await orderManager.getTradingStatistics();
console.log(stats);
```

### View Daily Signal Stats
```javascript
import { botSignalManager } from '@/lib/trading/botSignalManager';

// Get daily signal generation stats
const stats = botSignalManager.getDailyStats();
console.log(stats);
```

### Monitor Real-Time Prices
```javascript
import { realTimeDataFeed } from '@/lib/trading/realTimeDataFeed';

// Subscribe to price updates
const unsubscribe = realTimeDataFeed.subscribe((update) => {
  console.log(`${update.symbol}: ${update.bid} / ${update.ask}`);
});

// Start data feed
await realTimeDataFeed.start();

// Stop data feed
await realTimeDataFeed.stop();

// Unsubscribe
unsubscribe();
```

## Best Practices

### 1. Start with Demo Account
- Always test with demo account first
- Verify all features work correctly
- Understand the bot's behavior
- Only switch to live after thorough testing

### 2. Conservative Settings
- Start with low risk per trade (1-2%)
- Use strict confidence thresholds (≥80%)
- Limit number of concurrent positions
- Set reasonable daily loss limits

### 3. Regular Monitoring
- Check bot status regularly
- Review executed trades
- Monitor account balance and margin
- Adjust settings based on performance

### 4. Gradual Scaling
- Start with small position sizes
- Increase gradually as confidence grows
- Monitor performance at each level
- Never risk more than you can afford to lose

### 5. Maintenance
- Keep MT5 terminal running
- Ensure stable internet connection
- Monitor Python bridge service
- Check logs for errors regularly

## Support and Debugging

### Enable Debug Logging
All errors are automatically logged to the console with stack traces. Check browser console for detailed error information.

### Connection Issues
Run diagnostics to identify connection problems:
```javascript
import { exnessAPI } from '@/lib/trading/exnessApi';

const diagnostics = exnessAPI.getConnectionDiagnostics();
console.log('Connection Diagnostics:', diagnostics);

// Perform health check
const healthy = await exnessAPI.healthCheck();
console.log('Connection Healthy:', healthy);
```

### Review Error Logs
Check console for these error types:
- `❌ Error in worker loop (...)`: Worker loop errors with stack traces
- `⚠️ Exness not connected`: Connection status warnings
- `❌ Order execution failed`: Trade execution errors
- `❌ Health check failed`: Connection health issues

## Important Warnings

⚠️ **REAL MONEY TRADING**: When using a live account, you are trading with real money. Losses are real and can be substantial.

⚠️ **NO GUARANTEE**: Past performance does not guarantee future results. The bot may generate losses.

⚠️ **MARKET RISKS**: Forex trading involves significant risk. Only trade with money you can afford to lose.

⚠️ **BRIDGE DEPENDENCY**: The bot requires the MT5 bridge to be running. If the bridge stops, trading will stop.

⚠️ **INTERNET CONNECTION**: Stable internet is required. Connection loss may result in missed trades or management issues.

## Version Information

**Last Updated**: 2025-10-28
**Version**: 2.0.0
**Changes**:
- Fixed worker loop error handling
- Enhanced connection verification
- Added health monitoring
- Improved error recovery
- Added comprehensive logging

## Next Steps

1. ✅ Start MT5 terminal and bridge service
2. ✅ Connect to Exness account
3. ✅ Configure bot settings
4. ✅ Start bot and verify signal generation
5. ✅ Monitor performance on demo account
6. ⚠️ Only enable auto-trading after thorough testing
7. ⚠️ Only switch to live account when confident

For issues or questions, check the console logs and connection diagnostics first. The enhanced error handling will provide detailed information about any problems.
