
export enum TradeStatus {
  ACTIVE = 'ACTIVE',
  PARTIAL = 'PARTIAL BOOKED',
  EXITED = 'EXITED',
  STOPPED = 'STOP LOSS HIT',
  ALL_TARGET = 'ALL TARGET DONE'
}

export enum InstrumentType {
  INDEX = 'INDEX',
  STOCK = 'STOCK'
}

export enum OptionType {
  CE = 'CE',
  PE = 'PE',
  FUT = 'FUT'
}

export interface TradeSignal {
  id: string;
  instrument: string;
  symbol: string;
  type: OptionType;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  targets: number[];
  targetsHit?: number; // 0, 1, 2, or 3
  trailingSL?: number | null;
  status: TradeStatus;
  timestamp: string;
  lastTradedTimestamp?: string;
  pnlPoints?: number;
  pnlRupees?: number;
  comment?: string;
}

export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  expiryDate: string;
  isAdmin: boolean;
  password?: string;
  deviceId?: string | null;
}

export interface PnLStats {
  totalTrades: number;
  winRate: number;
  netPoints: number;
  estimatedPnL: number;
  accuracy: number;
}

export interface WatchlistItem {
  symbol: string;
  price: number;
  change: number;
  isPositive: boolean;
  lastUpdated: string;
}
