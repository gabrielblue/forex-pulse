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
    time_in_force: Optional[int] = 0  # 0=GTC, 1=IOC, 2=FOK
    max_slippage_points: Optional[int] = 10

class SessionRequest(BaseModel):
    session_id: str

class ModifyOrderRequest(BaseModel):
    session_id: str
    ticket: int
    sl: Optional[float] = None
    tp: Optional[float] = None
    price: Optional[float] = None

class CancelOrderRequest(BaseModel):
    session_id: str
    ticket: int

class ClosePositionRequest(BaseModel):
    session_id: str
    ticket: int
    volume: Optional[float] = None

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
        
        # Apply time in force and slippage settings
        if order.time_in_force == 1:  # IOC
            request["type_filling"] = mt5.ORDER_FILLING_IOC
        elif order.time_in_force == 2:  # FOK
            request["type_filling"] = mt5.ORDER_FILLING_FOK
        
        # Apply slippage tolerance
        if order.max_slippage_points:
            request["deviation"] = order.max_slippage_points
        
        # Send order with retry logic
        max_retries = 3
        for attempt in range(max_retries):
            result = mt5.order_send(request)
            
            if result is None:
                return {
                    "success": False,
                    "error": "Order send failed"
                }
            
            if result.retcode == mt5.TRADE_RETCODE_DONE:
                print(f"✅ Order placed successfully: {result.order} (attempt {attempt + 1})")
                break
            elif result.retcode in [mt5.TRADE_RETCODE_PRICE_CHANGED, mt5.TRADE_RETCODE_REQUOTE]:
                # Price changed, retry with new price
                if attempt < max_retries - 1:
                    print(f"⚠️ Price changed, retrying... (attempt {attempt + 1})")
                    time.sleep(0.1)  # Brief delay before retry
                    # Update price for retry
                    tick = mt5.symbol_info_tick(order.symbol)
                    if tick:
                        if order.type == 0:  # BUY
                            request["price"] = tick.ask
                        else:  # SELL
                            request["price"] = tick.bid
                    continue
                else:
                    return {
                        "success": False,
                        "error": f"Price changed after {max_retries} attempts: {result.comment}"
                    }
            else:
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

@app.post("/mt5/modify_order")
async def modify_order(request: ModifyOrderRequest):
    """Modify an existing order"""
    try:
        if request.session_id not in sessions:
            return {
                "success": False,
                "error": "Invalid session ID"
            }
        
        # Update last activity
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()
        
        # Prepare modification request
        mod_request = {
            "action": mt5.TRADE_ACTION_MODIFY,
            "ticket": request.ticket,
            "price": request.price,
            "sl": request.sl,
            "tp": request.tp,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        # Remove None values
        mod_request = {k: v for k, v in mod_request.items() if v is not None}
        
        # Send modification request
        result = mt5.order_send(mod_request)
        
        if result is None:
            return {
                "success": False,
                "error": "Modify order failed"
            }
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {
                "success": False,
                "error": f"Modify failed: {result.comment}"
            }
        
        print(f"✅ Order {request.ticket} modified successfully")
        
        return {
            "success": True,
            "data": {
                "ticket": request.ticket,
                "price": request.price,
                "sl": request.sl,
                "tp": request.tp,
                "time": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        print(f"❌ Exception modifying order: {e}")
        return {
            "success": False,
            "error": f"Failed to modify order: {str(e)}"
        }

@app.post("/mt5/cancel_order")
async def cancel_order(request: CancelOrderRequest):
    """Cancel a pending order"""
    try:
        if request.session_id not in sessions:
            return {
                "success": False,
                "error": "Invalid session ID"
            }
        
        # Update last activity
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()
        
        # Prepare cancellation request
        cancel_request = {
            "action": mt5.TRADE_ACTION_REMOVE,
            "ticket": request.ticket,
        }
        
        # Send cancellation request
        result = mt5.order_send(cancel_request)
        
        if result is None:
            return {
                "success": False,
                "error": "Cancel order failed"
            }
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {
                "success": False,
                "error": f"Cancel failed: {result.comment}"
            }
        
        print(f"✅ Order {request.ticket} cancelled successfully")
        
        return {
            "success": True,
            "data": {
                "ticket": request.ticket,
                "time": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        print(f"❌ Exception cancelling order: {e}")
        return {
            "success": False,
            "error": f"Failed to cancel order: {str(e)}"
        }

@app.post("/mt5/close_position")
async def close_position(request: ClosePositionRequest):
    """Close a position"""
    try:
        if request.session_id not in sessions:
            return {
                "success": False,
                "error": "Invalid session ID"
            }
        
        # Update last activity
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()
        
        # Get position info
        positions = mt5.positions_get(ticket=request.ticket)
        if not positions:
            return {
                "success": False,
                "error": f"Position {request.ticket} not found"
            }
        
        position = positions[0]
        
        # Determine close type (opposite of position type)
        if position.type == mt5.POSITION_TYPE_BUY:
            close_type = mt5.ORDER_TYPE_SELL
            price = mt5.symbol_info_tick(position.symbol).bid
        else:
            close_type = mt5.ORDER_TYPE_BUY
            price = mt5.symbol_info_tick(position.symbol).ask
        
        # Prepare close request
        close_request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": position.symbol,
            "volume": request.volume or float(position.volume),
            "type": close_type,
            "position": request.ticket,
            "price": price,
            "deviation": 20,
            "magic": 12345,
            "comment": "API Close",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        # Send close request
        result = mt5.order_send(close_request)
        
        if result is None:
            return {
                "success": False,
                "error": "Close position failed"
            }
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {
                "success": False,
                "error": f"Close failed: {result.comment}"
            }
        
        print(f"✅ Position {request.ticket} closed successfully")
        
        return {
            "success": True,
            "data": {
                "ticket": request.ticket,
                "close_ticket": result.order,
                "volume": float(result.volume),
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