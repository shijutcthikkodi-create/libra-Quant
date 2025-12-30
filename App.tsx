
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Stats from './pages/Stats';
import Rules from './pages/Rules';
import Admin from './pages/Admin';
import BookedTrades from './pages/BookedTrades';
import { User, WatchlistItem, TradeSignal, TradeStatus, LogEntry, ChatMessage } from './types';
import { fetchSheetData, updateSheetData } from './services/googleSheetsService';
import { Radio, CheckCircle, BarChart2, ShieldAlert, Volume2, VolumeX, RefreshCw, WifiOff, Database } from 'lucide-react';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; 
const SESSION_KEY = 'libra_user_session';
const POLL_INTERVAL = 8000; 
const MAJOR_ALERT_DURATION = 15000; // STRICT 15s

export type GranularHighlights = Record<string, Set<string>>;

const SIGNAL_KEYS: Array<keyof TradeSignal> = [
  'instrument', 'symbol', 'type', 'action', 'entryPrice', 
  'stopLoss', 'targets', 'trailingSL', 'status', 'pnlPoints', 'pnlRupees', 'comment', 'targetsHit',
  'quantity', 'cmp', 'isBTST'
];

const MAJOR_ALERT_KEYS: Array<keyof TradeSignal> = [
  'status', 'targetsHit', 'stopLoss', 'entryPrice', 'isBTST', 'action', 'instrument'
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const { user, timestamp } = JSON.parse(saved);
        if (Date.now() - timestamp < SESSION_DURATION_MS) return user;
      } catch (e) { 
        localStorage.removeItem(SESSION_KEY); 
      }
    }
    return null;
  });

  const [page, setPage] = useState('dashboard');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [historySignals, setHistorySignals] = useState<TradeSignal[]>([]); 
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'syncing'>('syncing');
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--:--');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('libra_sound_enabled') === 'true');
  
  const [activeMajorAlerts, setActiveMajorAlerts] = useState<Record<string, number>>({});
  const [activeWatchlistAlerts, setActiveWatchlistAlerts] = useState<Record<string, number>>({});
  const [granularHighlights, setGranularHighlights] = useState<GranularHighlights>({});
  
  const prevSignalsRef = useRef<TradeSignal[]>([]);
  const prevWatchlistRef = useRef<WatchlistItem[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);
  const isAlertingRef = useRef(false);

  // Resume Audio on ANY user interaction
  useEffect(() => {
    const resume = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener('click', resume);
    window.addEventListener('touchstart', resume);
    return () => {
      window.removeEventListener('click', resume);
      window.removeEventListener('touchstart', resume);
    };
  }, []);

  const handleRedirectToCard = useCallback((id: string) => {
    // If not on dashboard, switch first
    setPage('dashboard');
    
    // Give time for layout to render
    setTimeout(() => {
      const el = document.getElementById(`signal-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('animate-card-pulse', 'focus-indicator');
        setTimeout(() => {
          el.classList.remove('focus-indicator');
        }, 3000);
      }
    }, 500);
  }, []);

  const playAlertSequence = useCallback((isCritical = false, isBTST = false, isWatchlist = false) => {
    if (!soundEnabled || isAlertingRef.current) return;
    
    isAlertingRef.current = true;
    
    const playBeep = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // High visibility Institutional Tones
        const frequency = isBTST ? 1400 : (isCritical ? 420 : (isWatchlist ? 1100 : 920));
        osc.type = (isBTST || isCritical) ? 'square' : 'sine';
        
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1); 
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.5); 
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.0);

        // Echo for urgency
        if (isBTST || isCritical) {
            setTimeout(() => {
                if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
                const osc2 = audioCtxRef.current.createOscillator();
                const gain2 = audioCtxRef.current.createGain();
                osc2.type = 'square';
                osc2.frequency.setValueAtTime(frequency * 1.5, audioCtxRef.current.currentTime);
                gain2.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
                gain2.gain.linearRampToValueAtTime(0.15, audioCtxRef.current.currentTime + 0.05);
                gain2.gain.exponentialRampToValueAtTime(0.0001, audioCtxRef.current.currentTime + 0.4);
                osc2.connect(gain2);
                gain2.connect(audioCtxRef.current.destination);
                osc2.start();
                osc2.stop(audioCtxRef.current.currentTime + 0.4);
            }, 200);
        }
      } catch (e) {
        console.error("Audio error", e);
      }
    };

    // Initial Beep
    playBeep();
    
    // Interval for 15 seconds
    const interval = setInterval(playBeep, isBTST ? 1200 : 2200);
    beepIntervalRef.current = interval;
    
    // STRICT 15s KILL SWITCH
    setTimeout(() => {
      if (beepIntervalRef.current === interval) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
        isAlertingRef.current = false;
      }
    }, MAJOR_ALERT_DURATION);
  }, [soundEnabled]);

  const sync = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setConnectionStatus('syncing');
    
    try {
      const data = await fetchSheetData();
      if (data) {
        let hasGlobalMajorChange = false;
        let isCriticalAlert = false;
        let isBTSTUpdate = false;
        let isWatchlistChange = false;
        let scrollTargetId: string | null = null;
        
        const now = Date.now();
        const newMajorAlerts: Record<string, number> = { ...activeMajorAlerts };
        const newWatchlistAlerts: Record<string, number> = { ...activeWatchlistAlerts };
        const newHighlights: GranularHighlights = { ...granularHighlights };

        // 1. SIGNAL SYNC
        data.signals.forEach(s => {
          const sid = s.id;
          const old = prevSignalsRef.current.find(o => o.id === sid);
          const diff = new Set<string>();
          const isActiveTrade = s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL;

          if (!old) {
            // New Trade Detected
            if (!isInitial && prevSignalsRef.current.length > 0) {
              SIGNAL_KEYS.forEach(k => diff.add(k));
              scrollTargetId = sid;
              hasGlobalMajorChange = true;
              newMajorAlerts[sid] = now + MAJOR_ALERT_DURATION;
              if (s.isBTST && isActiveTrade) isBTSTUpdate = true;
            }
          } else {
            let signalHasMajorChange = false;
            SIGNAL_KEYS.forEach(k => {
              if (JSON.stringify(s[k]) !== JSON.stringify(old[k])) {
                diff.add(k);
                // Major Property Changed
                if (MAJOR_ALERT_KEYS.includes(k) && isActiveTrade) {
                  signalHasMajorChange = true;
                  hasGlobalMajorChange = true;
                  scrollTargetId = sid;
                }
                if (s.isBTST && isActiveTrade && MAJOR_ALERT_KEYS.includes(k)) isBTSTUpdate = true;
                if (k === 'targetsHit' && (s.targetsHit || 0) > (old.targetsHit || 0)) diff.add('blast'); 
                if (k === 'status' && s.status === TradeStatus.STOPPED && old.status !== TradeStatus.STOPPED) {
                  isCriticalAlert = true;
                  diff.add('blast-red');
                  signalHasMajorChange = true;
                  hasGlobalMajorChange = true;
                  scrollTargetId = sid;
                }
              }
            });
            if (signalHasMajorChange) newMajorAlerts[sid] = now + MAJOR_ALERT_DURATION;
          }
          if (diff.size > 0) newHighlights[sid] = diff;
        });

        // 2. WATCHLIST SYNC (Strict Numeric Comparison)
        data.watchlist.forEach(w => {
          const old = prevWatchlistRef.current.find(o => o.symbol === w.symbol);
          if (old && !isInitial) {
            const p1 = Number(w.price);
            const p2 = Number(old.price);
            const c1 = Number(w.change);
            const c2 = Number(old.change);
            
            if (p1 !== p2 || c1 !== c2) {
              isWatchlistChange = true;
              newWatchlistAlerts[w.symbol] = now + MAJOR_ALERT_DURATION;
            }
          }
        });

        // 3. TRIGGER ALERTS
        if (hasGlobalMajorChange || isWatchlistChange) {
          playAlertSequence(isCriticalAlert, isBTSTUpdate, isWatchlistChange);
          if (scrollTargetId && !isInitial) handleRedirectToCard(scrollTargetId);
        }

        setActiveMajorAlerts(newMajorAlerts);
        setActiveWatchlistAlerts(newWatchlistAlerts);
        setGranularHighlights(newHighlights);

        const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(nowStr);
        prevSignalsRef.current = [...data.signals];
        prevWatchlistRef.current = [...data.watchlist];
        setSignals([...data.signals]);
        setHistorySignals([...(data.history || [])]);
        setWatchlist([...data.watchlist]);
        setUsers([...data.users]);
        setLogs([...(data.logs || [])]);
        setMessages([...(data.messages || [])]);
        setConnectionStatus('connected');
      }
    } catch (err: any) {
      console.error("Sync error", err);
      setConnectionStatus('error');
    } finally {
      isFetchingRef.current = false;
    }
  }, [playAlertSequence, handleRedirectToCard, activeMajorAlerts, activeWatchlistAlerts, granularHighlights]);

  // Alert State Expiry Engine
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const nextAlerts = { ...activeMajorAlerts };
      const nextWatchAlerts = { ...activeWatchlistAlerts };
      const nextHighlights = { ...granularHighlights };

      [nextAlerts, nextWatchAlerts].forEach(obj => {
        Object.keys(obj).forEach(key => {
          if (now > obj[key]) {
            delete obj[key];
            delete nextHighlights[key];
            changed = true;
          }
        });
      });

      if (changed) {
        setActiveMajorAlerts(nextAlerts);
        setActiveWatchlistAlerts(nextWatchAlerts);
        setGranularHighlights(nextHighlights);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeMajorAlerts, activeWatchlistAlerts, granularHighlights]);

  const handleHardSync = useCallback(async () => {
    prevSignalsRef.current = [];
    prevWatchlistRef.current = [];
    setSignals([]);
    setActiveMajorAlerts({});
    setActiveWatchlistAlerts({});
    setGranularHighlights({});
    await sync(true);
  }, [sync]);

  useEffect(() => {
    sync(true);
    const pollTimer = setInterval(() => sync(false), POLL_INTERVAL);
    return () => {
      clearInterval(pollTimer);
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
    };
  }, [sync]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('libra_sound_enabled', String(next));
    if (next) {
      // Create context immediately on button click
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      playAlertSequence(false, false, false);
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  if (!user) return <Login onLogin={(u) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, timestamp: Date.now() }));
    setUser(u);
    sync(true);
  }} />;

  return (
    <Layout user={user} onLogout={logout} currentPage={page} onNavigate={setPage}>
      <div className="fixed top-4 right-4 z-[100] flex flex-col items-end space-y-3">
        <div className={`bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] font-bold border shadow-2xl transition-all duration-500 flex items-center ${connectionStatus === 'error' ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800'}`}>
          <div className="flex flex-col items-start mr-3">
              <span className="text-[9px] text-slate-500 uppercase tracking-tighter leading-none mb-1">Server Connectivity</span>
              <div className="flex items-center">
                 <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connectionStatus === 'syncing' ? 'bg-blue-400 animate-pulse' : connectionStatus === 'error' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></div>
                 <span className={`${connectionStatus === 'error' ? 'text-rose-400' : 'text-white'} font-mono`}>{lastSyncTime}</span>
              </div>
          </div>
          <div className="flex space-x-1">
            <button onClick={handleHardSync} title="Reload Data" className="p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-blue-500/10 transition-all border border-blue-500/20">
                <Database size={14} />
            </button>
            <button onClick={() => sync(false)} disabled={connectionStatus === 'syncing'} className={`p-1.5 rounded-lg transition-all ${connectionStatus === 'error' ? 'bg-rose-500 text-white animate-bounce' : 'text-slate-500 hover:text-white'}`}>
                {connectionStatus === 'error' ? <WifiOff size={14} /> : <RefreshCw size={14} className={connectionStatus === 'syncing' ? 'animate-spin' : ''} />}
            </button>
          </div>
        </div>
        <button onClick={toggleSound} className={`p-4 rounded-full border shadow-2xl transition-all ${soundEnabled ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-cyan-500/10' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
          {soundEnabled ? <Volume2 size={32} /> : <VolumeX size={32} />}
        </button>
      </div>

      {page === 'dashboard' && <Dashboard watchlist={watchlist} signals={signals} user={user} granularHighlights={granularHighlights} activeMajorAlerts={activeMajorAlerts} activeWatchlistAlerts={activeWatchlistAlerts} onSignalUpdate={sync} />}
      {page === 'booked' && <BookedTrades signals={signals} historySignals={historySignals} user={user} granularHighlights={granularHighlights} onSignalUpdate={sync} />}
      {page === 'stats' && <Stats signals={signals} historySignals={historySignals} />}
      {page === 'rules' && <Rules />}
      {user?.isAdmin && page === 'admin' && <Admin watchlist={watchlist} onUpdateWatchlist={setWatchlist} signals={signals} onUpdateSignals={setSignals} users={users} onUpdateUsers={setUsers} logs={logs} onNavigate={setPage} onHardSync={handleHardSync} />}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 px-6 py-3 flex justify-around items-center">
        <button onClick={() => setPage('dashboard')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'dashboard' ? 'text-blue-500' : 'text-slate-500'}`}>
          <div className={`${page === 'dashboard' ? 'bg-blue-500/10 p-2 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)]' : ''}`}>
            <Radio size={page === 'dashboard' ? 24 : 20} strokeWidth={page === 'dashboard' ? 3 : 2} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Live</span>
        </button>
        <button onClick={() => setPage('booked')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'booked' ? 'text-emerald-500' : 'text-slate-500'}`}>
          <div className={`${page === 'booked' ? 'bg-emerald-500/10 p-2 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)]' : ''}`}>
            <CheckCircle size={page === 'booked' ? 24 : 20} strokeWidth={page === 'booked' ? 3 : 2} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">History</span>
        </button>
        <button onClick={() => setPage('stats')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'stats' ? 'text-yellow-500' : 'text-slate-500'}`}>
          <div className={`${page === 'stats' ? 'bg-yellow-500/10 p-2 rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.2)]' : ''}`}>
            <BarChart2 size={page === 'stats' ? 24 : 20} strokeWidth={page === 'stats' ? 3 : 2} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Stats</span>
        </button>
      </div>
    </Layout>
  );
};

export default App;
