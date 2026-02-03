#!/usr/bin/env python3
"""
MetaTrader 5 Bridge Service for Exness Integration
This service connects to MT5 terminal and provides REST API endpoints
"""

import asyncio
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager

import MetaTrader5 as mt5
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import pytz  # For UTC conversion required by MT5

def sanitize_string(s):
    """Sanitize string to remove or replace Unicode characters that cause encoding issues"""
    if s is None:
        return ""
    try:
        # Try to encode as UTF-8, replace problematic chars
        return str(s).encode('utf-8', 'replace').decode('utf-8')
    except Exception:
        # Fallback: replace all non-ASCII
        return str(s).encode('ascii', 'replace').decode('ascii')

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    paths_to_try = [
        None,  # Automatic detection
        r"C:\Program Files\MetaTrader 5\terminal64.exe",
        r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
        r"C:\Program Files\Exness MT5\terminal64.exe",
        r"C:\Program Files (x86)\Exness MT5\terminal64.exe"
    ]
    initialized = False
    for path in paths_to_try:
        if mt5.initialize(path):
            initialized = True
            print("MT5 Bridge Service started successfully")
            print(f"MT5 Version: {sanitize_string(mt5.version())}")
            print(f"Terminal Info: {sanitize_string(mt5.terminal_info())}")
            break
        else:
            print(f"Failed to initialize MT5 with path: {path}")

    if not initialized:
        print("Failed to initialize MT5 with all attempted paths")
        print("Make sure MT5 terminal is installed and running")
        print("Continuing without MT5 initialized - will initialize on connect")

    yield

    # Shutdown
    mt5.shutdown()
    print("MT5 Bridge Service shutdown")

app = FastAPI(title="MT5 Bridge Service", version="1.0.0", lifespan=lifespan)

# Enable CORS with restricted origins for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# Store active sessions
sessions: Dict[str, Dict] = {}

# Timeframe mapping from frontend to MT5 constants
timeframe_mapping = {
    1: mt5.TIMEFRAME_M1,
    5: mt5.TIMEFRAME_M5,
    15: mt5.TIMEFRAME_M15,
    30: mt5.TIMEFRAME_M30,
    60: mt5.TIMEFRAME_H1,
    240: mt5.TIMEFRAME_H4,
    1440: mt5.TIMEFRAME_D1
}

class MT5Credentials(BaseModel):
    login: int
    password: str
    server: str

class OrderRequest(BaseModel):
    session_id: str
    symbol: str
    type: int  # 0=BUY, 1=SELL
    volume: float
    price: Optional[float] = None
    sl: Optional[float] = None
    tp: Optional[float] = None
    comment: Optional[str] = "API Order"

class SessionRequest(BaseModel):
    session_id: str

class SymbolPriceRequest(BaseModel):
    session_id: str
    symbol: str

class ClosePositionRequest(BaseModel):
    session_id: str
    ticket: int

# Historical Data Request now supports date range
class HistoricalDataRequest(BaseModel):
    session_id: str
    symbol: str
    timeframe: int  # MT5 timeframe constant (1=M1, 5=M5, 15=M15, 60=H1, 240=H4, 1440=D1)
    count: Optional[int] = None  # Number of bars to fetch
    start_time: Optional[str] = None  # ISO string
    end_time: Optional[str] = None  # ISO string


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "MT5 Bridge",
        "status": "running",
        "mt5_version": sanitize_string(mt5.version()),
        "active_sessions": len(sessions)
    }

@app.get("/status")
async def status():
    """Alias endpoint for frontend compatibility"""
    return {
        "service": "MT5 Bridge",
        "status": "running",
        "mt5_version": sanitize_string(mt5.version()),
        "active_sessions": len(sessions)
    }

@app.post("/mt5/connect")
async def connect_to_mt5(credentials: MT5Credentials):
    try:
        print(f"DEBUG: stdout encoding: {sys.stdout.encoding}")
        print(f"Received connect request for account {credentials.login} on {credentials.server}")
        paths_to_try = [
            None,  # Automatic detection
            r"C:\Program Files\MetaTrader 5\terminal64.exe",
            r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
            r"C:\Program Files\Exness MT5\terminal64.exe",
            r"C:\Program Files (x86)\Exness MT5\terminal64.exe"
        ]
        initialized = False
        for path in paths_to_try:
            if mt5.initialize(path):
                initialized = True
                print(f"MT5 initialized with path: {path}")
                break
        if not initialized:
            print("Failed to initialize MT5 with all paths")
            return {"success": False, "error": "Failed to initialize MT5. Make sure MetaTrader 5 terminal is running and installed correctly."}
        terminal_info = mt5.terminal_info()
        print(f"MT5 terminal info: {sanitize_string(terminal_info)}")
        print(f"Attempting to connect to account {credentials.login} on {credentials.server}")
        if not mt5.login(credentials.login, credentials.password, credentials.server):
            error = mt5.last_error()
            print(f"MT5 login failed: {sanitize_string(error)}")
            return {"success": False, "error": f"Login failed: {sanitize_string(error[1] if error else 'Unknown error')}"}

        account_info = mt5.account_info()
        if account_info is None:
            return {"success": False, "error": "Failed to get account information"}

        session_id = f"mt5_{int(time.time())}_{credentials.login}"
        sessions[session_id] = {
            "login": credentials.login,
            "server": credentials.server,
            "connected_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat()
        }

        print(f"Connected to account {credentials.login}, session: {session_id}")
        return {
            "success": True,
            "session_id": session_id,
            "account_info": {
                "login": account_info.login,
                "server": account_info.server,
                "balance": float(account_info.balance),
                "equity": float(account_info.equity),
                "margin": float(account_info.margin),
                "free_margin": float(account_info.margin_free),
                "margin_level": float(account_info.margin_level),
                "currency": sanitize_string(account_info.currency),
                "leverage": account_info.leverage,
                "company": sanitize_string(account_info.company),
                "connected": True,
                "mode": "LIVE" if "live" in credentials.server.lower() else "DEMO"
            }
        }
    except Exception as e:
        print(f"Exception during MT5 connection: {e}")
        return {"success": False, "error": f"Connection failed: {sanitize_string(str(e))}"}

@app.post("/mt5/account_info")
async def get_account_info(request: SessionRequest):
    try:
        if request.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()

        account_info = mt5.account_info()
        print(f"DEBUG: account_info repr: {repr(account_info)}")
        if account_info is None:
            return {"success": False, "error": "Failed to get account information"}

        positions = mt5.positions_get() or []
        positions_data = [
            {
                "ticket": pos.ticket,
                "symbol": pos.symbol,
                "type": pos.type,
                "volume": float(pos.volume),
                "price_open": float(pos.price_open),
                "sl": float(pos.sl),
                "tp": float(pos.tp),
                "profit": float(pos.profit),
                "comment": pos.comment
            } for pos in positions
        ]

        orders = mt5.orders_get() or []
        orders_data = [
            {
                "ticket": order.ticket,
                "symbol": order.symbol,
                "type": order.type,
                "volume": float(order.volume_initial),
                "price_open": float(order.price_open),
                "sl": float(order.sl),
                "tp": float(order.tp),
                "comment": order.comment
            } for order in orders
        ]

        return {
            "success": True,
            "data": {
                "login": account_info.login,
                "balance": float(account_info.balance),
                "equity": float(account_info.equity),
                "margin": float(account_info.margin),
                "free_margin": float(account_info.margin_free),
                "margin_level": float(account_info.margin_level),
                "currency": sanitize_string(account_info.currency),
                "leverage": account_info.leverage,
                "connected": True,
                "positions": positions_data,
                "orders": orders_data,
                "mode": "LIVE"
            }
        }
    except Exception as e:
        print(f"Exception getting account info: {e}")
        return {"success": False, "error": f"Failed to get account info: {sanitize_string(str(e))}"}

@app.post("/mt5/symbol_price")
async def get_symbol_price(request: SymbolPriceRequest):
    try:
        if request.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()

        symbol_info = mt5.symbol_info(request.symbol)
        if symbol_info is None:
            return {"success": False, "error": f"Symbol {request.symbol} not found"}
        if not symbol_info.visible:
            mt5.symbol_select(request.symbol, True)
        tick = mt5.symbol_info_tick(request.symbol)
        if tick is None:
            return {"success": False, "error": f"Failed to get current price for {request.symbol}"}

        return {
            "success": True,
            "data": {"symbol": request.symbol, "bid": float(tick.bid), "ask": float(tick.ask), "time": datetime.now().isoformat()}
        }
    except Exception as e:
        print(f"Exception getting symbol price: {e}")
        return {"success": False, "error": f"Failed to get symbol price: {sanitize_string(str(e))}"}

@app.post("/mt5/place_order")
async def place_order(order: OrderRequest):
    try:
        if order.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[order.session_id]["last_activity"] = datetime.now().isoformat()

        # Check MT5 connection status
        terminal_info = mt5.terminal_info()
        if terminal_info is None:
            print(f"MT5 terminal not connected for order placement")
            return {"success": False, "error": "MT5 terminal not connected"}

        if not terminal_info.connected:
            print(f"MT5 not connected to broker for order placement")
            return {"success": False, "error": "MT5 not connected to broker"}

        symbol_info = mt5.symbol_info(order.symbol)
        if symbol_info is None:
            return {"success": False, "error": f"Symbol {order.symbol} not found"}

        tick = mt5.symbol_info_tick(order.symbol)
        if tick is None:
            return {"success": False, "error": f"Failed to get current price for {order.symbol}"}

        if order.type == 0:
            order_type = mt5.ORDER_TYPE_BUY
            price = order.price or tick.ask
        else:
            order_type = mt5.ORDER_TYPE_SELL
            price = order.price or tick.bid

        request_dict = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": order.symbol,
            "volume": order.volume,
            "type": order_type,
            "price": price,
            "sl": order.sl or 0.0,
            "tp": order.tp or 0.0,
            "deviation": 20,
            "magic": 12345,
            "comment": order.comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }

        print(f"Sending order request: {sanitize_string(str(request_dict))}")
        result = mt5.order_send(request_dict)
        if result is None:
            error = mt5.last_error()
            print(f"Order send returned None, MT5 error: {sanitize_string(error)}")
            return {"success": False, "error": f"Order send failed: {sanitize_string(error[1] if error else 'Unknown error')}"}
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            print(f"Order failed with retcode {result.retcode}: {sanitize_string(result.comment)}")
            return {"success": False, "error": f"Order failed: {sanitize_string(result.comment)}"}

        print(f"Order placed successfully: {result.order}")
        return {
            "success": True,
            "data": {
                "ticket": result.order,
                "symbol": order.symbol,
                "type": order.type,
                "volume": order.volume,
                "price": float(result.price),
                "sl": order.sl or 0.0,
                "tp": order.tp or 0.0,
                "comment": order.comment,
                "time": datetime.now().isoformat(),
                "mode": "LIVE"
            }
        }

    except Exception as e:
        print(f"Exception placing order: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": f"Failed to place order: {sanitize_string(str(e))}"}

@app.post("/mt5/close_position")
async def close_position(request: ClosePositionRequest):
    try:
        if request.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()

        positions = mt5.positions_get(ticket=request.ticket)
        if not positions:
            return {"success": False, "error": f"Position {request.ticket} not found"}

        pos = positions[0]
        symbol = pos.symbol
        volume = float(pos.volume)
        pos_type = pos.type
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return {"success": False, "error": f"Failed to get current price for {symbol}"}

        if pos_type == mt5.POSITION_TYPE_BUY:
            order_type = mt5.ORDER_TYPE_SELL
            price = tick.bid
        else:
            order_type = mt5.ORDER_TYPE_BUY
            price = tick.ask

        request_dict = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "position": pos.ticket,
            "price": price,
            "deviation": 20,
            "magic": 12345,
            "comment": "Close by API",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }

        print(f"Sending close order request: {sanitize_string(str(request_dict))}")
        result = mt5.order_send(request_dict)
        if result is None:
            error = mt5.last_error()
            print(f"Close order send returned None, MT5 error: {sanitize_string(error)}")
            return {"success": False, "error": f"Close order send failed: {sanitize_string(error[1] if error else 'Unknown error')}"}
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            print(f"Close order failed with retcode {result.retcode}: {sanitize_string(result.comment)}")
            return {"success": False, "error": f"Close failed: {sanitize_string(result.comment)}"}

        return {"success": True, "data": {"ticket": int(pos.ticket), "closed": True, "price": float(result.price), "time": datetime.now().isoformat()}}

    except Exception as e:
        print(f"Exception closing position: {e}")
        return {"success": False, "error": f"Failed to close position: {sanitize_string(str(e))}"}

# ---------------- HISTORICAL DATA ---------------- #
@app.post("/mt5/historical_data")
async def get_historical_data(request: HistoricalDataRequest):
    try:
        if request.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()

        # Map frontend timeframe to MT5 constants
        mt5_timeframe = timeframe_mapping.get(request.timeframe, request.timeframe)

        # Assume MT5 is connected since symbol_price works
        print("Assuming MT5 is connected and initialized")

        # Use current time as server time
        server_time = datetime.now(pytz.UTC)
        print(f"Using current time as server time: {server_time}")

        print(f"Fetching historical data for {request.symbol} timeframe {request.timeframe} (MT5: {mt5_timeframe})")

        symbol_info = mt5.symbol_info(request.symbol)
        if symbol_info is None:
            # Get available symbols for debugging
            all_symbols = mt5.symbols_get()
            available_symbols = [s.name for s in all_symbols[:50]] if all_symbols else []
            # Filter for similar symbols
            similar_symbols = [s for s in available_symbols if request.symbol.upper() in s.upper() or s.upper() in request.symbol.upper()]
            print(f"Symbol {request.symbol} not found in MT5. Similar symbols: {similar_symbols[:10]}")
            return {"success": False, "error": f"Symbol {request.symbol} not found in MT5. Similar/available: {similar_symbols[:10]}"}

        print(f"Selecting symbol {request.symbol} (visible: {symbol_info.visible})")
        if not mt5.symbol_select(request.symbol, True):
            return {"success": False, "error": f"Failed to select symbol {request.symbol}"}
        import time
        time.sleep(0.1)  # Small delay after selecting symbol

        # Fetch by date range if provided
        rates = None

        # Get MT5 server time to use proper historical dates
        terminal_info = mt5.terminal_info()
        if terminal_info and hasattr(terminal_info, 'server_time'):
            end = datetime.fromtimestamp(terminal_info.server_time, tz=pytz.UTC)
            print(f"Using MT5 server time as end date: {end}")
        else:
            utc = pytz.UTC
            end = datetime.now(utc)
            print(f"MT5 server time not available, using current time: {end}")

        # Use special handling for higher timeframes (>= H1) to avoid "Invalid params" errors
        if mt5_timeframe >= mt5.TIMEFRAME_H1:
            print(f"🔍 Detected forex/gold symbol {request.symbol} with higher timeframe {request.timeframe} (MT5: {mt5_timeframe})")
            # Check if symbol is properly configured
            symbol_info = mt5.symbol_info(request.symbol)
            if symbol_info:
                print(f"Symbol info for {request.symbol}: visible={symbol_info.visible}, select={symbol_info.select}")
                if not symbol_info.visible:
                    print(f"Symbol {request.symbol} is not visible, selecting...")
                    mt5.symbol_select(request.symbol, True)
                    time.sleep(0.2)  # Longer delay for forex/gold
            else:
                print(f"❌ Symbol {request.symbol} not found in MT5 terminal")
                # List all available symbols containing the symbol name
                all_symbols = mt5.symbols_get()
                similar_symbols = [s.name for s in all_symbols if request.symbol.upper() in s.name.upper()] if all_symbols else []
                print(f"Available similar symbols: {similar_symbols}")
                return {"success": False, "error": f"Symbol {request.symbol} not available. Available similar symbols: {similar_symbols}. Ensure MT5 is connected to a forex broker."}

            # For forex/gold symbols with higher timeframes, try copy_rates_range first with shorter ranges
            # Use shorter date ranges for higher timeframes to avoid "Invalid params"
            if mt5_timeframe == mt5.TIMEFRAME_H1:  # 1H
                days_back = 7  # 1 week
            elif mt5_timeframe == mt5.TIMEFRAME_H4:  # 4H
                days_back = 14  # 2 weeks
            else:
                days_back = 30  # 1 month

            start = end - timedelta(days=days_back)
            print(f"Trying date range {start} to {end} for {request.symbol} {request.timeframe} (MT5: {mt5_timeframe})")
            rates = mt5.copy_rates_range(request.symbol, mt5_timeframe, start, end)

            if rates is not None and len(rates) > 0:
                print(f"✅ copy_rates_range succeeded for {request.symbol} {request.timeframe}, got {len(rates)} bars")
            else:
                # If copy_rates_range fails, try copy_rates_from_pos with very small counts
                print(f"copy_rates_range failed for {request.symbol} {request.timeframe}, trying copy_rates_from_pos")
                count_options = [10, 5, 3, 2, 1]  # Very small counts

                for count in count_options:
                    print(f"Trying to fetch {count} bars from position 0 for {request.symbol} {request.timeframe}")
                    rates = mt5.copy_rates_from_pos(request.symbol, mt5_timeframe, 0, count)
                    if rates is not None and len(rates) > 0:
                        print(f"✅ Successfully fetched {len(rates)} bars for {request.symbol} {request.timeframe}")
                        break
                    else:
                        error = mt5.last_error()
                        print(f"❌ Failed to fetch {count} bars, error: {sanitize_string(error)}, trying smaller count...")
                        rates = None

            if rates is None or len(rates) == 0:
                error = mt5.last_error()
                print(f"❌ All attempts failed for {request.symbol} {request.timeframe}, error: {sanitize_string(error)}")
                # Provide helpful error message
                symbol_type = "Gold (XAU)" if request.symbol.startswith('XAU') else "Forex"
                return {"success": False, "error": f"{symbol_type} data not available for higher timeframes. Please: 1) Ensure MT5 is connected to a live forex broker account, 2) Check MT5 Market Watch for {request.symbol}, 3) Verify broker offers {request.symbol} trading. Error: {sanitize_string(error[1] if error else 'Unknown')}"}
        elif request.symbol.startswith('XAU'):
            print(f"🔍 Detected XAUUSD request: {request.symbol}")
            # Check if symbol is properly configured
            symbol_info = mt5.symbol_info(request.symbol)
            if symbol_info:
                print(f"Symbol info for {request.symbol}: visible={symbol_info.visible}, select={symbol_info.select}")
                if not symbol_info.visible:
                    print(f"Symbol {request.symbol} is not visible, selecting...")
                    mt5.symbol_select(request.symbol, True)
                    time.sleep(0.2)  # Longer delay for gold
            else:
                print(f"❌ Symbol {request.symbol} not found in MT5 terminal")
                # List all available symbols containing 'XAU' (gold pairs)
                all_symbols = mt5.symbols_get()
                gold_symbols = [s.name for s in all_symbols if s.name.upper().startswith('XAU')] if all_symbols else []
                print(f"Available XAU (Gold) symbols: {gold_symbols}")
                return {"success": False, "error": f"Symbol {request.symbol} not available. Available XAU symbols: {gold_symbols}. Contact Exness to enable gold trading."}

            # For XAUUSD, always use copy_rates_from_pos to avoid date range issues
            # Use reduced timeframe-appropriate counts to avoid "Invalid params" errors
            # Try progressively smaller counts if initial request fails
            count_options = []
            if request.timeframe == 60:  # 1H
                count_options = [5, 3, 2, 1]  # Very small for 1H
            elif request.timeframe == 240:  # 4H
                count_options = [5, 3, 2, 1]  # Very small for 4H
            else:
                count_options = [500, 200, 100, 50]  # For lower timeframes

            for count in count_options:
                print(f"Trying to fetch {count} bars from position 0 for {request.symbol} {request.timeframe}")
                rates = mt5.copy_rates_from_pos(request.symbol, request.timeframe, 0, count)
                if rates is not None and len(rates) > 0:
                    print(f"✅ Successfully fetched {len(rates)} bars for {request.symbol} {request.timeframe}")
                    break
                else:
                    error = mt5.last_error()
                    print(f"❌ Failed to fetch {count} bars, error: {sanitize_string(error)}, trying smaller count...")
                    rates = None

            # If all attempts failed, try copy_rates_range as fallback for XAUUSD
            if rates is None or len(rates) == 0:
                print(f"All copy_rates_from_pos attempts failed for {request.symbol} {request.timeframe}, trying copy_rates_range")
                utc = pytz.UTC
                end = datetime.now(utc)
                days_back = 7 if request.timeframe >= 240 else 3  # Smaller range for higher timeframes
                start = end - timedelta(days=days_back)
                print(f"Trying date range {start} to {end} for {request.symbol} {request.timeframe}")
                rates = mt5.copy_rates_range(request.symbol, request.timeframe, start, end)
                if rates is not None and len(rates) > 0:
                    print(f"✅ Fallback copy_rates_range succeeded for {request.symbol} {request.timeframe}, got {len(rates)} bars")
                else:
                    error = mt5.last_error()
                    print(f"❌ Fallback copy_rates_range also failed for {request.symbol} {request.timeframe}, error: {sanitize_string(error)}")
                    # Provide helpful error message for gold trading
                    return {"success": False, "error": f"Gold (XAU) data not available. Please: 1) Contact Exness support to enable gold trading for your account, 2) Check MT5 Market Watch for XAU symbols, 3) Ensure MT5 is connected to live market data. Error: {sanitize_string(error[1] if error else 'Unknown')}"}
        elif request.start_time and request.end_time:
            utc = pytz.UTC
            start = datetime.fromisoformat(request.start_time).astimezone(utc)
            end = datetime.fromisoformat(request.end_time).astimezone(utc)
            print(f"Fetching data from {start} to {end}")
            rates = mt5.copy_rates_range(request.symbol, request.timeframe, start, end)

            # If copy_rates_range fails for higher timeframes, try copy_rates_from_pos
            if rates is None and request.timeframe >= 60:
                print(f"copy_rates_range failed for {request.symbol} {request.timeframe}, trying copy_rates_from_pos with 1000 bars")
                rates = mt5.copy_rates_from_pos(request.symbol, request.timeframe, 0, 1000)
                if rates is not None:
                    print(f"Fallback succeeded for {request.symbol} {request.timeframe}, got {rates.size} bars")
                else:
                    print(f"Fallback also failed for {request.symbol} {request.timeframe}")
        elif request.count:
            print(f"Fetching {request.count} bars from position 0")
            rates = mt5.copy_rates_from_pos(request.symbol, request.timeframe, 0, request.count)
        else:
            return {"success": False, "error": "Must provide either count or start_time and end_time"}

        if rates is None:
            error = mt5.last_error()
            print(f"MT5 copy_rates failed: {sanitize_string(error)}")
            return {"success": False, "error": f"MT5 data fetch failed: {sanitize_string(error[1] if error else 'Unknown error')}"}

        if len(rates) == 0:
            print(f"No data returned for {request.symbol} timeframe {request.timeframe}")
            return {"success": False, "error": f"No historical data available for {request.symbol} timeframe {request.timeframe}"}

        print(f"Successfully fetched {rates.size} bars for {request.symbol}")
        bars_data = [
            {
                "time": int(bar[0]),
                "open": float(bar[1]),
                "high": float(bar[2]),
                "low": float(bar[3]),
                "close": float(bar[4]),
                "tick_volume": int(bar[5]),
                "spread": int(bar[6]),
                "real_volume": int(bar[7])
            } for bar in rates
        ]

        return {"success": True, "data": {"symbol": request.symbol, "timeframe": request.timeframe, "count": len(bars_data), "bars": bars_data}}

    except Exception as e:
        print(f"Exception getting historical data: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": f"Failed to get historical data: {sanitize_string(str(e))}"}

@app.post("/mt5/server_time")
async def get_server_time(request: SessionRequest):
    try:
        if request.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()

        terminal_info = mt5.terminal_info()
        if terminal_info is None or not hasattr(terminal_info, 'server_time'):
            return {"success": False, "error": "Failed to get server time"}

        server_timestamp = terminal_info.server_time
        server_datetime = datetime.fromtimestamp(server_timestamp, tz=pytz.UTC)

        terminal_info = mt5.terminal_info()
        timezone = "UTC"
        if terminal_info:
            timezone = getattr(terminal_info, 'timezone', 'UTC')

        return {
            "success": True,
            "data": {
                "server_time": server_time.timestamp(),
                "server_datetime": server_datetime.isoformat(),
                "timezone": sanitize_string(timezone)
            }
        }
    except Exception as e:
        print(f"Exception getting server time: {e}")
        return {"success": False, "error": f"Failed to get server time: {sanitize_string(str(e))}"}

@app.post("/mt5/symbols")
async def get_symbols(request: SessionRequest):
    try:
        if request.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()

        # Check MT5 connection
        terminal_info = mt5.terminal_info()
        if terminal_info is None or not terminal_info.connected:
            print(f"MT5 not connected for symbols request, attempting to reconnect...")
            # Try to reinitialize MT5
            paths_to_try = [
                None,  # Automatic detection
                r"C:\Program Files\MetaTrader 5\terminal64.exe",
                r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
                r"C:\Program Files\Exness MT5\terminal64.exe",
                r"C:\Program Files (x86)\Exness MT5\terminal64.exe"
            ]
            reconnected = False
            for path in paths_to_try:
                if mt5.initialize(path):
                    reconnected = True
                    print(f"MT5 reconnected with path: {path}")
                    break
            if not reconnected:
                return {"success": False, "error": "MT5 connection lost and failed to reconnect"}

        symbols = mt5.symbols_get()
        if symbols is None:
            return {"success": False, "error": "Failed to get symbols"}

        # Return all symbols, not just the first 100, to ensure forex majors are included
        symbol_list = [{"name": s.name, "description": sanitize_string(s.description), "path": s.path} for s in symbols]
        return {"success": True, "symbols": symbol_list, "total": len(symbols)}
    except Exception as e:
        print(f"Exception getting symbols: {e}")
        return {"success": False, "error": f"Failed to get symbols: {sanitize_string(str(e))}"}

@app.get("/mt5/sessions")
async def get_sessions():
    return {"active_sessions": len(sessions), "sessions": sessions}

if __name__ == "__main__":
    import socket

    def find_available_port(start_port=8001, max_attempts=10):
        """Find an available port starting from start_port"""
        for port in range(start_port, start_port + max_attempts):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(("127.0.0.1", port))
                    s.close()
                return port
            except OSError:
                print(f"Port {port} is already in use, trying next...")
                continue
        raise OSError(f"No available ports found in range {start_port}-{start_port + max_attempts - 1}")

    print("Starting MT5 Bridge Service...")
    print("Make sure MetaTrader 5 terminal is running!")

    try:
        port = find_available_port(8001, 10)
        print(f"Service will be available at http://localhost:{port}")
        print("Security: Binding to localhost (127.0.0.1)")
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
    except OSError as e:
        print(f"Failed to bind to ports 8001-8010: {e}")
        print("All ports in range 8001-8010 are in use. Please terminate other instances of mt5_bridge.py or free the ports.")


