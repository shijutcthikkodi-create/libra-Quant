
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
import { Radio, CheckCircle, BarChart2, ShieldAlert, Volume2, VolumeX, RefreshCw, WifiOff, Database, BellRing, ChevronRight, Zap } from 'lucide-react';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; 
const SESSION_KEY = 'libra_user_session';
const POLL_INTERVAL = 8000; 
const HIGHLIGHT_DURATION = 20000; // 20 Seconds

export type GranularHighlights = Record<string, Set<string>>;

const SIGNAL_KEYS: Array<keyof TradeSignal> = [
  'instrument', 'symbol', 'type', 'action', 'entryPrice', 
  'stopLoss', 'targets', 'trailingSL', 'status', 'pnlPoints', 'pnlRupees', 'comment', 'targetsHit',
  'quantity', 'cmp', 'isBTST'
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
  const [granularHighlights, setGranularHighlights] = useState<GranularHighlights>({});
  const [lastChangedId, setLastChangedId] = useState<string | null>(null);
  
  const prevSignalsRef = useRef<TradeSignal[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  // 20-Second Institutional Alert Pattern
  const playAlertSequence = useCallback((isCritical = false) => {
    if (!soundEnabled) return;
    if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);

    const playBeep = () => {
      try {
        const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isCritical ? 'square' : 'sine';
        osc.frequency.setValueAtTime(isCritical ? 440 : 880, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch (e) {}
    };

    playBeep();
    // Repeating beep pattern for 20 seconds
    const interval = setInterval(playBeep, 2000);
    beepIntervalRef.current = interval;
    setTimeout(() => {
      if (beepIntervalRef.current === interval) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    }, HIGHLIGHT_DURATION);
  }, [soundEnabled]);

  const sync = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setConnectionStatus('syncing');
    
    try {
      const data = await fetchSheetData();
      if (data) {
        let hasAnyChanges = false;
        let isCriticalAlert = false;
        let changedId: string | null = null;
        const currentHighlights: GranularHighlights = {};

        const diffSignals = (current: TradeSignal[], previous: TradeSignal[]) => {
          current.forEach(s => {
            const sid = s.id;
            const old = previous.find(o => o.id === sid);
            const diff = new Set<string>();
            
            if (!old) {
              if (!isInitial && previous.length > 0) {
                SIGNAL_KEYS.forEach(k => diff.add(k));
                changedId = sid;
              }
            } else {
              SIGNAL_KEYS.forEach(k => {
                const newVal = JSON.stringify(s[k]);
                const oldVal = JSON.stringify(old[k]);
                if (newVal !== oldVal) {
                  diff.add(k);
                  changedId = sid;
                  if (k === 'targetsHit' && (s.targetsHit || 0) > (old.targetsHit || 0)) diff.add('blast'); 
                  if (k === 'status' && s.status === TradeStatus.STOPPED && old.status !== TradeStatus.STOPPED) {
                    isCriticalAlert = true;
                    diff.add('blast-red');
                  }
                }
              });
            }
            if (diff.size > 0) { 
              currentHighlights[sid] = diff; 
              hasAnyChanges = true; 
            }
          });
        };

        if (!isInitial) {
          diffSignals(data.signals, prevSignalsRef.current);
        }

        if (hasAnyChanges) {
          playAlertSequence(isCriticalAlert);
          if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
          setGranularHighlights(currentHighlights);
          setLastChangedId(changedId);
          highlightTimeoutRef.current = setTimeout(() => {
            setGranularHighlights({});
            setLastChangedId(null);
          }, HIGHLIGHT_DURATION);
        }

        const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(nowStr);
        prevSignalsRef.current = [...data.signals];
        setSignals([...data.signals]);
        setHistorySignals([...(data.history || [])]);
        setWatchlist([...data.watchlist]);
        setUsers([...data.users]);
        setLogs([...(data.logs || [])]);
        setMessages([...(data.messages || [])]);
        setConnectionStatus('connected');
      }
    } catch (err: any) {
      setConnectionStatus('error');
    } finally {
      isFetchingRef.current = false;
    }
  }, [playAlertSequence]);

  const handleRedirectToCard = useCallback((id: string) => {
    setPage('dashboard');
    setTimeout(() => {
      const el = document.getElementById(`signal-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, []);

  const handleHardSync = useCallback(async () => {
    prevSignalsRef.current = [];
    setSignals([]);
    await sync(true);
  }, [sync]);

  useEffect(() => {
    sync(true);
    const timer = setInterval(() => sync(false), POLL_INTERVAL);
    return () => {
      clearInterval(timer);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
    };
  }, [sync]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('libra_sound_enabled', String(next));
    if (next) playAlertSequence();
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const lastSignal = signals.find(s => s.id === lastChangedId);

  if (!user) return <Login onLogin={(u) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, timestamp: Date.now() }));
    setUser(u);
    sync(true);
  }} />;

  return (
    <Layout user={user} onLogout={logout} currentPage={page} onNavigate={setPage}>
      
      {/* PERSISTENT REDIRECTION TOAST (20 SECONDS) */}
      {lastChangedId && lastSignal && (
        <div 
          onClick={() => handleRedirectToCard(lastChangedId)}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 backdrop-blur-2xl border-2 border-cyan-500/50 px-6 py-4 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.3)] cursor-pointer flex items-center space-x-5 animate-in slide-in-from-top-6 duration-500 hover:scale-105 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 animate-pulse border border-cyan-500/30">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] leading-none mb-1.5 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mr-2 animate-ping"></span>
              Live Data Refresh
            </p>
            <p className="text-base font-bold text-white uppercase tracking-tighter">
              {lastSignal.instrument} {lastSignal.symbol} <span className="text-slate-500 text-xs ml-2 font-mono">Book Profit?</span>
            </p>
          </div>
          <div className="pl-6 border-l border-slate-800 flex items-center">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2 group-hover:text-cyan-400 transition-colors">Jump</span>
             <ChevronRight className="text-slate-600 group-hover:text-white transition-all transform group-hover:translate-x-1" size={24} />
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 z-[60] flex flex-col items-end space-y-3">
        <div className={`bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] font-bold border shadow-2xl transition-all duration-500 flex items-center ${connectionStatus === 'error' ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800'}`}>
          <div className="flex flex-col items-start mr-3">
              <span className="text-[9px] text-slate-500 uppercase tracking-tighter leading-none mb-1">Server Status</span>
              <div className="flex items-center">
                 <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connectionStatus === 'syncing' ? 'bg-blue-400 animate-pulse' : connectionStatus === 'error' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></div>
                 <span className={`${connectionStatus === 'error' ? 'text-rose-400' : 'text-white'} font-mono`}>{lastSyncTime}</span>
              </div>
          </div>
          <div className="flex space-x-1">
            <button onClick={handleHardSync} title="Hard Sync" className="p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-blue-500/10 transition-all border border-blue-500/20">
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

      {page === 'dashboard' && <Dashboard watchlist={watchlist} signals={signals} user={user} granularHighlights={granularHighlights} onSignalUpdate={sync} />}
      {page === 'booked' && <BookedTrades signals={signals} user={user} granularHighlights={granularHighlights} onSignalUpdate={sync} />}
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
