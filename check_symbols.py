#!/usr/bin/env python3
"""
Check available symbols in MT5 Bridge
"""

import requests
import json

def check_symbols():
    # Check status first
    status_response = requests.get('http://localhost:8001/status')
    print("Bridge status:", status_response.json())

    # Check sessions
    sessions_response = requests.get('http://localhost:8001/mt5/sessions')
    print("Active sessions:", sessions_response.json())

    # Get available symbols
    symbols_response = requests.get('http://localhost:8001/mt5/symbols')
    if symbols_response.status_code == 200:
        symbols_data = symbols_response.json()
        print(f"Total symbols available: {len(symbols_data)}")
        print("First 20 symbols:")
        for symbol in symbols_data[:20]:
            print(f"  - {symbol}")
        print("...")

        # Check specific symbols from whitelist
        whitelist_symbols = [
            "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD",
            "EURJPY", "GBPJPY", "EURGBP", "EURAUD", "EURNZD", "EURCAD", "EURCHF",
            "GBPAUD", "GBPNZD", "GBPCAD", "GBPCHF", "AUDJPY", "NZDJPY",
            "GBPNZD", "GBPAUD", "GBPJPY", "EURAUD", "EURNZD", "AUDNZD",
            "CADJPY", "CHFJPY",
            "USDMXN", "USDZAR", "USDTRY", "USDNOK", "USDSEK", "USDSGD", "USDHKD",
            "USDCNH", "USDPLN", "USDCZK", "USDHUF",
            "AUDCAD", "AUDCHF", "AUDNZD", "AUDSGD",
            "NZDCAD", "NZDCHF", "NZDSGD",
            "CADCHF", "CADSGD", "CADNOK",
            "CHFSGD", "CHFNOK", "CHFSEK",
            "EURNOK", "EURSEK", "EURDKK", "EURHUF", "EURPLN",
            "EURZAR", "GBPZAR", "USDILS", "USDKRW", "USDTHB", "USDPHP",
            "SGDJPY", "NOKJPY", "SEKJPY", "HKDJPY",
            "XAUUSD", "XAGUSD",
            "USDBRL", "USDARS", "USDEGP"
        ]

        available = []
        not_available = []

        for symbol in whitelist_symbols:
            if symbol in symbols_data:
                available.append(symbol)
            else:
                not_available.append(symbol)

        print(f"\nAvailable symbols ({len(available)}):")
        for symbol in available:
            print(f"  ✓ {symbol}")

        print(f"\nNot available symbols ({len(not_available)}):")
        for symbol in not_available:
            print(f"  ✗ {symbol}")

    else:
        print("Failed to get symbols:", symbols_response.status_code, symbols_response.text)

if __name__ == "__main__":
    check_symbols()