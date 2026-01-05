#!/usr/bin/env python3
"""
MetaTrader 5 Bridge Service for Exness Integration
This service connects to MT5 terminal and provides REST API endpoints
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

import MetaTrader5 as mt5
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import pytz  # For UTC conversion required by MT5

app = FastAPI(title="MT5 Bridge Service", version="1.0.0")

# Enable CORS with restricted origins for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# Store active sessions
sessions: Dict[str, Dict] = {}

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
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

@app.on_event("startup")
async def startup_event():
    """Initialize MT5 connection on startup"""
    if not mt5.initialize():
        print("❌ Failed to initialize MT5")
        raise RuntimeError("MT5 initialization failed")
    print("✅ MT5 Bridge Service started successfully")
    print(f"📊 MT5 Version: {mt5.version()}")
    print(f"🌐 Terminal Info: {mt5.terminal_info()}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    mt5.shutdown()
    print("🔄 MT5 Bridge Service shutdown")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "MT5 Bridge",
        "status": "running",
        "mt5_version": str(mt5.version()),
        "active_sessions": len(sessions)
    }

@app.get("/status")
async def status():
    """Alias endpoint for frontend compatibility"""
    return {
        "service": "MT5 Bridge",
        "status": "running",
        "mt5_version": str(mt5.version()),
        "active_sessions": len(sessions)
    }

@app.post("/mt5/connect")
async def connect_to_mt5(credentials: MT5Credentials):
    try:
        print(f"🔐 Attempting to connect to account {credentials.login} on {credentials.server}")
        if not mt5.login(credentials.login, credentials.password, credentials.server):
            error = mt5.last_error()
            print(f"❌ MT5 login failed: {error}")
            return {"success": False, "error": f"Login failed: {error[1] if error else 'Unknown error'}"}

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

        print(f"✅ Connected to account {credentials.login}, session: {session_id}")
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
                "currency": account_info.currency,
                "leverage": account_info.leverage,
                "company": account_info.company,
                "connected": True,
                "mode": "LIVE" if "live" in credentials.server.lower() else "DEMO"
            }
        }
    except Exception as e:
        print(f"❌ Exception during MT5 connection: {e}")
        return {"success": False, "error": f"Connection failed: {str(e)}"}

@app.post("/mt5/account_info")
async def get_account_info(request: SessionRequest):
    try:
        if request.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()

        account_info = mt5.account_info()
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
                "currency": account_info.currency,
                "leverage": account_info.leverage,
                "connected": True,
                "positions": positions_data,
                "orders": orders_data,
                "mode": "LIVE"
            }
        }
    except Exception as e:
        print(f"❌ Exception getting account info: {e}")
        return {"success": False, "error": f"Failed to get account info: {str(e)}"}

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
        print(f"❌ Exception getting symbol price: {e}")
        return {"success": False, "error": f"Failed to get symbol price: {str(e)}"}

@app.post("/mt5/place_order")
async def place_order(order: OrderRequest):
    try:
        if order.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[order.session_id]["last_activity"] = datetime.now().isoformat()

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
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request_dict)
        if result is None:
            return {"success": False, "error": "Order send failed"}
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {"success": False, "error": f"Order failed: {result.comment}"}

        print(f"✅ Order placed successfully: {result.order}")
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
        print(f"❌ Exception placing order: {e}")
        return {"success": False, "error": f"Failed to place order: {str(e)}"}

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
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request_dict)
        if result is None:
            return {"success": False, "error": "Order send failed"}
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {"success": False, "error": f"Close failed: {result.comment}"}

        return {"success": True, "data": {"ticket": int(pos.ticket), "closed": True, "price": float(result.price), "time": datetime.now().isoformat()}}

    except Exception as e:
        print(f"❌ Exception closing position: {e}")
        return {"success": False, "error": f"Failed to close position: {str(e)}"}

# ---------------- HISTORICAL DATA ---------------- #
@app.post("/mt5/historical_data")
async def get_historical_data(request: HistoricalDataRequest):
    try:
        if request.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()

        symbol_info = mt5.symbol_info(request.symbol)
        if symbol_info is None:
            return {"success": False, "error": f"Symbol {request.symbol} not found"}
        if not symbol_info.visible:
            mt5.symbol_select(request.symbol, True)

        # Fetch by date range if provided
        if request.start_time and request.end_time:
            utc = pytz.UTC
            start = request.start_time.astimezone(utc)
            end = request.end_time.astimezone(utc)
            rates = mt5.copy_rates_range(request.symbol, request.timeframe, start, end)
        elif request.count:
            rates = mt5.copy_rates_from_pos(request.symbol, request.timeframe, 0, request.count)
        else:
            return {"success": False, "error": "Must provide either count or start_time and end_time"}

        if rates is None or rates.size == 0:
            return {"success": False, "error": f"Failed to get historical data for {request.symbol}"}

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
        print(f"❌ Exception getting historical data: {e}")
        return {"success": False, "error": f"Failed to get historical data: {str(e)}"}

@app.get("/mt5/sessions")
async def get_sessions():
    return {"active_sessions": len(sessions), "sessions": sessions}

if __name__ == "__main__":
    print("🚀 Starting MT5 Bridge Service...")
    print("📋 Make sure MetaTrader 5 terminal is running!")
    print("🔗 Service will be available at http://localhost:8001")
    print("🔒 Security: Binding to localhost only (127.0.0.1)")

    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
