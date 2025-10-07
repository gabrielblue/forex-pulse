# Trading Bot Deployment Checklist

## ✅ Pre-Deployment Steps

### 1. MT5 Bridge Setup
- [ ] Install Python dependencies: `pip install -r requirements.txt`
- [ ] Open MetaTrader 5 desktop application
- [ ] Log in to your Exness account (demo or live)
- [ ] Verify MT5 shows "Connected" status
- [ ] Start the MT5 bridge: `python mt5_bridge.py`
- [ ] Verify bridge is running on `http://localhost:8001`

### 2. Application Setup
- [ ] Ensure the Lovable app is deployed or running locally
- [ ] Navigate to the Exness Integration page
- [ ] Enter your MT5 credentials:
  - Account number
  - Password  
  - Server (e.g., ExnessKE-MT5Trial01)
  - Account type (Demo/Live)

### 3. Test Connection
- [ ] Click "Test Connection" button
- [ ] Verify you see "Connection Test Successful"
- [ ] Check that account info is displayed correctly
- [ ] Click "Connect to Exness" button
- [ ] Verify connection status changes to "CONNECTED"

### 4. Verify Real-Time Data
- [ ] Navigate to main dashboard/Currency Pairs Table
- [ ] Verify you see "Real-time Exness MT5 prices"
- [ ] Check that bid/ask prices are updating every 3 seconds
- [ ] Ensure no 404 errors in browser console

## 🚀 Bot Activation

### 1. Start the Trading Bot
- [ ] Navigate to Trading Bot Dashboard
- [ ] Verify connection status shows "CONNECTED"
- [ ] Click "Start Bot" button
- [ ] Verify status changes to "ACTIVE"
- [ ] Check console for "✅ Trading bot started" message

### 2. Enable Auto-Trading (Optional but Recommended)
- [ ] Toggle "Auto-Trading" switch to ON
- [ ] Read and acknowledge the warning about real trades
- [ ] Verify auto-trading status shows "ENABLED"
- [ ] Check console for "🚀 Auto-trading ENABLED" message

### 3. Generate Test Signal
- [ ] Click "Generate Test Signal" button
- [ ] Check console for signal generation messages
- [ ] If auto-trading is enabled, verify signal execution
- [ ] Check MT5 terminal for opened positions (if applicable)

## 🔍 Monitoring & Verification

### Real-Time Checks
- [ ] Currency pairs showing live prices (updating every 3 seconds)
- [ ] Bot status displaying correctly (ACTIVE/INACTIVE)
- [ ] Connection status showing "CONNECTED"
- [ ] Auto-trading state synced across components
- [ ] No 404 errors in browser console
- [ ] No connection errors in Python bridge logs

### Trading Checks (If Auto-Trading Enabled)
- [ ] Signals are being generated
- [ ] Orders are being placed on MT5
- [ ] Positions visible in MT5 terminal
- [ ] Risk management limits being enforced
- [ ] Stop loss and take profit levels set correctly

## ⚠️ Common Issues & Solutions

### Issue: 404 Errors for /mt5/symbol_price
**Solution:**
- Restart the MT5 bridge: `python mt5_bridge.py`
- Ensure MT5 terminal is open and logged in
- Check bridge is running on port 8001

### Issue: "Not connected to Exness"
**Solution:**
- Verify MT5 terminal is logged in
- Check credentials are correct
- Ensure correct server is selected
- Test connection before starting bot

### Issue: No price updates
**Solution:**
- Ensure symbols are in MT5 Market Watch
- Right-click symbols and select "Show"
- Verify MT5 connection is active
- Check internet connection

### Issue: Auto-trading not executing
**Solution:**
- Verify bot is started (ACTIVE status)
- Check auto-trading toggle is ON
- Ensure Exness connection is established
- Review risk management limits

### Issue: "Bot must be started first"
**Solution:**
- Click "Start Bot" before enabling auto-trading
- Ensure connection is established first
- Check bot status indicator

## 📊 Performance Monitoring

### Daily Checks
- [ ] Review daily P&L
- [ ] Check win rate percentage
- [ ] Monitor total trades executed
- [ ] Verify risk limits not exceeded
- [ ] Review active positions

### Weekly Review
- [ ] Analyze weekly P&L trend
- [ ] Review strategy performance
- [ ] Adjust risk parameters if needed
- [ ] Check for any errors or issues
- [ ] Update bot configuration

## 🛑 Emergency Stop

### When to Use
- Unusual market conditions
- Unexpected losses exceeding limits
- Technical issues with MT5 or bridge
- Need to review and adjust strategy

### How to Stop
1. Click "Stop Bot" button
2. Verify status changes to "INACTIVE"
3. Auto-trading automatically disabled
4. Review current positions in MT5
5. Close positions manually if needed

## ✅ Success Indicators

Your bot is properly deployed when:
- ✅ MT5 bridge running without errors
- ✅ Connection status shows "CONNECTED"
- ✅ Real-time prices updating every 3 seconds
- ✅ Bot status shows "ACTIVE"
- ✅ Auto-trading enabled (if desired)
- ✅ Signals being generated
- ✅ Orders executing on MT5 (if auto-trading ON)
- ✅ No console errors
- ✅ Risk management working correctly

## 🎯 Next Steps

After successful deployment:
1. Monitor performance for first few hours
2. Review and adjust risk parameters
3. Test with demo account before going live
4. Set up performance tracking
5. Plan regular reviews and optimization

---

**Remember**: Always start with a DEMO account to test the full system before using LIVE trading!
