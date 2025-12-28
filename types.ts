
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
  date?: string; // Format: YYYY-MM-DD
  instrument: string;
  symbol: string;
  type: OptionType;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  targets: number[];
  targetsHit?: number; 
  trailingSL?: number | null;
  status: TradeStatus;
  timestamp: string;
  lastTradedTimestamp?: string;
  pnlPoints?: number;
  pnlRupees?: number;
  comment?: string;
  quantity?: number;
  cmp?: number;
  isBTST?: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isAdminReply: boolean;
}

export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  expiryDate: string;
  isAdmin: boolean;
  password?: string;
  lastPassword?: string; // Track password at time of device lock
  deviceId?: string | null;
}

export interface LogEntry {
  timestamp: string;
  user: string;
  action: string;
  details: string;
  type: 'SECURITY' | 'TRADE' | 'USER' | 'SYSTEM';
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
