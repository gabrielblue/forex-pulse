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

class ClosePositionRequest(BaseModel):
    session_id: str
    ticket: int

class ModifyPositionRequest(BaseModel):
    session_id: str
    ticket: int
    sl: Optional[float] = None
    tp: Optional[float] = None

class HistoryRequest(BaseModel):
    session_id: str
    symbol: str
    timeframe: str  # e.g., M1, M5, M15, M30, H1, H4, D1
    count: int = 200
    end_time: Optional[int] = None  # epoch seconds

class ClosePartialRequest(BaseModel):
    session_id: str
    ticket: int
    volume: float

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

@app.post("/mt5/connect")
async def connect_to_mt5(credentials: MT5Credentials):
    """Connect to MT5 account and create session"""
    try:
        print(f"🔐 Attempting to connect to account {credentials.login} on {credentials.server}")
        
        # Connect to MT5 account
        if not mt5.login(credentials.login, credentials.password, credentials.server):
            error = mt5.last_error()
            print(f"❌ MT5 login failed: {error}")
            return {
                "success": False,
                "error": f"Login failed: {error[1] if error else 'Unknown error'}"
            }
        
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

@app.get("/mt5/price")
async def get_price(symbol: str):
    """Get current bid/ask for a symbol"""
    try:
        # Ensure symbol is available
        if not mt5.symbol_select(symbol, True):
            return {
                "success": False,
                "error": f"Symbol {symbol} not found or cannot be selected"
            }

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return {
                "success": False,
                "error": f"Failed to get current price for {symbol}"
            }

        bid = float(tick.bid)
        ask = float(tick.ask)
        spread = abs(ask - bid)

        return {
            "success": True,
            "data": {
                "symbol": symbol,
                "bid": bid,
                "ask": ask,
                "spread": spread,
                "timestamp": datetime.now().isoformat()
            }
        }
    except Exception as e:
        print(f"❌ Exception getting price: {e}")
        return {
            "success": False,
            "error": f"Failed to get price: {str(e)}"
        }

@app.post("/mt5/positions")
async def get_positions(request: SessionRequest):
    """Get open positions for current account"""
    try:
        if request.session_id not in sessions:
            return {
                "success": False,
                "error": "Invalid session ID"
            }

        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()

        raw_positions = mt5.positions_get()
        positions_data = []
        if raw_positions:
            for pos in raw_positions:
                symbol_tick = mt5.symbol_info_tick(pos.symbol)
                current_price = float(symbol_tick.bid if pos.type == mt5.POSITION_TYPE_BUY else symbol_tick.ask) if symbol_tick else float(pos.price_current)
                positions_data.append({
                    "ticket": pos.ticket,
                    "symbol": pos.symbol,
                    "type": int(pos.type),
                    "volume": float(pos.volume),
                    "price_open": float(pos.price_open),
                    "price_current": current_price,
                    "sl": float(pos.sl),
                    "tp": float(pos.tp),
                    "profit": float(pos.profit),
                    "commission": float(getattr(pos, 'commission', 0.0)),
                    "swap": float(getattr(pos, 'swap', 0.0)),
                    "time": int(getattr(pos, 'time', 0)),
                    "comment": pos.comment
                })

        return {
            "success": True,
            "data": positions_data
        }
    except Exception as e:
        print(f"❌ Exception getting positions: {e}")
        return {
            "success": False,
            "error": f"Failed to get positions: {str(e)}"
        }

@app.post("/mt5/close_position")
async def close_position(req: ClosePositionRequest):
    """Close an open position by ticket"""
    try:
        if req.session_id not in sessions:
            return {
                "success": False,
                "error": "Invalid session ID"
            }

        sessions[req.session_id]["last_activity"] = datetime.now().isoformat()

        positions = mt5.positions_get(ticket=req.ticket)
        if positions is None or len(positions) == 0:
            return {
                "success": False,
                "error": f"Position {req.ticket} not found"
            }

        pos = positions[0]
        symbol = pos.symbol
        position_type = pos.type
        volume = float(pos.volume)

        # Determine close type and price
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return {"success": False, "error": f"No tick data for {symbol}"}

        if position_type == mt5.POSITION_TYPE_BUY:
            close_type = mt5.ORDER_TYPE_SELL
            price = float(tick.bid)
        else:
            close_type = mt5.ORDER_TYPE_BUY
            price = float(tick.ask)

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": req.ticket,
            "symbol": symbol,
            "volume": volume,
            "type": close_type,
            "price": price,
            "deviation": 20,
            "magic": 12345,
            "comment": "Close by API",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)

        if result is None:
            return {"success": False, "error": "Order send failed"}

        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {
                "success": False,
                "error": f"Close failed: {result.comment}"
            }

        return {
            "success": True,
            "data": {
                "closed": True,
                "ticket": req.ticket,
                "price": float(result.price),
                "time": datetime.now().isoformat()
            }
        }
    except Exception as e:
        print(f"❌ Exception closing position: {e}")
        return {
            "success": False,
            "error": f"Failed to close position: {str(e)}"
        }

@app.post("/mt5/modify_position")
async def modify_position(req: ModifyPositionRequest):
    """Modify SL/TP for a position"""
    try:
        if req.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}

        positions = mt5.positions_get(ticket=req.ticket)
        if positions is None or len(positions) == 0:
            return {"success": False, "error": f"Position {req.ticket} not found"}

        pos = positions[0]
        symbol = pos.symbol
        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            return {"success": False, "error": f"No tick for {symbol}"}

        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "position": req.ticket,
            "symbol": symbol,
            "sl": float(req.sl) if req.sl is not None else float(pos.sl),
            "tp": float(req.tp) if req.tp is not None else float(pos.tp),
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)
        if result is None:
            return {"success": False, "error": "Modify request failed"}
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {"success": False, "error": f"Modify failed: {result.comment}"}

        return {"success": True, "data": {"modified": True, "ticket": req.ticket}}
    except Exception as e:
        print(f"❌ Exception modifying position: {e}")
        return {"success": False, "error": f"Failed to modify position: {str(e)}"}

@app.post("/mt5/close_partial")
async def close_partial(req: ClosePartialRequest):
    """Partially close a position by volume"""
    try:
        if req.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}

        positions = mt5.positions_get(ticket=req.ticket)
        if positions is None or len(positions) == 0:
            return {"success": False, "error": f"Position {req.ticket} not found"}

        pos = positions[0]
        symbol = pos.symbol
        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            return {"success": False, "error": f"No tick for {symbol}"}

        if req.volume <= 0 or req.volume >= float(pos.volume):
            return {"success": False, "error": "Invalid partial volume"}

        if pos.type == mt5.POSITION_TYPE_BUY:
            close_type = mt5.ORDER_TYPE_SELL
            price = float(tick.bid)
        else:
            close_type = mt5.ORDER_TYPE_BUY
            price = float(tick.ask)

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": req.ticket,
            "symbol": symbol,
            "volume": req.volume,
            "type": close_type,
            "price": price,
            "deviation": 20,
            "magic": 12345,
            "comment": "Partial close by API",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)
        if result is None:
            return {"success": False, "error": "Order send failed"}
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {"success": False, "error": f"Partial close failed: {result.comment}"}

        return {"success": True, "data": {"partial_closed": True, "ticket": req.ticket, "volume": req.volume}}
    except Exception as e:
        print(f"❌ Exception partial close: {e}")
        return {"success": False, "error": f"Failed to partial close: {str(e)}"}

def _map_timeframe(tf: str):
    tf = tf.upper()
    mapping = {
        'M1': mt5.TIMEFRAME_M1,
        'M5': mt5.TIMEFRAME_M5,
        'M15': mt5.TIMEFRAME_M15,
        'M30': mt5.TIMEFRAME_M30,
        'H1': mt5.TIMEFRAME_H1,
        'H4': mt5.TIMEFRAME_H4,
        'D1': mt5.TIMEFRAME_D1,
    }
    return mapping.get(tf, mt5.TIMEFRAME_M15)

@app.post("/mt5/history")
async def get_history(req: HistoryRequest):
    """Get historical candles (OHLCV)"""
    try:
        if req.session_id not in sessions:
            return {"success": False, "error": "Invalid session ID"}

        timeframe = _map_timeframe(req.timeframe)
        if not mt5.symbol_select(req.symbol, True):
            return {"success": False, "error": f"Symbol {req.symbol} not available"}

        end_ts = req.end_time or int(time.time())
        end_dt = datetime.fromtimestamp(end_ts)
        rates = mt5.copy_rates_from(req.symbol, timeframe, end_dt, req.count)
        if rates is None:
            err = mt5.last_error()
            return {"success": False, "error": f"Failed to get history: {err}"}

        candles = []
        for r in rates:
            candles.append({
                "time": int(r['time']),
                "open": float(r['open']),
                "high": float(r['high']),
                "low": float(r['low']),
                "close": float(r['close']),
                "tick_volume": int(r['tick_volume']),
                "spread": int(r['spread']),
                "real_volume": int(r.get('real_volume', 0)),
            })

        return {"success": True, "data": candles}
    except Exception as e:
        print(f"❌ Exception getting history: {e}")
        return {"success": False, "error": f"Failed to get history: {str(e)}"}

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