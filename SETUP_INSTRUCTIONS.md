# ForexPro Trading System - Complete Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm ci

# Install Python dependencies (for MT5 bridge and ingest scripts)
pip install -r requirements.txt
```

### 2. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 📊 Database Setup

### Run Supabase Migrations

The project includes database migrations for all new features. Run them in your Supabase project:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the migration file: `supabase/migrations/20240822_add_regime_boost_and_news_settings.sql`

This will add:
- Regime boost settings (`enable_regime_boost`, `regime_expectancy_threshold`, etc.)
- News blackout setting (`news_blackout_enabled`)
- Trailing stop settings (`enable_trailing_stop`, `trailing_stop_distance`)
- Partial profit settings (`enable_partial_profits`, `partial_profit_levels`)
- Economic calendar table (`calendar_events`)

## 🔧 Available Scripts

### NPM Scripts

```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production
npm run typecheck             # TypeScript type checking

# Database
npm run db:migrate            # Push migrations to Supabase
npm run db:reset              # Reset database (development only)

# Trading Scripts
npm run patterns:run          # Run pattern analysis
npm run ingest:calendar       # Ingest economic calendar data
npm run ingest:create-sample  # Create sample events.jsonl
npm run mt5:bridge            # Start MT5 bridge service
```

### Python Scripts

```bash
# Economic Calendar Ingest
python3 scripts/ingest_economic_calendar.py --create-sample  # Create sample data
cat events.jsonl | SUPABASE_URL=... SUPABASE_ANON_KEY=... python3 scripts/ingest_economic_calendar.py

# MT5 Bridge (Windows only)
python3 mt5_bridge.py
```

## 🎛️ Admin Settings

Access the Admin panel at `/admin` to configure:

### Regime Boost Settings
- **Enable Regime Boost**: Toggle volume boost based on regime expectancy
- **Expectancy Threshold**: Minimum expectancy (0-100) to trigger boost
- **Min/Max Boost**: Volume increase percentage (10-20% default)

### News Blackout
- **Enable News Blackout**: Prevent trading during high-impact events
- Automatically pauses trading 30 minutes before/after major economic releases

### Trailing Stop Loss
- **Enable Trailing Stop**: Automatically adjust stop loss as position moves in profit
- **Trailing Distance**: Distance in pips to maintain from current price

### Partial Profit Taking
- **Enable Partial Profits**: Close portions of positions at specified profit levels
- **Profit Levels**: Configure multiple levels with percentage and distance

## 📅 Economic Calendar

### Ingest Calendar Data

1. **Create sample data**:
   ```bash
   npm run ingest:create-sample
   ```

2. **Ingest from JSONL file**:
   ```bash
   # Set environment variables
   export SUPABASE_URL="your_supabase_url"
   export SUPABASE_ANON_KEY="your_supabase_anon_key"
   
   # Ingest data
   cat events.jsonl | npm run ingest:calendar
   ```

3. **JSONL Format**:
   ```json
   {
     "event_name": "US Non-Farm Payrolls",
     "event_date": "2024-01-05 13:30:00",
     "currency": "USD",
     "impact": "HIGH",
     "forecast": "180K",
     "previous": "173K",
     "source": "BLS",
     "description": "Employment change excluding farm workers",
     "affected_pairs": ["EURUSD", "GBPUSD", "USDJPY"]
   }
   ```

## 🔌 MT5 Bridge Setup

### Requirements
- Windows machine with MetaTrader 5 terminal installed
- Python 3.8+ with required packages
- Active MT5 account

### Setup Steps

1. **Install MT5 Terminal**:
   - Download and install MetaTrader 5
   - Log in to your trading account

2. **Install Python Dependencies**:
   ```bash
   pip install MetaTrader5 fastapi uvicorn pydantic
   ```

3. **Start Bridge Service**:
   ```bash
   python3 mt5_bridge.py
   ```

4. **Verify Connection**:
   - Visit `http://localhost:8000` for health check
   - Check logs for successful MT5 initialization

### API Endpoints

- `GET /` - Health check
- `POST /mt5/connect` - Connect to MT5 account
- `POST /mt5/order` - Place trading order
- `GET /mt5/positions` - Get open positions
- `POST /mt5/close` - Close position

## 🎯 Regime Boost Configuration

### For Maximum Profit (Aggressive)

Set these values in Admin → Trading tab:

```
Enable Regime Boost: ✅ ON
Expectancy Threshold: 80
Min Boost: 15%
Max Boost: 25%
```

### For Conservative Trading

```
Enable Regime Boost: ✅ ON
Expectancy Threshold: 90
Min Boost: 10%
Max Boost: 15%
```

### How It Works

1. When a signal comes in with `regimeExpectancy >= threshold`
2. Position size is increased by the boost percentage
3. Final size is still clamped by risk manager limits
4. Boost scales linearly from min to max based on expectancy

## 🛡️ Risk Management

### Built-in Protections

- **Daily Loss Limit**: Maximum 3-5% daily loss (configurable)
- **Position Size Limits**: Maximum 1-2 lots for live accounts
- **Margin Requirements**: Conservative margin usage (70% of free margin)
- **Cooldown Periods**: 30 seconds between orders
- **News Blackout**: Automatic pause during high-impact events

### Emergency Stop

If daily loss limit is reached:
- Auto-trading is immediately disabled
- All positions are closed
- Bot settings are updated to prevent further trading

## 🔍 Troubleshooting

### Common Issues

1. **"vite: not found"**
   - Run `npm ci` to install dependencies first

2. **MT5 Bridge fails to start**
   - Ensure MT5 terminal is installed and running
   - Check that you're on Windows
   - Verify account credentials

3. **Supabase connection errors**
   - Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables
   - Ensure RLS policies are configured correctly

4. **Settings not saving**
   - Check browser console for errors
   - Verify user authentication
   - Ensure database migration was run

### Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📈 Performance Optimization

### For Faster Profit Generation

1. **Enable Regime Boost** with lower threshold (80-85)
2. **Use Higher Boost Percentages** (15-25%)
3. **Enable Trailing Stops** to lock in profits
4. **Configure Partial Profits** to take profits early
5. **Monitor High-Impact News** and adjust positions accordingly

### Risk-Adjusted Settings

- Start with conservative settings
- Gradually increase boost percentages as you gain confidence
- Monitor performance metrics in the Admin dashboard
- Adjust thresholds based on market conditions

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Check Supabase logs for database errors
4. Verify all environment variables are set correctly

## 📝 Changelog

### Latest Updates
- ✅ Added regime-based volume boost
- ✅ Added news blackout functionality
- ✅ Added trailing stop loss settings
- ✅ Added partial profit taking
- ✅ Added economic calendar ingest
- ✅ Added comprehensive Admin UI
- ✅ Added MT5 bridge service
- ✅ Added pattern analysis runner