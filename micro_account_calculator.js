// Realistic Profit Calculator for $19 Micro Account
console.log('💰 MICRO ACCOUNT PROFIT CALCULATOR ($19 Starting Balance)');
console.log('=' .repeat(60));

const accountBalance = 19.00;
const microLotSize = 0.01; // 0.01 lots = 1000 units
const riskPerTrade = 0.5; // 0.5% risk per trade
const winRate = 0.65; // 65% win rate (realistic)
const riskRewardRatio = 2.0; // 2:1 reward to risk ratio

console.log(`Starting Balance: $${accountBalance}`);
console.log(`Micro Lot Size: ${microLotSize} lots`);
console.log(`Risk Per Trade: ${riskPerTrade}%`);
console.log(`Win Rate: ${(winRate * 100).toFixed(1)}%`);
console.log(`Risk:Reward Ratio: ${riskRewardRatio}:1`);
console.log('');

function calculateProfitPotential(symbol, pipValue, currentPrice) {
  // Calculate position value and risk amount
  const positionValue = microLotSize * 100000 * currentPrice; // For forex pairs
  const riskAmount = accountBalance * (riskPerTrade / 100);
  const potentialLoss = riskAmount;
  const potentialProfit = riskAmount * riskRewardRatio;

  // Calculate pip distances
  const stopLossPips = potentialLoss / (microLotSize * 100000 * pipValue);
  const takeProfitPips = potentialProfit / (microLotSize * 100000 * pipValue);

  return {
    riskAmount: riskAmount.toFixed(2),
    potentialProfit: potentialProfit.toFixed(2),
    potentialLoss: potentialLoss.toFixed(2),
    stopLossPips: stopLossPips.toFixed(1),
    takeProfitPips: takeProfitPips.toFixed(1)
  };
}

// Test with different pairs
const pairs = [
  { symbol: 'EURUSD', pipValue: 0.0001, price: 1.0850 },
  { symbol: 'GBPUSD', pipValue: 0.0001, price: 1.2750 },
  { symbol: 'USDJPY', pipValue: 0.01, price: 157.50 },
  { symbol: 'XAUUSD', pipValue: 0.01, price: 2050.00 } // Gold
];

console.log('📊 PER TRADE ANALYSIS (0.01 Lots):');
console.log('-'.repeat(60));

pairs.forEach(pair => {
  const calc = calculateProfitPotential(pair.symbol, pair.pipValue, pair.price);
  console.log(`${pair.symbol} ($${pair.price}):`);
  console.log(`  Risk Amount: $${calc.riskAmount} (${riskPerTrade}% of $${accountBalance})`);
  console.log(`  Potential Profit: $${calc.potentialProfit} (${(parseFloat(calc.potentialProfit)/accountBalance*100).toFixed(1)}% of account)`);
  console.log(`  Potential Loss: $${calc.potentialLoss} (${(parseFloat(calc.potentialLoss)/accountBalance*100).toFixed(1)}% of account)`);
  console.log(`  Stop Loss: ${calc.stopLossPips} pips`);
  console.log(`  Take Profit: ${calc.takeProfitPips} pips`);
  console.log('');
});

// Realistic daily scenario
console.log('🎯 REALISTIC DAILY SCENARIO (10 Trades):');
console.log('-'.repeat(60));

const avgProfitPerTrade = 0.095; // Average $0.095 profit per winning trade
const tradesPerDay = 10;
const winningTrades = Math.floor(tradesPerDay * winRate);
const losingTrades = tradesPerDay - winningTrades;

const dailyProfit = (winningTrades * avgProfitPerTrade) - (losingTrades * 0.095); // Same amount lost
const dailyPercentage = (dailyProfit / accountBalance) * 100;

console.log(`Trades per day: ${tradesPerDay}`);
console.log(`Winning trades: ${winningTrades} ($${avgProfitPerTrade} each)`);
console.log(`Losing trades: ${losingTrades} ($${(avgProfitPerTrade).toFixed(2)} each)`);
console.log(`Daily P&L: $${dailyProfit.toFixed(2)} (${dailyPercentage.toFixed(1)}%)`);
console.log(`New balance: $${(accountBalance + dailyProfit).toFixed(2)}`);
console.log('');

// Monthly projection (20 trading days)
const monthlyProfit = dailyProfit * 20;
const monthlyPercentage = (monthlyProfit / accountBalance) * 100;

console.log('📅 MONTHLY PROJECTION (20 Trading Days):');
console.log('-'.repeat(60));
console.log(`Monthly P&L: $${monthlyProfit.toFixed(2)} (${monthlyPercentage.toFixed(1)}%)`);
console.log(`New balance: $${(accountBalance + monthlyProfit).toFixed(2)}`);
console.log('');

// Reality check
console.log('⚠️  REALITY CHECK:');
console.log('-'.repeat(60));
console.log('Making $100 profit in ONE DAY would require:');
console.log(`  - $${(100/accountBalance*100).toFixed(0)}% return (impossible)`);
console.log('  - Perfect 100% win rate (impossible)');
console.log('  - 50+ winning trades in one day (impossible)');
console.log('  - Taking 5-10% risk per trade (gambling, not trading)');
console.log('');
console.log('✅ SAFE APPROACH:');
console.log('  - Focus on 1-2% daily profit target');
console.log('  - Build account gradually over weeks/months');
console.log('  - Never risk more than 0.5% per trade');
console.log('  - Use micro lots (0.01) for safety');
console.log('  - Be patient - consistency beats quick riches');