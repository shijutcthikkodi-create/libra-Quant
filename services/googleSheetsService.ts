
import { TradeSignal, WatchlistItem, User, TradeStatus, LogEntry, ChatMessage } from '../types';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx1foRQ4bUbGKW160-QI8eKK5TXusla8ztcL_pd7eFcOFlas_M-uXrbQ7XQWDMcZH0p/exec';

export interface SheetData {
  signals: (TradeSignal & { sheetIndex: number })[];
  history: TradeSignal[];
  watchlist: WatchlistItem[];
  users: User[];
  logs: LogEntry[];
  messages: ChatMessage[];
}

const robustParseJson = (text: string) => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        throw new Error("Invalid JSON structure.");
      }
    }
    throw new Error("Invalid response format.");
  }
};

const getVal = (obj: any, targetKey: string): any => {
  if (!obj || typeof obj !== 'object') return undefined;
  const normalizedTarget = targetKey.toLowerCase().replace(/\s|_|-/g, '');
  for (const key in obj) {
    if (key.toLowerCase().replace(/\s|_|-/g, '') === normalizedTarget) return obj[key];
  }
  return undefined;
};

const getNum = (obj: any, key: string): number | undefined => {
  const val = getVal(obj, key);
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
};

const isTrue = (val: any): boolean => {
  if (val === true) return true;
  if (typeof val === 'number') return val === 1;
  const s = String(val || '').toUpperCase().trim();
  return ['TRUE', 'YES', '1', 'Y', 'BTST', 'B.T.S.T', 'OVERNIGHT'].includes(s);
};

const normalizeStatus = (val: any): TradeStatus => {
  if (val === undefined || val === null || val === '') return TradeStatus.ACTIVE;
  const s = String(val).toUpperCase().trim();
  if (s === '3' || s.includes('ALL TARGET')) return TradeStatus.ALL_TARGET;
  if (s.includes('ACTIVE') || s.includes('LIVE')) return TradeStatus.ACTIVE;
  if (s.includes('PARTIAL') || s.includes('BOOKED')) return TradeStatus.PARTIAL;
  if (s.includes('STOP') || s.includes('SL HIT') || s.includes('LOSS') || s.includes('STOPPED')) return TradeStatus.STOPPED;
  if (s.includes('EXIT') || s.includes('CLOSE') || s.includes('SQUARE')) return TradeStatus.EXITED;
  return TradeStatus.ACTIVE;
};

const generateTradeFingerprint = (s: any, index: number, tab: string): string => {
  const inst = String(getVal(s, 'instrument') || '').trim().toUpperCase();
  const sym = String(getVal(s, 'symbol') || '').trim().toUpperCase();
  const entry = Number(getVal(s, 'entryPrice') || 0).toFixed(2);
  const time = String(getVal(s, 'timestamp') || '').trim();
  
  const rawId = `${tab}-${index}-${inst}-${sym}-${entry}-${time}`;
  return btoa(rawId).replace(/[^a-zA-Z0-9]/g, '').slice(-16);
};

/**
 * Normalizes dates coming from Sheet strings (YYYY-MM-DD or DD-MM-YYYY)
 * to standard ISO-like strings (YYYY-MM-DD) for grouping logic.
 */
const normalizeDateStr = (dateVal: any): string | undefined => {
  if (!dateVal) return undefined;
  let s = String(dateVal).trim();
  if (!s) return undefined;

  // Handle DD-MM-YYYY or DD/MM/YYYY
  if (s.includes('-') || s.includes('/')) {
    const separator = s.includes('-') ? '-' : '/';
    const parts = s.split(separator);
    if (parts.length === 3) {
      // If it looks like DD-MM-YYYY (parts[0] is 2 chars, parts[2] is 4)
      if (parts[0].length <= 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      // If it looks like YYYY-MM-DD
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }

  // Fallback to split timestamp if it's an ISO string
  if (s.includes('T')) return s.split('T')[0];
  
  return s;
};

const parseSignalRow = (s: any, index: number, tabName: string): TradeSignal | null => {
  const instrument = String(getVal(s, 'instrument') || '').trim();
  const symbol = String(getVal(s, 'symbol') || '').trim();
  const entryPrice = getNum(s, 'entryPrice');
  
  if (!instrument || !symbol || instrument.length < 2 || entryPrice === undefined || entryPrice === 0) return null;

  const rawTargets = getVal(s, 'targets');
  let parsedTargets: number[] = [];
  if (typeof rawTargets === 'string' && rawTargets.trim() !== '') {
    parsedTargets = rawTargets.split(',').map(t => parseFloat(t.trim())).filter(n => !isNaN(n));
  } else if (Array.isArray(rawTargets)) {
    parsedTargets = rawTargets.map(t => parseFloat(t)).filter(n => !isNaN(n));
  }
  
  if (parsedTargets.length === 0) {
    [1, 2, 3].forEach(i => {
      const val = parseFloat(getVal(s, `target${i}`));
      if (!isNaN(val) && val !== 0) parsedTargets.push(val);
    });
  }

  const explicitId = getVal(s, 'id');
  const id = explicitId ? String(explicitId).trim() : generateTradeFingerprint(s, index, tabName);

  return {
    ...s,
    id,
    instrument,
    symbol,
    entryPrice: entryPrice,
    stopLoss: getNum(s, 'stopLoss') || 0,
    targets: parsedTargets,
    targetsHit: getNum(s, 'targetsHit') || 0, 
    trailingSL: getNum(s, 'trailingSL') ?? null,
    action: (getVal(s, 'action') || 'BUY') as 'BUY' | 'SELL',
    status: normalizeStatus(getVal(s, 'status')),
    pnlPoints: getNum(s, 'pnlPoints') || 0,
    pnlRupees: getNum(s, 'pnlRupees'),
    comment: String(getVal(s, 'comment') || ''),
    timestamp: getVal(s, 'timestamp') || new Date().toISOString(),
    date: normalizeDateStr(getVal(s, 'date')) || getVal(s, 'timestamp')?.split('T')[0],
    quantity: getNum(s, 'quantity') || 0,
    cmp: getNum(s, 'cmp') || 0,
    isBTST: isTrue(getVal(s, 'isBTST') || getVal(s, 'btst') || getVal(s, 'type'))
  };
};

export const fetchSheetData = async (retries = 2): Promise<SheetData | null> => {
  if (!SCRIPT_URL) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); 

  try {
    const v = Date.now();
    const response = await fetch(`${SCRIPT_URL}?v=${v}`, { method: 'GET', mode: 'cors', signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    const data = robustParseJson(await response.text());
    
    return { 
      signals: (data.signals || [])
        .map((s: any, i: number) => ({ ...parseSignalRow(s, i, 'SIG'), sheetIndex: i }))
        .filter((s: any) => s !== null) as (TradeSignal & { sheetIndex: number })[],
      history: (data.history || [])
        .map((s: any, i: number) => parseSignalRow(s, i, 'HIST'))
        .filter((s: any) => s !== null) as TradeSignal[],
      watchlist: (data.watchlist || []).map((w: any) => ({ 
        ...w, 
        symbol: String(getVal(w, 'symbol') || ''),
        price: Number(getVal(w, 'price') || 0),
        change: Number(getVal(w, 'change') || 0),
        isPositive: getVal(w, 'isPositive') === true || String(getVal(w, 'isPositive')).toLowerCase() === 'true',
        lastUpdated: String(getVal(w, 'lastUpdated') || '')
      })).filter((w: any) => w.symbol),
      users: (data.users || []).map((u: any) => ({
        ...u,
        id: String(getVal(u, 'id') || getVal(u, 'userId') || '').trim(),
        name: String(getVal(u, 'name') || 'Client'),
        phoneNumber: String(getVal(u, 'phoneNumber') || ''),
        expiryDate: String(getVal(u, 'expiryDate') || ''),
        isAdmin: String(getVal(u, 'isAdmin') || 'false').toLowerCase() === 'true',
      })),
      logs: (data.logs || []).map((l: any) => ({
        timestamp: getVal(l, 'timestamp') || new Date().toISOString(),
        user: getVal(l, 'user') || 'System',
        action: getVal(l, 'action') || 'N/A',
        details: getVal(l, 'details') || '',
        type: (getVal(l, 'type') || 'SYSTEM').toUpperCase()
      })),
      messages: (data.messages || []).map((m: any) => ({
        id: String(getVal(m, 'id') || Math.random()),
        userId: String(getVal(m, 'userId') || '').trim(),
        text: String(getVal(m, 'text') || '').trim(),
        timestamp: String(getVal(m, 'timestamp') || new Date().toISOString()),
        isAdminReply: String(getVal(m, 'isAdminReply') || 'false').toLowerCase() === 'true'
      }))
    };
  } catch (error) {
    if (retries > 0) return fetchSheetData(retries - 1);
    throw error;
  }
};

export const updateSheetData = async (target: 'signals' | 'history' | 'watchlist' | 'users' | 'logs' | 'messages', action: string, payload: any, id?: string) => {
  if (!SCRIPT_URL) return false;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ target, action, payload, id })
    });
    return true; 
  } catch (error) { 
    return false; 
  }
};
