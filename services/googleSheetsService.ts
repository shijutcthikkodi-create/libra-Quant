
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
    
    const formattedSignals = (data.signals || [])
      .map((s: any, index: number) => {
        const instrument = String(getVal(s, 'instrument') || '').trim();
        const symbol = String(getVal(s, 'symbol') || '').trim();

        if (!instrument || !symbol) return null;

        const rawTargets = getVal(s, 'targets');
        let parsedTargets: number[] = [];
        if (typeof rawTargets === 'string' && rawTargets.trim() !== '') {
          parsedTargets = rawTargets.split(',').map(t => parseFloat(t.trim())).filter(n => !isNaN(n));
        } else if (Array.isArray(rawTargets)) {
          parsedTargets = rawTargets.map(t => parseFloat(t)).filter(n => !isNaN(n));
        } else if (typeof rawTargets === 'number' && !isNaN(rawTargets)) {
          parsedTargets = [rawTargets];
        }
        
        if (parsedTargets.length === 0) {
          [1, 2, 3].forEach(i => {
            const val = parseFloat(getVal(s, `target${i}`));
            if (!isNaN(val) && val !== 0) parsedTargets.push(val);
          });
        }

        const btstVal = String(getVal(s, 'btst') || '').toUpperCase();

        return {
          ...s,
          id: getVal(s, 'id') ? String(getVal(s, 'id')).trim() : `SIG-${index}`,
          sheetIndex: index,
          instrument,
          symbol,
          entryPrice: Number(getVal(s, 'entryPrice') || 0),
          stopLoss: Number(getVal(s, 'stopLoss') || 0),
          targets: parsedTargets,
          targetsHit: Number(getVal(s, 'targetsHit') || 0), 
          action: (getVal(s, 'action') || 'BUY') as 'BUY' | 'SELL',
          status: normalizeStatus(getVal(s, 'status')),
          pnlPoints: Number(getVal(s, 'pnlPoints') || 0),
          pnlRupees: getVal(s, 'pnlRupees') !== undefined ? Number(getVal(s, 'pnlRupees')) : undefined,
          trailingSL: getVal(s, 'trailingSL') ? Number(getVal(s, 'trailingSL')) : null,
          comment: String(getVal(s, 'comment') || ''),
          timestamp: getVal(s, 'timestamp') || new Date().toISOString(),
          lastTradedTimestamp: getVal(s, 'lastTradedTimestamp') || getVal(s, 'lastUpdated') || null,
          // New Institutional Fields from Columns Q, R, S
          quantity: Number(getVal(s, 'quantity') || 0),
          cmp: Number(getVal(s, 'cmp') || 0),
          isBTST: btstVal === 'TRUE' || btstVal === 'YES' || btstVal === 'BTST'
        };
      })
      .filter((s: any) => s !== null);

    const formattedWatch = (data.watchlist || [])
      .map((w: any) => {
        const symbol = String(getVal(w, 'symbol') || '').trim();
        if (!symbol) return null;
        return {
          ...w,
          symbol,
          price: Number(getVal(w, 'price') || 0),
          change: Number(getVal(w, 'change') || 0),
          isPositive: Number(getVal(w, 'change') || 0) >= 0,
          lastUpdated: formatToIST(getVal(w, 'lastUpdated'))
        };
      })
      .filter((w: any) => w !== null);

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
        await new Promise(res => setTimeout(res, (3 - retries) * 3000)); 
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
