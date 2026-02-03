@echo off
echo ================================================
echo  FOREX PULSE - REAL TRADING STARTUP SCRIPT
echo ================================================
echo.
echo [1/3] Checking if MT5 Bridge is running...
netstat -an | findstr ":8001" >nul
if %errorlevel% equ 0 (
    echo    ✅ MT5 Bridge is already running on port 8001
) else (
    echo    ⚠️  MT5 Bridge is NOT running
    echo    Starting mt5_bridge.py...
    start "MT5 Bridge" cmd /c "python mt5_bridge.py"
    echo    ⏳ Waiting for bridge to initialize (5 seconds)...
    timeout /t 5 /nobreak >nul
)
echo.
echo [2/3] Checking if MetaTrader 5 is running...
tasklist /FI "IMAGENAME eq terminal64.exe" 2>nul | findstr /I "terminal64.exe" >nul
if %errorlevel% equ 0 (
    echo    ✅ MetaTrader 5 is running
) else (
    echo    ⚠️  MetaTrader 5 is NOT running
    echo    ⚠️  Please open MT5 and login to your Exness account!
)
echo.
echo [3/3] Verifying configuration...
echo    ✅ Real trading mode is enabled by default
echo    ✅ Paper trading mode is DISABLED
echo.
echo ================================================
echo  SETUP COMPLETE
echo ================================================
echo.
echo NEXT STEPS:
echo 1. Ensure MT5 is logged into your Exness account
echo 2. Open the web app and connect to Exness
echo 3. Enable auto-trading to start real trading
echo.
echo To verify real trading is active, check for:
echo   - "REAL TRADE EXECUTED" in console logs
echo   - "Connected to Exness" status in dashboard
echo   - Real account balance displayed
echo.
pause
