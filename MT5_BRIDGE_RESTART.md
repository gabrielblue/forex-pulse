# MT5 Bridge Service - Restart Required

## Important Notice

The MT5 Bridge Python service has been updated with new endpoints for real-time price fetching and position management. You **MUST restart** the service for these changes to take effect.

## How to Restart the MT5 Bridge

1. **Stop the current bridge service**
   - If running in a terminal, press `Ctrl+C`
   - If running as a background process, find and kill the process

2. **Ensure MT5 terminal is open and logged in**
   - Open MetaTrader 5 desktop application
   - Log in to your Exness account (demo or live)
   - Ensure the terminal shows "Connected" status

3. **Start the updated bridge service**
   ```bash
   python mt5_bridge.py
   ```

4. **Verify the service is running**
   - You should see: "MT5 Bridge API running on http://localhost:8001"
   - The service will show initialization logs for MT5 connection

## New Endpoints Added

The updated bridge now includes:

- ✅ `POST /mt5/symbol_price` - Fetch real-time bid/ask prices for any symbol
- ✅ `POST /mt5/close_position` - Close specific positions by ticket number

## What This Fixes

### Before (Issues):
- ❌ 404 errors when fetching current prices
- ❌ "Failed to retrieve account info" errors
- ❌ Currency pairs table showing "Not connected"
- ❌ No real-time price data

### After (Working):
- ✅ Real-time price fetching from Exness MT5
- ✅ Live currency pair data in the UI
- ✅ Accurate bid/ask spreads
- ✅ Working position management
- ✅ Full bot trading capabilities

## Troubleshooting

### If you still see 404 errors:
1. Make sure you restarted the Python bridge
2. Check that the bridge is running on port 8001
3. Verify MT5 terminal is open and logged in

### If connection fails:
1. Check your Exness credentials
2. Ensure the correct server is selected (e.g., ExnessKE-MT5Trial01 for demo)
3. Verify your internet connection

### If prices don't update:
1. Check MT5 terminal is showing active connection
2. Ensure the symbols are available in your MT5 Market Watch
3. Right-click symbols in MT5 Market Watch and select "Show" if hidden

## Next Steps

1. Restart the MT5 bridge service
2. Open your MT5 terminal and log in
3. Navigate to the Exness Integration page in the app
4. Test the connection
5. If successful, you'll see real account data
6. Enable the trading bot and start auto-trading!

---

**Remember**: The bridge MUST be running for the trading bot to work. Keep the terminal window open where you ran `python mt5_bridge.py`.
