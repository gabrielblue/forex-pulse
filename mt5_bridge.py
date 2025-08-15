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
from enum import Enum
import os

app = FastAPI(title="MT5 Bridge Service", version="1.0.0")

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

class Timeframe(str, Enum):
    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    M30 = "M30"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"

@app.on_event("startup")
async def startup_event():
    """Initialize MT5 connection on startup"""
    terminal_path = os.environ.get("MT5_TERMINAL_PATH")
    init_ok = mt5.initialize(path=terminal_path) if terminal_path else mt5.initialize()
    if not init_ok:
        print("❌ Failed to initialize MT5")
        raise RuntimeError("MT5 initialization failed")
    
    print("✅ MT5 Bridge Service started successfully")
    print(f"📊 MT5 Version: {mt5.version()}")
    print(f"🌐 Terminal Info: {mt5.terminal_info()}")
    if terminal_path:
        print(f"🛣️ Using terminal path: {terminal_path}")

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

@app.post("/mt5/connect")
async def connect_to_mt5(credentials: MT5Credentials):
    """Connect to MT5 account and create session"""
    try:
        print(f"🔐 Attempting to connect to account {credentials.login} on {credentials.server}")
        
        # First attempt: normal login
        if not mt5.login(credentials.login, credentials.password, credentials.server):
            error = mt5.last_error()
            print(f"❌ MT5 login failed: {error}")
            # Retry path: full reinitialize with credentials (helps with IPC issues)
            try:
                mt5.shutdown()
                terminal_path = os.environ.get("MT5_TERMINAL_PATH")
                reinit_ok = mt5.initialize(
                    path=terminal_path,
                    login=int(credentials.login),
                    password=str(credentials.password),
                    server=str(credentials.server)
                ) if terminal_path else mt5.initialize(
                    login=int(credentials.login),
                    password=str(credentials.password),
                    server=str(credentials.server)
                )
                if not reinit_ok:
                    error2 = mt5.last_error()
                    return {"success": False, "error": f"Login failed after reinit: {error2[1] if error2 else 'Unknown'}"}
            except Exception as re:
                return {"success": False, "error": f"Reinitialization failed: {str(re)}"}
        
        # Get account info
        account_info = mt5.account_info()
        if account_info is None:
            return {
                "success": False,
                "error": "Failed to get account information"
            }
        
        # Create session
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
        return {
            "success": False,
            "error": f"Connection failed: {str(e)}"
        }

@app.post("/mt5/account_info")
async def get_account_info(request: SessionRequest):
    """Get current account information"""
    try:
        if request.session_id not in sessions:
            return {
                "success": False,
                "error": "Invalid session ID"
            }
        
        # Update last activity
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()
        
        # Get fresh account info
        account_info = mt5.account_info()
        if account_info is None:
            return {
                "success": False,
                "error": "Failed to get account information"
            }
        
        # Get positions
        positions = mt5.positions_get()
        positions_data = []
        if positions:
            for pos in positions:
                positions_data.append({
                    "ticket": pos.ticket,
                    "symbol": pos.symbol,
                    "type": pos.type,
                    "volume": float(pos.volume),
                    "price_open": float(pos.price_open),
                    "sl": float(pos.sl),
                    "tp": float(pos.tp),
                    "profit": float(pos.profit),
                    "comment": pos.comment
                })
        
        # Get pending orders
        orders = mt5.orders_get()
        orders_data = []
        if orders:
            for order in orders:
                orders_data.append({
                    "ticket": order.ticket,
                    "symbol": order.symbol,
                    "type": order.type,
                    "volume": float(order.volume_initial),
                    "price_open": float(order.price_open),
                    "sl": float(order.sl),
                    "tp": float(order.tp),
                    "comment": order.comment
                })
        
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
        return {
            "success": False,
            "error": f"Failed to get account info: {str(e)}"
        }

@app.post("/mt5/place_order")
async def place_order(order: OrderRequest):
    """Place a trading order"""
    try:
        if order.session_id not in sessions:
            return {
                "success": False,
                "error": "Invalid session ID"
            }
        
        # Update last activity
        sessions[order.session_id]["last_activity"] = datetime.now().isoformat()
        
        # Get symbol info
        symbol_info = mt5.symbol_info(order.symbol)
        if symbol_info is None:
            return {
                "success": False,
                "error": f"Symbol {order.symbol} not found"
            }
        
        # Get current prices
        tick = mt5.symbol_info_tick(order.symbol)
        if tick is None:
            return {
                "success": False,
                "error": f"Failed to get current price for {order.symbol}"
            }
        
        # Determine order type and price
        if order.type == 0:  # BUY
            order_type = mt5.ORDER_TYPE_BUY
            price = order.price or tick.ask
        else:  # SELL
            order_type = mt5.ORDER_TYPE_SELL
            price = order.price or tick.bid
        
        # Prepare order request
        request = {
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
        
        # Send order
        result = mt5.order_send(request)
        
        if result is None:
            return {
                "success": False,
                "error": "Order send failed"
            }
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {
                "success": False,
                "error": f"Order failed: {result.comment}"
            }
        
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
        return {
            "success": False,
            "error": f"Failed to place order: {str(e)}"
        }

@app.get("/mt5/sessions")
async def get_sessions():
    """Get all active sessions"""
    return {
        "active_sessions": len(sessions),
        "sessions": sessions
    }

@app.get("/mt5/tick")
async def get_tick(symbol: str):
    try:
        info = mt5.symbol_info_tick(symbol)
        if info is None:
            raise HTTPException(status_code=404, detail=f"No tick data for {symbol}")
        return {
            "symbol": symbol,
            "bid": float(info.bid),
            "ask": float(info.ask),
            "last": float(info.last) if hasattr(info, 'last') else float(info.bid),
            "time": int(info.time)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/mt5/terminal")
async def get_terminal_info():
    try:
        info = mt5.terminal_info()
        version = mt5.version()
        return {
            "version": version,
            "terminal_info": str(info)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/mt5/symbols")
async def list_symbols(mask: Optional[str] = None, selected_only: bool = False):
    try:
        if mask:
            symbols = mt5.symbols_get(mask)
        else:
            symbols = mt5.symbols_get()
        if symbols is None:
            return {"symbols": []}
        data = []
        for s in symbols:
            if selected_only and not s.select:
                continue
            data.append({
                "name": s.name,
                "path": s.path,
                "visible": bool(s.visible),
                "select": bool(s.select),
                "trade_mode": int(getattr(s, 'trade_mode', 0))
            })
        return {"count": len(data), "symbols": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def map_timeframe(tf: Timeframe):
    mapping = {
        Timeframe.M1: mt5.TIMEFRAME_M1,
        Timeframe.M5: mt5.TIMEFRAME_M5,
        Timeframe.M15: mt5.TIMEFRAME_M15,
        Timeframe.M30: mt5.TIMEFRAME_M30,
        Timeframe.H1: mt5.TIMEFRAME_H1,
        Timeframe.H4: mt5.TIMEFRAME_H4,
        Timeframe.D1: mt5.TIMEFRAME_D1,
    }
    return mapping.get(tf, mt5.TIMEFRAME_M1)


@app.get("/mt5/history")
async def get_history(symbol: str, timeframe: Timeframe = Timeframe.M1, bars: int = 200):
    try:
        tf = map_timeframe(timeframe)
        rates = mt5.copy_rates_from_pos(symbol, tf, 0, bars)
        if rates is None:
            raise HTTPException(status_code=404, detail=f"No history for {symbol}")
        # Convert to serializable
        ohlcv = []
        for r in rates:
            ohlcv.append({
                "time": int(r['time']),
                "open": float(r['open']),
                "high": float(r['high']),
                "low": float(r['low']),
                "close": float(r['close']),
                "tick_volume": int(r['tick_volume']) if 'tick_volume' in r.dtype.names else 0
            })
        return {"symbol": symbol, "timeframe": timeframe.value, "bars": len(ohlcv), "data": ohlcv}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("🚀 Starting MT5 Bridge Service...")
    print("📋 Make sure MetaTrader 5 terminal is running!")
    print("🔗 Service will be available at http://localhost:8001")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )