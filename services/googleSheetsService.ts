
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
  const s = String(val || '').toUpperCase().trim();
  return s === 'TRUE' || s === 'YES' || s === '1' || s === 'Y';
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

const parseSignalRow = (s: any, index: number): TradeSignal | null => {
  const instrument = String(getVal(s, 'instrument') || '').trim();
  const symbol = String(getVal(s, 'symbol') || '').trim();
  if (!instrument || !symbol) return null;

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

  return {
    ...s,
    id: getVal(s, 'id') ? String(getVal(s, 'id')).trim() : `SIG-${index}`,
    instrument,
    symbol,
    entryPrice: getNum(s, 'entryPrice') || 0,
    stopLoss: getNum(s, 'stopLoss') || 0,
    targets: parsedTargets,
    targetsHit: getNum(s, 'targetsHit') || 0, 
    action: (getVal(s, 'action') || 'BUY') as 'BUY' | 'SELL',
    status: normalizeStatus(getVal(s, 'status')),
    pnlPoints: getNum(s, 'pnlPoints') || 0,
    pnlRupees: getNum(s, 'pnlRupees'),
    trailingSL: getNum(s, 'trailingSL') ?? null,
    comment: String(getVal(s, 'comment') || ''),
    timestamp: getVal(s, 'timestamp') || new Date().toISOString(),
    quantity: getNum(s, 'quantity') || 0,
    cmp: getNum(s, 'cmp') || 0,
    isBTST: isTrue(getVal(s, 'btst'))
  };
};

export const fetchSheetData = async (retries = 2): Promise<SheetData | null> => {
  if (!SCRIPT_URL) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); 

  try {
    const v = Date.now();
    const response = await fetch(`${SCRIPT_URL}?v=${v}`, { method: 'GET', mode: 'cors', signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    const data = robustParseJson(await response.text());
    
    const formattedUsers = (data.users || []).map((u: any) => ({
      ...u,
      id: String(getVal(u, 'id') || getVal(u, 'userId') || '').trim() || String(getVal(u, 'phoneNumber') || ''),
      name: String(getVal(u, 'name') || 'Client'),
      phoneNumber: String(getVal(u, 'phoneNumber') || ''),
      password: String(getVal(u, 'password') || ''),
      expiryDate: String(getVal(u, 'expiryDate') || ''),
      isAdmin: String(getVal(u, 'isAdmin') || 'false').toLowerCase() === 'true',
      deviceId: getVal(u, 'deviceId') ? String(getVal(u, 'deviceId')) : null
    }));

    const formattedMessages = (data.messages || []).map((m: any) => ({
      id: String(getVal(m, 'id') || Math.random()),
      userId: String(getVal(m, 'userId') || getVal(m, 'uid') || '').trim(),
      senderName: String(getVal(m, 'senderName') || 'Subscriber'),
      text: String(getVal(m, 'text') || '').trim(),
      timestamp: String(getVal(m, 'timestamp') || new Date().toISOString()),
      isAdminReply: String(getVal(m, 'isAdminReply') || 'false').toLowerCase() === 'true'
    })).filter((m: any) => m.userId && m.text);

    return { 
      signals: (data.signals || []).map((s: any, i: number) => ({ ...parseSignalRow(s, i), sheetIndex: i })).filter((s: any) => s !== null),
      history: (data.history || []).map((s: any, i: number) => parseSignalRow(s, i)).filter((s: any) => s !== null),
      watchlist: (data.watchlist || []).map((w: any) => ({ 
        ...w, 
        symbol: String(getVal(w, 'symbol') || ''),
        price: Number(getVal(w, 'price') || 0),
        change: Number(getVal(w, 'change') || 0),
        isPositive: getVal(w, 'isPositive') === true || String(getVal(w, 'isPositive')).toLowerCase() === 'true',
        lastUpdated: String(getVal(w, 'lastUpdated') || '')
      })).filter((w: any) => w.symbol),
      users: formattedUsers,
      logs: (data.logs || []).map((l: any) => ({
        timestamp: getVal(l, 'timestamp') || new Date().toISOString(),
        user: getVal(l, 'user') || 'System',
        action: getVal(l, 'action') || 'N/A',
        details: getVal(l, 'details') || '',
        type: (getVal(l, 'type') || 'SYSTEM').toUpperCase()
      })),
      messages: formattedMessages
    };
  } catch (error) {
    if (retries > 0) return fetchSheetData(retries - 1);
    throw error;
  }
};

export const updateSheetData = async (target: 'signals' | 'watchlist' | 'users' | 'logs' | 'messages', action: string, payload: any, id?: string) => {
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
