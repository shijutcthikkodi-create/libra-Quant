
import { TradeSignal, WatchlistItem, User, TradeStatus, LogEntry, ChatMessage } from '../types';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvKlkhm4P2wj0t5ePFGEVzCFOhL6k96qC4dc0OAId1NLCUl_sphIo6fupHOX3d6Coz/exec';

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
  let val = getVal(obj, key);
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  const cleanVal = String(val).replace(/[^\d.-]/g, '');
  const n = parseFloat(cleanVal);
  return isNaN(n) ? undefined : n;
};

const isTrue = (val: any): boolean => {
  if (val === true || val === 1 || val === '1') return true;
  const s = String(val || '').toUpperCase().trim().replace(/\./g, '');
  return ['TRUE', 'YES', 'Y', 'BTST', 'B.T.S.T', 'ADMIN', 'OK', '1'].includes(s);
};

const normalizeStatus = (val: any): TradeStatus => {
  if (val === undefined || val === null || val === '') return TradeStatus.ACTIVE;
  const s = String(val).toUpperCase().trim();
  if (s === '3' || s.includes('ALL TARGET')) return TradeStatus.ALL_TARGET;
  if (s.includes('PARTIAL') || s.includes('BOOKED')) return TradeStatus.PARTIAL;
  if (s.includes('STOP') || s.includes('SL HIT') || s.includes('LOSS') || s.includes('STOPPED')) return TradeStatus.STOPPED;
  if (s.includes('EXIT') || s.includes('CLOSE') || s.includes('SQUARE')) return TradeStatus.EXITED;
  return TradeStatus.ACTIVE;
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

  const id = String(getVal(s, 'id') || `sig-${index}-${Date.now()}`).trim();

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
    timestamp: getVal(s, 'timestamp') || new Date().toISOString(),
    isBTST: isTrue(getVal(s, 'isBTST'))
  };
};

export const fetchSheetData = async (retries = 2): Promise<SheetData | null> => {
  if (!SCRIPT_URL) return null;
  try {
    const v = Date.now();
    const response = await fetch(`${SCRIPT_URL}?v=${v}`, { method: 'GET', mode: 'cors' });
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
        isPositive: isTrue(getVal(w, 'isPositive'))
      })).filter((w: any) => w.symbol),
      users: (data.users || []).map((u: any) => ({
        id: String(getVal(u, 'id') || getVal(u, 'userId') || '').trim(),
        name: String(getVal(u, 'name') || 'Client').trim(),
        phoneNumber: String(getVal(u, 'phoneNumber') || '').trim(),
        expiryDate: String(getVal(u, 'expiryDate') || '').trim(),
        isAdmin: isTrue(getVal(u, 'isAdmin')),
        password: String(getVal(u, 'password') || '').trim(),
        lastPassword: String(getVal(u, 'lastPassword') || '').trim(),
        deviceId: String(getVal(u, 'deviceId') || '').trim() || null
      })),
      logs: (data.logs || []).map((l: any) => ({
        timestamp: getVal(l, 'timestamp') || new Date().toISOString(),
        user: String(getVal(l, 'user') || 'System'),
        action: String(getVal(l, 'action') || 'N/A'),
        details: String(getVal(l, 'details') || ''),
        type: (String(getVal(l, 'type') || 'SYSTEM')).toUpperCase() as any
      })),
      messages: (data.messages || []).map((m: any) => ({
        id: String(getVal(m, 'id') || Math.random()),
        userId: String(getVal(m, 'userId') || '').trim(),
        text: String(getVal(m, 'text') || '').trim(),
        timestamp: String(getVal(m, 'timestamp') || new Date().toISOString()),
        isAdminReply: isTrue(getVal(m, 'isAdminReply'))
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
