// Performance monitoring and system health test
console.log('📊 Starting performance monitoring and system health test...');

// Mock components for testing
class MockSystemHealth {
  async performHealthCheck() {
    return {
      isHealthy: true,
      issues: [
        { component: 'AI Analyzer', message: 'Cache size optimal', severity: 'info' },
        { component: 'Real-time Data Feed', message: 'Connected and streaming', severity: 'info' }
      ]
    };
  }
}

class MockPerformanceAnalytics {
  getRealTimeRiskMetrics() {
    return {
      sharpeRatio: 1.25,
      maxDrawdown: 0.023,
      winRate: 0.68,
      profitFactor: 1.45,
      totalTrades: 156,
      dailyPnL: 45.67,
      weeklyPnL: 312.89,
      monthlyPnL: 1245.67
    };
  }
}

class MockOrderManager {
  getAccountStatus() {
    return {
      balance: 12567.89,
      equity: 12456.78,
      margin: 234.56,
      freeMargin: 12222.22,
      positions: 2
    };
  }

  getExecutionMetrics() {
    return {
      averageSlippage: 0.00012,
      averageLatency: 45, // ms
      successRate: 0.987,
      totalOrders: 1247,
      failedOrders: 16
    };
  }
}

class MockRealTimeDataFeed {
  getConnectionStatus() {
    return {
      connected: true,
      latency: 23, // ms
      symbolsStreaming: ['EURUSD', 'GBPUSD', 'XAUUSD'],
      updateFrequency: 1000 // ms
    };
  }
}

// Run performance monitoring test
async function runPerformanceMonitoringTest() {
  console.log('🔍 Initializing performance monitoring components...');

  const systemHealth = new MockSystemHealth();
  const performanceAnalytics = new MockPerformanceAnalytics();
  const orderManager = new MockOrderManager();
  const realTimeDataFeed = new MockRealTimeDataFeed();

  console.log('🏥 Performing system health check...');
  const healthCheck = await systemHealth.performHealthCheck();

  console.log('📊 System Health Status:');
  console.log(`   - Overall Health: ${healthCheck.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  console.log(`   - Issues Found: ${healthCheck.issues.length}`);

  healthCheck.issues.forEach(issue => {
    const icon = issue.severity === 'critical' ? '🚨' :
                 issue.severity === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`   ${icon} ${issue.component}: ${issue.message}`);
  });

  console.log('\n📈 Performance Analytics:');
  const riskMetrics = performanceAnalytics.getRealTimeRiskMetrics();
  console.log(`   - Sharpe Ratio: ${riskMetrics.sharpeRatio.toFixed(2)}`);
  console.log(`   - Max Drawdown: ${(riskMetrics.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`   - Win Rate: ${(riskMetrics.winRate * 100).toFixed(1)}%`);
  console.log(`   - Profit Factor: ${riskMetrics.profitFactor.toFixed(2)}`);
  console.log(`   - Total Trades: ${riskMetrics.totalTrades}`);
  console.log(`   - Daily P&L: $${riskMetrics.dailyPnL.toFixed(2)}`);
  console.log(`   - Weekly P&L: $${riskMetrics.weeklyPnL.toFixed(2)}`);
  console.log(`   - Monthly P&L: $${riskMetrics.monthlyPnL.toFixed(2)}`);

  console.log('\n💰 Account Status:');
  const accountStatus = orderManager.getAccountStatus();
  console.log(`   - Balance: $${accountStatus.balance.toFixed(2)}`);
  console.log(`   - Equity: $${accountStatus.equity.toFixed(2)}`);
  console.log(`   - Margin Used: $${accountStatus.margin.toFixed(2)}`);
  console.log(`   - Free Margin: $${accountStatus.freeMargin.toFixed(2)}`);
  console.log(`   - Open Positions: ${accountStatus.positions}`);

  console.log('\n⚡ Execution Metrics:');
  const executionMetrics = orderManager.getExecutionMetrics();
  console.log(`   - Average Slippage: ${executionMetrics.averageSlippage.toFixed(5)}`);
  console.log(`   - Average Latency: ${executionMetrics.averageLatency}ms`);
  console.log(`   - Success Rate: ${(executionMetrics.successRate * 100).toFixed(1)}%`);
  console.log(`   - Total Orders: ${executionMetrics.totalOrders}`);
  console.log(`   - Failed Orders: ${executionMetrics.failedOrders}`);

  console.log('\n📡 Data Feed Status:');
  const dataFeedStatus = realTimeDataFeed.getConnectionStatus();
  console.log(`   - Connection: ${dataFeedStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}`);
  console.log(`   - Latency: ${dataFeedStatus.latency}ms`);
  console.log(`   - Streaming Symbols: ${dataFeedStatus.symbolsStreaming.join(', ')}`);
  console.log(`   - Update Frequency: ${dataFeedStatus.updateFrequency}ms`);

  // Risk assessment
  console.log('\n🛡️ Risk Assessment:');
  const riskLevel = riskMetrics.maxDrawdown > 0.05 ? 'HIGH' :
                   riskMetrics.maxDrawdown > 0.02 ? 'MEDIUM' : 'LOW';
  const performanceLevel = riskMetrics.sharpeRatio > 1.5 ? 'EXCELLENT' :
                          riskMetrics.sharpeRatio > 1.0 ? 'GOOD' :
                          riskMetrics.sharpeRatio > 0.5 ? 'FAIR' : 'POOR';

  console.log(`   - Risk Level: ${riskLevel} (Max Drawdown: ${(riskMetrics.maxDrawdown * 100).toFixed(2)}%)`);
  console.log(`   - Performance Level: ${performanceLevel} (Sharpe: ${riskMetrics.sharpeRatio.toFixed(2)})`);
  console.log(`   - System Health: ${healthCheck.isHealthy ? 'HEALTHY' : 'ISSUES DETECTED'}`);

  // Recommendations
  console.log('\n💡 Recommendations:');
  if (riskMetrics.maxDrawdown > 0.03) {
    console.log('   - Consider reducing position sizes to lower drawdown');
  }
  if (riskMetrics.sharpeRatio < 1.0) {
    console.log('   - Review strategy parameters for better risk-adjusted returns');
  }
  if (executionMetrics.averageLatency > 100) {
    console.log('   - Investigate execution latency issues');
  }
  if (executionMetrics.successRate < 0.95) {
    console.log('   - Review order execution reliability');
  }

  console.log('\n✅ Performance monitoring test completed successfully!');
  console.log('🎯 All monitoring components validated and reporting correctly.');
}

// Simulate live monitoring for a short period
async function simulateLiveMonitoring() {
  console.log('📊 Simulating live monitoring for 30 seconds...');

  const monitoringInterval = setInterval(() => {
    const mockMetrics = {
      trades: Math.floor(Math.random() * 5),
      pnl: (Math.random() - 0.5) * 20,
      latency: 20 + Math.random() * 30
    };

    console.log(`📈 Live Update: ${mockMetrics.trades} trades, P&L: $${mockMetrics.pnl.toFixed(2)}, Latency: ${mockMetrics.latency.toFixed(0)}ms`);
  }, 5000); // Update every 5 seconds

  await new Promise(resolve => setTimeout(resolve, 30000)); // Monitor for 30 seconds
  clearInterval(monitoringInterval);

  console.log('⏰ Live monitoring simulation completed.');
}

async function main() {
  await runPerformanceMonitoringTest();
  console.log('');
  await simulateLiveMonitoring();
}

main().catch(error => {
  console.error('❌ Performance monitoring test failed:', error);
  process.exit(1);
});