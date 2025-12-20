import { TradeSignal, TradeStatus, InstrumentType, OptionType, User, PnLStats, WatchlistItem } from './types';

// In a real app, this comes from Firebase Auth context
export const MOCK_USER: User = {
  id: 'USR-9928',
  phoneNumber: '+919876543210',
  name: 'Demo Trader',
  expiryDate: '2024-12-31',
  isAdmin: true
};

export const MOCK_SIGNALS: TradeSignal[] = [
  {
    id: 'SIG-001',
    instrument: 'BANKNIFTY',
    symbol: '47500',
    type: OptionType.CE,
    action: 'BUY',
    entryPrice: 320,
    stopLoss: 280,
    targets: [360, 400, 480],
    trailingSL: 340,
    status: TradeStatus.ACTIVE,
    timestamp: new Date().toISOString(),
    comment: 'Strong breakout above VWAP'
  },
  {
    id: 'SIG-002',
    instrument: 'NIFTY',
    symbol: '22100',
    type: OptionType.PE,
    action: 'BUY',
    entryPrice: 110,
    stopLoss: 90,
    targets: [130, 150, 180],
    status: TradeStatus.PARTIAL,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    pnlPoints: 40,
    comment: 'Target 1 Done, Safe traders book full'
  }
];

export const MOCK_STATS: PnLStats = {
  totalTrades: 42,
  winRate: 78.5,
  netPoints: 1250,
  estimatedPnL: 62500,
  accuracy: 82
};

export const MOCK_WATCHLIST: WatchlistItem[] = [
  { symbol: 'NIFTY 50', price: 22450.30, change: 0.45, isPositive: true, lastUpdated: '15:30' },
  { symbol: 'BANKNIFTY', price: 47820.10, change: -0.12, isPositive: false, lastUpdated: '15:31' },
];

export const SEBI_DISCLAIMER = `The information and trade ideas provided on LibraQuant are strictly for educational and informational purposes only.

LibraQuant is not a SEBI-registered investment advisor or research analyst.

Stock market, derivatives, and cryptocurrency trading involve substantial risk and may not be suitable for all investors. Past performance does not guarantee future results.

All trading signals, analysis, and content shared through this application are based on personal views and market understanding and should not be considered as investment advice, financial advice, or a recommendation to buy or sell any securities.

Users are advised to consult with a qualified financial advisor before making any investment or trading decisions.

LibraQuant and its owners shall not be responsible for any financial losses, damages, or legal consequences arising directly or indirectly from the use of this application or reliance on the information provided herein.

By using this application, you acknowledge that you understand the risks involved in trading and agree to take full responsibility for your own trading decisions.`;

export const FOOTER_TEXT = "Educational purpose only. Not SEBI registered. No investment advice. Trading involves risk. Use at your own responsibility.";

export const BRANDING_TEXT = "POWERED BY LIBRA FIN-TECH SOLUTIONS";