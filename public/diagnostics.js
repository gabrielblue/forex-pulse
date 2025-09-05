// Simple Trading Bot Diagnostics
// Copy and paste this into your browser console

console.log('🔍 Starting Trading Bot Diagnostics...');

// Check current time
const now = new Date();
const utcHour = now.getUTCHours();
console.log('⏰ Current UTC Hour:', utcHour);
console.log('📅 Current Time:', now.toISOString());

// Check trading sessions
const isLondonSession = utcHour >= 8 && utcHour < 16;
const isNewYorkSession = utcHour >= 13 && utcHour < 21;
console.log('🇬🇧 London Session (8-16):', isLondonSession ? '✅ Active' : '❌ Inactive');
console.log('🇺🇸 NY Session (13-21):', isNewYorkSession ? '✅ Active' : '❌ Inactive');

// Check available objects
console.log('🔍 Available window objects:', Object.keys(window));

// Check for trading bot
if (window.tradingBot) {
  console.log('🤖 Trading Bot: ✅ Found');
  try {
    const status = window.tradingBot.getStatus();
    console.log('📊 Bot Status:', status);
  } catch (error) {
    console.log('❌ Error getting bot status:', error.message);
  }
} else {
  console.log('🤖 Trading Bot: ❌ Not found');
}

// Check MT5 Bridge
console.log('🔌 Checking MT5 Bridge...');
fetch('http://localhost:8001/')
  .then(response => {
    if (response.ok) {
      console.log('✅ MT5 Bridge: Running');
      return response.json();
    } else {
      console.log('❌ MT5 Bridge: Not responding (status:', response.status, ')');
    }
  })
  .then(data => {
    if (data) {
      console.log('📊 Bridge Info:', data);
    }
  })
  .catch(error => {
    console.log('❌ MT5 Bridge: Connection failed -', error.message);
  });

// Recommendations
console.log('\n💡 Recommendations:');
if (!window.tradingBot) {
  console.log('• 🤖 Trading bot not found - restart the app');
}
if (utcHour < 8 || utcHour >= 21) {
  console.log('• ⏰ Not optimal trading time - wait for London/NY sessions');
}
console.log('• 🔌 If MT5 Bridge not running: python3 mt5_bridge.py');
console.log('• 📈 For testing: lower confidence threshold to 60%');

console.log('\n✅ Diagnostics complete!');