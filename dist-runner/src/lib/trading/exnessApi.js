class ExnessAPI {
    constructor() {
        this.sessionId = null;
        this.accountInfo = null;
        this.isConnected = false;
        this.connectionInfo = null;
        this.lastUpdate = new Date();
        this.lastCredentials = null;
        this.heartbeatInterval = null;
        this.reconnectTimeout = null;
        this.reconnectBackoffMs = 2000;
        this.reconnectBackoffMaxMs = 300000; // 5 min max
        // MT5 Bridge URL - configurable via Vite env or Node env
        this.MT5_BRIDGE_URL = (() => {
            let viteUrl;
            try {
                // @ts-ignore - import.meta may not exist in Node
                viteUrl = import.meta?.env?.VITE_MT5_BRIDGE_URL;
            }
            catch { }
            const nodeUrl = (typeof process !== 'undefined')
                ? (process.env?.VITE_MT5_BRIDGE_URL || process.env?.MT5_BRIDGE_URL)
                : undefined;
            return viteUrl || nodeUrl || 'http://localhost:8001';
        })();
    }
    async connect(credentials) {
        try {
            console.log('🔗 Connecting to real Exness MT5 account...', {
                accountNumber: credentials.accountNumber.substring(0, 4) + '****',
                server: credentials.server,
                isDemo: credentials.isDemo
            });
            // First, test if MT5 Bridge is available
            const bridgeAvailable = await this.checkMT5BridgeAvailability();
            if (!bridgeAvailable) {
                throw new Error('MT5 Bridge service is not running. Please start the Python bridge service first.');
            }
            // Connect to MT5 through the bridge
            const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    login: parseInt(credentials.accountNumber),
                    password: credentials.password,
                    server: credentials.server
                })
            });
            if (!response.ok) {
                throw new Error(`MT5 Bridge connection failed: ${response.status} ${response.statusText}`);
            }
            const result = await response.json();
            if (result.success && result.account_info) {
                this.sessionId = result.session_id;
                this.accountInfo = this.mapMT5AccountInfo(result.account_info);
                this.isConnected = true;
                this.lastUpdate = new Date();
                this.lastCredentials = credentials;
                this.connectionInfo = {
                    connectionStatus: 'Connected',
                    webSocketStatus: 'Connected',
                    lastUpdate: this.lastUpdate.toISOString(),
                    accountType: this.accountInfo.isDemo ? 'demo' : 'live',
                    tradingAllowed: this.accountInfo.tradeAllowed,
                    server: this.accountInfo.server
                };
                console.log('✅ Successfully connected to real Exness account:', {
                    login: this.accountInfo.accountNumber,
                    balance: this.accountInfo.balance,
                    equity: this.accountInfo.equity,
                    currency: this.accountInfo.currency,
                    server: this.accountInfo.server,
                    isDemo: this.accountInfo.isDemo
                });
                this.startHeartbeat();
                return true;
            }
            else {
                throw new Error(result.error || 'Connection failed');
            }
        }
        catch (error) {
            console.error('❌ Failed to connect to Exness:', error);
            this.isConnected = false;
            this.sessionId = null;
            this.accountInfo = null;
            throw error;
        }
    }
    async checkMT5BridgeAvailability() {
        try {
            const response = await fetch(`${this.MT5_BRIDGE_URL}/`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            return response.ok;
        }
        catch (error) {
            console.error('MT5 Bridge not available:', error);
            return false;
        }
    }
    mapMT5AccountInfo(mt5Info) {
        const mapped = {
            accountNumber: mt5Info.login?.toString() || '',
            balance: parseFloat(mt5Info.balance?.toString() || '0'),
            equity: parseFloat(mt5Info.equity?.toString() || '0'),
            margin: parseFloat(mt5Info.margin?.toString() || '0'),
            freeMargin: parseFloat(mt5Info.free_margin?.toString() || '0'),
            marginLevel: parseFloat(mt5Info.margin_level?.toString() || '0'),
            currency: mt5Info.currency || 'USD',
            leverage: mt5Info.leverage?.toString() || '1:100',
            server: mt5Info.server || '',
            isDemo: mt5Info.mode === 'DEMO' || mt5Info.server?.toLowerCase().includes('demo') || mt5Info.server?.toLowerCase().includes('trial'),
            tradeAllowed: true, // MT5 connected accounts can trade
            profit: parseFloat(mt5Info.profit?.toString() || '0'),
            credit: parseFloat(mt5Info.credit?.toString() || '0'),
            company: mt5Info.company || 'Exness'
        };
        // Map positions if present in payload
        if (Array.isArray(mt5Info.positions)) {
            mapped.positions = mt5Info.positions.map((p) => this.mapMT5Position(p));
        }
        return mapped;
    }
    mapMT5Position(p) {
        // Bridge may provide numeric type (0 buy / 1 sell)
        const type = (p.type === 0 || p.type === 'BUY') ? 'BUY' : 'SELL';
        const openTime = p.openTime ? new Date(p.openTime) : (p.time ? new Date(p.time * 1000) : new Date());
        return {
            ticket: Number(p.ticket),
            ticketId: String(p.ticket),
            symbol: p.symbol,
            type,
            volume: Number(p.volume),
            openPrice: Number(p.price_open ?? p.openPrice ?? 0),
            currentPrice: Number(p.price_current ?? p.currentPrice ?? 0),
            profit: Number(p.profit ?? 0),
            stopLoss: p.sl !== undefined ? Number(p.sl) : undefined,
            takeProfit: p.tp !== undefined ? Number(p.tp) : undefined,
            openTime,
            commission: Number(p.commission ?? 0),
            swap: Number(p.swap ?? 0)
        };
    }
    async testConnection(credentials) {
        try {
            console.log('🧪 Testing connection to Exness MT5...');
            const bridgeAvailable = await this.checkMT5BridgeAvailability();
            if (!bridgeAvailable) {
                return {
                    success: false,
                    message: 'MT5 Bridge service is not running. Please start the Python bridge service (python mt5_bridge.py) and ensure MetaTrader 5 terminal is open and logged in.'
                };
            }
            // Test connection without storing session
            const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    login: parseInt(credentials.accountNumber),
                    password: credentials.password,
                    server: credentials.server
                })
            });
            if (!response.ok) {
                return {
                    success: false,
                    message: `Connection test failed: ${response.status} ${response.statusText}`
                };
            }
            const result = await response.json();
            if (result.success && result.account_info) {
                const accountInfo = this.mapMT5AccountInfo(result.account_info);
                return {
                    success: true,
                    message: `Connection test successful! Connected to ${accountInfo.isDemo ? 'DEMO' : 'LIVE'} account.`,
                    accountInfo,
                    connectionType: accountInfo.isDemo ? 'demo' : 'live'
                };
            }
            else {
                return {
                    success: false,
                    message: result.error || 'Connection test failed'
                };
            }
        }
        catch (error) {
            console.error('Connection test error:', error);
            return {
                success: false,
                message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async getAccountInfo() {
        if (!this.isConnected || !this.sessionId) {
            console.warn('Not connected to Exness - cannot get account info');
            return null;
        }
        try {
            const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/account_info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId
                })
            });
            if (!response.ok) {
                throw new Error(`Failed to get account info: ${response.status}`);
            }
            const result = await response.json();
            if (result.success && result.data) {
                this.accountInfo = this.mapMT5AccountInfo(result.data);
                this.lastUpdate = new Date();
                return this.accountInfo;
            }
            else {
                throw new Error(result.error || 'Failed to get account info');
            }
        }
        catch (error) {
            console.error('Failed to get real account info:', error);
            // Mark disconnected to trigger reconnect loop
            this.isConnected = false;
            return null;
        }
    }
    async placeOrder(order) {
        if (!this.isConnected || !this.sessionId) {
            throw new Error('Not connected to Exness');
        }
        try {
            console.log('📈 Placing real order on Exness:', order);
            const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/place_order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    symbol: order.symbol,
                    type: order.type === 'BUY' ? 0 : 1,
                    volume: order.volume,
                    price: order.price,
                    sl: order.stopLoss,
                    tp: order.takeProfit,
                    comment: order.comment || 'ForexPro Order'
                })
            });
            if (!response.ok) {
                throw new Error(`Order placement failed: ${response.status}`);
            }
            const result = await response.json();
            if (result.success && result.data) {
                console.log('✅ Order placed successfully:', result.data.ticket);
                return result.data.ticket.toString();
            }
            else {
                throw new Error(result.error || 'Order placement failed');
            }
        }
        catch (error) {
            console.error('Failed to place real order:', error);
            throw error;
        }
    }
    async getPositions() {
        if (!this.isConnected || !this.sessionId) {
            return [];
        }
        try {
            const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/positions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: this.sessionId })
            });
            if (!response.ok)
                throw new Error(`Failed to get positions: ${response.status}`);
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                return result.data.map((p) => this.mapMT5Position(p));
            }
            return [];
        }
        catch (error) {
            console.error('Failed to get positions:', error);
            return [];
        }
    }
    async getCurrentPrice(symbol) {
        try {
            const url = `${this.MT5_BRIDGE_URL}/mt5/price?symbol=${encodeURIComponent(symbol)}`;
            const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
            if (!response.ok)
                throw new Error(`Price request failed: ${response.status}`);
            const result = await response.json();
            if (result.success && result.data) {
                return {
                    symbol: result.data.symbol,
                    bid: Number(result.data.bid),
                    ask: Number(result.data.ask),
                    spread: Number(result.data.spread),
                    timestamp: new Date(result.data.timestamp)
                };
            }
            return null;
        }
        catch (error) {
            console.error('Failed to get current price:', error);
            return null;
        }
    }
    async closePosition(ticket) {
        if (!this.isConnected || !this.sessionId) {
            return false;
        }
        try {
            const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/close_position`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: this.sessionId, ticket })
            });
            if (!response.ok)
                throw new Error(`Failed to close position: ${response.status}`);
            const result = await response.json();
            return Boolean(result.success);
        }
        catch (error) {
            console.error('Failed to close position:', error);
            return false;
        }
    }
    async isMarketOpen(symbol) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        // Forex market is closed on weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return false;
        }
        // Simplified market hours check
        return true;
    }
    async verifyTradingCapabilities() {
        const issues = [];
        if (!this.isConnected) {
            issues.push('Not connected to Exness');
        }
        if (!this.accountInfo) {
            issues.push('No account information available');
        }
        else {
            if (!this.accountInfo.tradeAllowed) {
                issues.push('Trading not allowed on this account');
            }
            if (this.accountInfo.balance < 100) {
                issues.push('Account balance too low');
            }
            if (this.accountInfo.marginLevel > 0 && this.accountInfo.marginLevel < 200) {
                issues.push('Margin level too low');
            }
        }
        return {
            canTrade: issues.length === 0,
            issues
        };
    }
    async getServerTime() {
        try {
            // In real implementation, get from MT5 Bridge
            return new Date();
        }
        catch (error) {
            console.error('Failed to get server time:', error);
            return null;
        }
    }
    isConnectedToExness() {
        return this.isConnected && this.sessionId !== null;
    }
    getAccountType() {
        return this.accountInfo?.isDemo ? 'demo' : 'live';
    }
    getConnectionStatus() {
        if (!this.isConnected)
            return 'Disconnected';
        return 'Connected to MT5';
    }
    getConnectionInfo() {
        return this.connectionInfo;
    }
    disconnect() {
        this.isConnected = false;
        this.sessionId = null;
        this.accountInfo = null;
        this.connectionInfo = null;
        this.stopHeartbeat();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        console.log('🔌 Disconnected from Exness');
    }
    // Heartbeat and auto-reconnect
    startAutoReconnect() {
        this.startHeartbeat();
    }
    startHeartbeat() {
        if (this.heartbeatInterval)
            return;
        this.heartbeatInterval = setInterval(async () => {
            try {
                if (!this.isConnected) {
                    await this.attemptReconnect();
                    return;
                }
                const info = await this.getAccountInfo();
                if (!info) {
                    this.isConnected = false;
                    await this.attemptReconnect();
                }
            }
            catch (e) {
                this.isConnected = false;
                await this.attemptReconnect();
            }
        }, 30000);
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    async attemptReconnect() {
        if (!this.lastCredentials)
            return;
        if (this.reconnectTimeout)
            return; // Already scheduled
        const backoff = this.reconnectBackoffMs;
        console.warn(`🔄 Attempting reconnect in ${(backoff / 1000).toFixed(0)}s...`);
        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectTimeout = null;
            try {
                const ok = await this.connect(this.lastCredentials);
                if (ok) {
                    console.log('✅ Reconnected to Exness');
                    this.reconnectBackoffMs = 2000;
                    return;
                }
            }
            catch { }
            this.reconnectBackoffMs = Math.min(this.reconnectBackoffMs * 2, this.reconnectBackoffMaxMs);
            await this.attemptReconnect();
        }, backoff);
    }
}
export const exnessAPI = new ExnessAPI();
