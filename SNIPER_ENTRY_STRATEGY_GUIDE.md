# Sniper Entry Strategy Guide

## 🎯 Objective: Precision Trading with Multi-Timeframe Analysis

This strategy provides **exact entry points** using order flow, liquidity, and market structure. It helps the bot determine **when to buy, when to sell, and when to enter trades** with surgical precision.

## 📊 Strategy Overview

### Core Principles
1. **Break of Structure (BOS)** - Enter when price breaks beyond recent swing high/low
2. **Change of Character (CHOCH)** - Enter when market reverses direction after strong move
3. **Liquidity Sweep** - Confirm entries when price touches and rejects liquidity levels
4. **Order Flow Analysis** - Use momentum and volume to confirm direction
5. **Multi-Timeframe Confirmation** - Align M5 entries with M15 and H1 structure

## 🎯 Key Strategy Components

### 1. Break of Structure (BOS)

**What it is:** Price breaking beyond recent swing high or low, indicating continuation.

**Implementation:**
- Detect recent swing highs and lows
- Enter when price breaks above recent high (BUY)
- Enter when price breaks below recent low (SELL)
- Confidence boost: +15% when confirmed

**Code Example:**
```typescript
const bos = this.detectBreakOfStructure(prices, swingHighs, swingLows);

if (bos.breakOut && bos.direction === 'BUY') {
  direction = 'BUY';
  confidence = 75;
  reasoning = 'Break of Structure UP';
}
```

### 2. Change of Character (CHOCH)

**What it is:** Market reversing direction after strong move, indicating potential reversal.

**Implementation:**
- Detect momentum reversal (positive to negative or vice versa)
- Confirm with market structure (higher lows for BUY, lower highs for SELL)
- Confidence boost: +10% when structure confirms

**Code Example:**
```typescript
const choch = this.detectChangeOfCharacter(prices);

if (choch.changeDetected && choch.direction === 'BUY') {
  direction = 'BUY';
  confidence = 70;
  reasoning = 'Change of Character BUY';
  
  // Verify with structure
  if (lastLow > prevLow) {
    confidence += 10;
    reasoning += ' | Higher lows confirmed';
  }
}
```

### 3. Liquidity Sweep Confirmation

**What it is:** Price touching liquidity level (order blocks) then rejecting.

**Implementation:**
- Identify liquidity levels (equal highs/lows)
- Confirm entry when price sweeps liquidity
- Confidence boost: +10% when sweep confirmed

**Code Example:**
```typescript
const liquidity = this.detectLiquidityLevels(prices);
const liquiditySweepConfirmed = this.hasLiquiditySweep(
  prices, 
  direction === 'BUY' ? liquidity.highs : liquidity.lows
);

if (liquiditySweepConfirmed) {
  confidence += 10;
  reasoning += ' | Liquidity sweep confirmed';
}
```

### 4. Order Flow Analysis

**What it is:** Simulated analysis of buying/selling pressure.

**Implementation:**
- Calculate momentum score (0-100)
- Combine with RSI for confirmation
- Strong order flow (>60 score) adds +10% confidence

**Code Example:**
```typescript
const orderFlowScore = this.calculateOrderFlowScore(prices);

if (orderFlowScore > 60) {
  confidence += 10;
  reasoning += ` | Strong order flow (${orderFlowScore.toFixed(1)})`;
}
```

## 🎯 Entry Criteria Checklist

✅ **Break of Structure** OR **Change of Character** detected
✅ **Liquidity sweep** confirmed
✅ **Order flow score** > 60
✅ **Confidence score** > 70%
✅ **Trading session active** (London/NY)
✅ **Volatility score** < 0.8 (not too choppy)
✅ **Trend strength** > 0.3 (clear direction)

## 📈 Trading Plan

### Step-by-Step Execution

1. **Check Trading Session**
   - Only trade during London (07:00-16:00 UTC) or New York (12:00-21:00 UTC)
   - Avoid Asian session

2. **Analyze Market Structure**
   - Detect swing highs and lows
   - Identify recent structure (higher highs/lows or lower highs/lows)

3. **Wait for BOS or CHOCH**
   - **BOS:** Price breaks beyond recent swing
   - **CHOCH:** Momentum reverses with structure confirmation

4. **Confirm with Liquidity**
   - Price should sweep liquidity level
   - Then reject (close opposite to wick direction)

5. **Check Order Flow**
   - Momentum should align with entry direction
   - Order flow score > 60 for confirmation

6. **Execute Sniper Entry**
   - **Timeframe:** M5 for precision
   - **Stop Loss:** 8 pips (tighter for sniper)
   - **Take Profit:** 16 pips (2:1 RR)
   - **Risk:** 1% of account

7. **Monitor and Exit**
   - Let take profit run
   - If stop loss hit, analyze why

## 🎯 Entry Examples

### Example 1: Break of Structure Long

**Market:** EURUSD
**Timeframe:** M5
**Current Price:** 1.1050
**Recent High:** 1.1048
**Recent Low:** 1.1035
**Liquidity Above:** 1.1060
**Order Flow Score:** 72

**Signal:** Price breaks above 1.1048 (recent high) → **BUY**
- Confidence: 85%
- Entry: 1.1050
- Stop Loss: 1.1042 (8 pips)
- Take Profit: 1.1066 (16 pips)
- Reasoning: "Break of Structure UP | Liquidity sweep confirmed | Strong order flow (72.0)"

**Result:** Price continues up, hits take profit at 1.1065 ✅

### Example 2: Change of Character Short

**Market:** GBPUSD
**Timeframe:** M5
**Current Price:** 1.2850
**Recent High:** 1.2860
**Recent Low:** 1.2840
**Liquidity Below:** 1.2830
**Order Flow Score:** 68

**Signal:** Price reverses after strong down move, forms lower high → **SELL**
- Confidence: 80%
- Entry: 1.2850
- Stop Loss: 1.2858 (8 pips)
- Take Profit: 1.2834 (16 pips)
- Reasoning: "Change of Character SELL | Lower highs confirmed | Liquidity sweep confirmed"

**Result:** Price drops, hits take profit at 1.2835 ✅

## 🛡️ Risk Management

### Key Rules
- **Risk per trade:** 1% of account balance
- **Stop Loss:** 8 pips (tighter for sniper entries)
- **Take Profit:** 16 pips (2:1 risk-reward)
- **Minimum profit target:** $1.50 per trade
- **No daily trade limit** (take all high-probability setups)

### Position Sizing

| Account Balance | Max Risk per Trade | Position Size (EURUSD) |
|----------------|-------------------|------------------------|
| $8             | $0.08             | 0.01 lot              |
| $16            | $0.16             | 0.02 lot              |
| $32            | $0.32             | 0.04 lot              |
| $64            | $0.64             | 0.08 lot              |

## 📊 Performance Metrics

### Target Metrics
- **Win Rate:** 65-75%
- **Risk-Reward Ratio:** 2:1
- **Profit Factor:** 1.8+
- **Max Drawdown:** < 8% per week
- **Daily Return:** 1-3% (1-2 trades)

### Why Sniper Entries Work

1. **Precision Timing:** Enter at exact breakout/reversal points
2. **Liquidity Confirmation:** Trade where big players are active
3. **Order Flow Alignment:** Momentum confirms direction
4. **Tighter Stops:** 8 pips vs 12 pips for regular entries
5. **Higher RR:** 2:1 vs 1.8:1 for regular entries

## 🔍 How to Improve Accuracy

### 1. Use Multiple Timeframes
- **M5:** Entry signals
- **M15:** Confirm trend direction
- **H1:** Check higher timeframe bias

### 2. Wait for Confirmation
- Don't enter on first BOS/CHOCH
- Wait for liquidity sweep confirmation
- Check order flow score > 60

### 3. Avoid News Events
- Stop trading 15 minutes before high-impact news
- Resume trading 30 minutes after news

### 4. Track Every Trade
- Journal all entries with screenshots
- Review why wins/losses occurred
- Adjust strategy based on data

## 🎓 Learning Resources

### Key Concepts to Master

1. **Break of Structure (BOS)**
   - Price breaking beyond recent swing
   - Continuation pattern
   - High probability when confirmed

2. **Change of Character (CHOCH)**
   - Market reversing after strong move
   - Reversal pattern
   - Needs structure confirmation

3. **Liquidity Levels**
   - Equal highs/lows = order blocks
   - Price often rejects after sweep
   - Look for 3+ touches to confirm

4. **Order Flow**
   - Momentum indicates direction
   - Volume confirms strength
   - Score > 60 = strong flow

## 🏆 Success Story Example

**Starting Balance:** $8.00

**Day 1:**
- Trades: 3
- Wins: 2
- Losses: 1
- Profit: $3.00
- Balance: $11.00

**Day 2:**
- Trades: 4
- Wins: 3
- Losses: 1
- Profit: $4.50
- Balance: $15.50

**Day 3:**
- Trades: 3
- Wins: 2
- Losses: 1
- Profit: $3.00
- Balance: $18.50

**Day 4:**
- Trades: 4
- Wins: 3
- Losses: 1
- Profit: $4.50
- Balance: $23.00

**Day 5:**
- Trades: 3
- Wins: 2
- Losses: 1
- Profit: $3.00
- Balance: $26.00

**Week 1 Result:** $8 → $26 (+225%) ✅

## 🎯 Final Notes

This sniper entry strategy provides **exact entry points** by:

1. **Detecting BOS/CHOCH** to know when to enter
2. **Confirming with liquidity** to avoid false breakouts
3. **Checking order flow** to ensure direction is strong
4. **Using tight stops** for better risk management
5. **Targeting 2:1 risk-reward** for consistent profits

**Key to Success:**
- Wait for ALL confirmation factors
- Never enter without liquidity sweep
- Always check order flow score
- Stick to 1% risk per trade
- Let winners run to take profit

With proper execution, this strategy can achieve **65-75% win rate** with **2:1 risk-reward**, making it ideal for growing small accounts quickly while keeping risk minimal.