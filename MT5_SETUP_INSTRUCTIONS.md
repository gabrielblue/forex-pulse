# MetaTrader 5 Bridge Setup Instructions

This guide will help you set up real MetaTrader 5 integration with your Exness accounts.

## Prerequisites

1. **MetaTrader 5 Terminal** - Download and install from Exness
2. **Python 3.8+** - Required for the bridge service
3. **Valid Exness Account** - Demo or Live account credentials

## Step 1: Install MetaTrader 5 Terminal

1. Download MT5 from Exness website
2. Install and login with your Exness credentials
3. Ensure the terminal stays running (minimize, don't close)

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

```bash
# Start the bridge service
python mt5_bridge.py
```

The service will start on `http://localhost:8001`

## Step 4: Configure Environment Variable (Optional)

If you want to run the bridge service on a different URL, set the environment variable:

```bash
# For local development
export MT5_BRIDGE_URL=http://localhost:8001

# For remote server
export MT5_BRIDGE_URL=http://your-server:8001
```

## Step 5: Test the Connection

1. Make sure MT5 terminal is running and logged in
2. Start the bridge service: `python mt5_bridge.py`
3. In your trading bot, try to connect with your Exness credentials
4. The system will now use real MT5 data instead of simulation

## API Endpoints

The bridge service provides these endpoints:

- `GET /` - Health check
- `POST /mt5/connect` - Connect to MT5 account
- `POST /mt5/account_info` - Get account information
- `POST /mt5/place_order` - Place trading orders
- `GET /mt5/sessions` - View active sessions

## Troubleshooting

### Common Issues:

1. **"MT5 initialization failed"**
   - Ensure MT5 terminal is running
   - Make sure terminal is logged in to your account
   - Try restarting the terminal

2. **"Login failed"**
   - Verify your account credentials
   - Check if the server name is correct
   - Ensure account is not locked

3. **"Failed to get account information"**
   - MT5 terminal might be disconnected
   - Check internet connection
   - Restart MT5 terminal

4. **"Symbol not found"**
   - Ensure the trading symbol is available in your MT5
   - Check if market is open
   - Verify symbol spelling (EURUSD, GBPUSD, etc.)

### Bridge Service Logs:

The bridge service provides detailed logs for debugging:
- Connection attempts
- Account information retrieval
- Order placement results
- Error messages with details

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

## Testing with Demo Accounts

1. Use Exness demo accounts for testing
2. Verify all functions work correctly
3. Test order placement with small amounts
4. Monitor for any errors or issues
5. Only switch to live accounts after thorough testing

The bridge service will automatically detect if you're using a demo or live account based on the server name.