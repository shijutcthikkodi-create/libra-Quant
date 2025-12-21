
import { TradeSignal, WatchlistItem, User, TradeStatus } from '../types';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyFbphSzUzTcjwiqGs3EdCcg2y67fOhmvuq65cXLSvaUJXFRDyrMTJkm6OdrVNPMk_A/exec';

export interface SheetData {
  signals: (TradeSignal & { sheetIndex: number })[];
  watchlist: WatchlistItem[];
  users: User[];
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

const formatToIST = (input: any): string => {
  try {
    const date = new Date(input);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
  } catch (e) {}
  return String(input || '--');
};

const getVal = (obj: any, targetKey: string): any => {
  if (!obj || typeof obj !== 'object') return undefined;
  const normalizedTarget = targetKey.toLowerCase().replace(/\s/g, '');
  for (const key in obj) {
    if (key.toLowerCase().replace(/\s/g, '') === normalizedTarget) {
      return obj[key];
    }
  }
  return undefined;
};

const normalizeStatus = (statusStr: string): TradeStatus => {
  if (!statusStr) return TradeStatus.ACTIVE;
  const s = statusStr.toUpperCase().trim();
  
  if (s.includes('ACTIVE') || s.includes('LIVE')) return TradeStatus.ACTIVE;
  if (s.includes('PARTIAL') || s.includes('BOOKED')) return TradeStatus.PARTIAL;
  if (s.includes('STOP') || s.includes('SL HIT') || s.includes('LOSS') || s.includes('STOPPED')) return TradeStatus.STOPPED;
  if (s.includes('EXIT') || s.includes('CLOSE') || s.includes('SQUARE')) return TradeStatus.EXITED;
  
  return statusStr as TradeStatus;
};

export const fetchSheetData = async (retries = 2): Promise<SheetData | null> => {
  if (!SCRIPT_URL) return null;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); 

  try {
    const v = Date.now();
    const response = await fetch(`${SCRIPT_URL}?v=${v}`, { 
      method: 'GET', 
      mode: 'cors', 
      credentials: 'omit', 
      redirect: 'follow', 
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    const rawText = await response.text();
    if (!rawText || rawText.length < 2) throw new Error("EMPTY_RESPONSE");

    const data = robustParseJson(rawText);
    
    const formattedSignals = (data.signals || []).map((s: any, index: number) => {
      let targetsRaw = getVal(s, 'targets');
      let parsedTargets: number[] = Array.isArray(targetsRaw) ? targetsRaw.map(Number) : 
                                   (typeof targetsRaw === 'string' ? targetsRaw.split(',').map(t => Number(t.trim())).filter(n => !isNaN(n)) : [Number(targetsRaw)]);
      
      const rawStatus = getVal(s, 'status');
      
      return {
        ...s,
        id: getVal(s, 'id') ? String(getVal(s, 'id')).trim() : `SIG-${index}`,
        sheetIndex: index,
        instrument: String(getVal(s, 'instrument') || 'NIFTY'),
        symbol: String(getVal(s, 'symbol') || ''),
        entryPrice: Number(getVal(s, 'entryPrice') || 0),
        stopLoss: Number(getVal(s, 'stopLoss') || 0),
        targets: parsedTargets,
        targetsHit: Number(getVal(s, 'targetsHit') || 0), 
        action: (getVal(s, 'action') || 'BUY') as 'BUY' | 'SELL',
        status: normalizeStatus(rawStatus),
        pnlPoints: Number(getVal(s, 'pnlPoints') || 0),
        pnlRupees: getVal(s, 'pnlRupees') !== undefined ? Number(getVal(s, 'pnlRupees')) : undefined,
        trailingSL: getVal(s, 'trailingSL') ? Number(getVal(s, 'trailingSL')) : null,
        comment: String(getVal(s, 'comment') || ''),
        timestamp: getVal(s, 'timestamp') || new Date().toISOString(),
        lastTradedTimestamp: getVal(s, 'lastTradedTimestamp') || getVal(s, 'lastUpdated') || null
      };
    });

    const formattedWatch = (data.watchlist || []).map((w: any) => ({
      ...w,
      symbol: String(getVal(w, 'symbol') || '').trim(),
      price: Number(getVal(w, 'price') || 0),
      change: Number(getVal(w, 'change') || 0),
      isPositive: Number(getVal(w, 'change') || 0) >= 0,
      lastUpdated: formatToIST(getVal(w, 'lastUpdated'))
    }));

    const formattedUsers = (data.users || []).map((u: any) => {
      const expiry = getVal(u, 'expiryDate') || getVal(u, 'expiry');
      return {
        ...u,
        id: String(getVal(u, 'id') || ''),
        name: String(getVal(u, 'name') || 'Client'),
        phoneNumber: String(getVal(u, 'phoneNumber') || ''),
        password: String(getVal(u, 'password') || ''),
        expiryDate: expiry ? String(expiry) : '',
        isAdmin: String(getVal(u, 'isAdmin') || 'false').toLowerCase() === 'true',
        deviceId: getVal(u, 'deviceId') ? String(getVal(u, 'deviceId')).trim() : null
      };
    });

    return { signals: formattedSignals, watchlist: formattedWatch, users: formattedUsers };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (retries > 0) { 
        const delay = (3 - retries) * 3000;
        await new Promise(res => setTimeout(res, delay)); 
        return fetchSheetData(retries - 1); 
    }
    throw error;
  }
};

export const updateSheetData = async (target: 'signals' | 'watchlist' | 'users', action: 'ADD' | 'UPDATE_SIGNAL' | 'UPDATE_USER' | 'DELETE_USER', payload: any, id?: string) => {
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
