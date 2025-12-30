
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
const MAJOR_ALERT_DURATION = 15000; // STRICT 15s for beep and blink

export type GranularHighlights = Record<string, Set<string>>;

const SIGNAL_KEYS: Array<keyof TradeSignal> = [
  'instrument', 'symbol', 'type', 'action', 'entryPrice', 
  'stopLoss', 'targets', 'trailingSL', 'status', 'pnlPoints', 'pnlRupees', 'comment', 'targetsHit',
  'quantity', 'cmp', 'isBTST'
];

const MAJOR_ALERT_KEYS: Array<keyof TradeSignal> = [
  'status', 'targetsHit', 'stopLoss', 'trailingSL', 'entryPrice', 'isBTST', 'action', 'instrument', 'comment'
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
  const activeOscillatorRef = useRef<OscillatorNode | null>(null);
  const activeGainRef = useRef<GainNode | null>(null);
  const isFetchingRef = useRef(false);
  const isAlertingRef = useRef(false);

  // Audio Context Setup with User Interaction Handling
  useEffect(() => {
    const resume = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener('mousedown', resume, { once: true });
    window.addEventListener('touchstart', resume, { once: true });
    return () => {
      window.removeEventListener('mousedown', resume);
      window.removeEventListener('touchstart', resume);
    };
  }, []);

  const handleRedirectToCard = useCallback((id: string) => {
    setPage('dashboard');
    let attempts = 0;
    const scrollWithRetry = () => {
      const el = document.getElementById(`signal-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('animate-card-pulse', 'focus-indicator');
        setTimeout(() => el.classList.remove('focus-indicator'), 5000);
      } else if (attempts < 20) {
        attempts++;
        setTimeout(scrollWithRetry, 150);
      }
    };
    setTimeout(scrollWithRetry, 100);
  }, []);

  const stopAlertAudio = useCallback(() => {
    if (activeOscillatorRef.current) {
      try {
        activeOscillatorRef.current.stop();
        activeOscillatorRef.current.disconnect();
      } catch (e) {}
      activeOscillatorRef.current = null;
    }
    if (activeGainRef.current) {
      try { activeGainRef.current.disconnect(); } catch (e) {}
      activeGainRef.current = null;
    }
    isAlertingRef.current = false;
  }, []);

  const playLongBeep = useCallback((isCritical = false, isBTST = false, isWatchlist = false) => {
    if (!soundEnabled || isAlertingRef.current) return;
    
    isAlertingRef.current = true;
    
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Select institutional frequency base
      const baseFreq = isBTST ? 1100 : (isCritical ? 400 : (isWatchlist ? 1200 : 900));
      osc.type = (isBTST || isCritical) ? 'square' : 'sine';
      
      // Institutional "Warble" / Pulse Effect for the long 15s beep
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      
      // Create a pulsating intensity for the 15s
      for (let i = 0; i < MAJOR_ALERT_DURATION / 1000; i++) {
        const time = ctx.currentTime + i;
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.05, time + 0.2);
        osc.frequency.exponentialRampToValueAtTime(baseFreq, time + 0.4);
        
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.linearRampToValueAtTime(0.05, time + 0.3);
        gain.gain.linearRampToValueAtTime(0.15, time + 0.5);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      activeOscillatorRef.current = osc;
      activeGainRef.current = gain;

      // STRICT 15s AUTO-STOP
      setTimeout(() => {
        stopAlertAudio();
      }, MAJOR_ALERT_DURATION);

    } catch (e) {
      console.error("Audio engine failure", e);
      isAlertingRef.current = false;
    }
  }, [soundEnabled, stopAlertAudio]);

  const sync = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setConnectionStatus('syncing');
    
    try {
      const data = await fetchSheetData();
      if (data) {
        let shouldTriggerAlert = false;
        let isCriticalAlert = false;
        let isBTSTUpdate = false;
        let isWatchlistChange = false;
        let scrollTargetId: string | null = null;
        
        const now = Date.now();
        const newMajorAlerts: Record<string, number> = { ...activeMajorAlerts };
        const newWatchlistAlerts: Record<string, number> = { ...activeWatchlistAlerts };
        const newHighlights: GranularHighlights = { ...granularHighlights };

        // 1. SIGNAL ANALYSIS
        data.signals.forEach(s => {
          const sid = s.id;
          const old = prevSignalsRef.current.find(o => o.id === sid);
          const diff = new Set<string>();
          const isActive = s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL;

          if (!old) {
            if (!isInitial && prevSignalsRef.current.length > 0) {
              SIGNAL_KEYS.forEach(k => diff.add(k));
              scrollTargetId = sid;
              shouldTriggerAlert = true;
              newMajorAlerts[sid] = now + MAJOR_ALERT_DURATION;
              if (s.isBTST && isActive) isBTSTUpdate = true;
            }
          } else {
            let cardHasMajorUpdate = false;
            SIGNAL_KEYS.forEach(k => {
              if (JSON.stringify(s[k]) !== JSON.stringify(old[k])) {
                diff.add(k);
                if (MAJOR_ALERT_KEYS.includes(k)) {
                  cardHasMajorUpdate = true;
                  shouldTriggerAlert = true;
                  scrollTargetId = sid;
                }
                if (k === 'status' && s.status === TradeStatus.STOPPED) isCriticalAlert = true;
                if (s.isBTST && isActive && MAJOR_ALERT_KEYS.includes(k)) isBTSTUpdate = true;
              }
            });
            if (cardHasMajorUpdate) newMajorAlerts[sid] = now + MAJOR_ALERT_DURATION;
          }
          if (diff.size > 0) newHighlights[sid] = diff;
        });

        // 2. WATCHLIST ANALYSIS
        data.watchlist.forEach(w => {
          const old = prevWatchlistRef.current.find(o => o.symbol === w.symbol);
          if (old && !isInitial) {
            if (Number(w.price) !== Number(old.price) || Number(w.change) !== Number(old.change)) {
              isWatchlistChange = true;
              shouldTriggerAlert = true;
              newWatchlistAlerts[w.symbol] = now + MAJOR_ALERT_DURATION;
            }
          }
        });

        // 3. TRIGGER OUTPUTS
        if (shouldTriggerAlert) {
          playLongBeep(isCriticalAlert, isBTSTUpdate, isWatchlistChange);
          if (scrollTargetId) handleRedirectToCard(scrollTargetId);
        }

        setActiveMajorAlerts(newMajorAlerts);
        setActiveWatchlistAlerts(newWatchlistAlerts);
        setGranularHighlights(newHighlights);

        setLastSyncTime(new Date().toLocaleTimeString('en-IN'));
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
      setConnectionStatus('error');
    } finally {
      isFetchingRef.current = false;
    }
  }, [playLongBeep, handleRedirectToCard, activeMajorAlerts, activeWatchlistAlerts, granularHighlights]);

  // Alert State Management (Removal after 15s)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const nextMajor = { ...activeMajorAlerts };
      const nextWatch = { ...activeWatchlistAlerts };
      const nextHighs = { ...granularHighlights };

      [nextMajor, nextWatch].forEach(obj => {
        Object.keys(obj).forEach(key => {
          if (now > obj[key]) {
            delete obj[key];
            delete nextHighs[key];
            changed = true;
          }
        });
      });

      if (changed) {
        setActiveMajorAlerts(nextMajor);
        setActiveWatchlistAlerts(nextWatch);
        setGranularHighlights(nextHighs);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeMajorAlerts, activeWatchlistAlerts, granularHighlights]);

  useEffect(() => {
    sync(true);
    const poll = setInterval(() => sync(false), POLL_INTERVAL);
    return () => {
      clearInterval(poll);
      stopAlertAudio();
    };
  }, [sync, stopAlertAudio]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('libra_sound_enabled', String(next));
    if (!next) stopAlertAudio();
    else {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      playLongBeep(false, false, false);
      setTimeout(stopAlertAudio, 1000); // Quick test beep
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    stopAlertAudio();
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
              <span className="text-[9px] text-slate-500 uppercase tracking-tighter leading-none mb-1">Terminal Link</span>
              <div className="flex items-center">
                 <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connectionStatus === 'syncing' ? 'bg-blue-400 animate-pulse' : connectionStatus === 'error' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></div>
                 <span className={`${connectionStatus === 'error' ? 'text-rose-400' : 'text-white'} font-mono`}>{lastSyncTime}</span>
              </div>
          </div>
          <div className="flex space-x-1">
            <button onClick={() => sync(true)} title="Sync" className="p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-blue-500/10 transition-all border border-blue-500/20">
                <Database size={14} />
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
      {user?.isAdmin && page === 'admin' && <Admin watchlist={watchlist} onUpdateWatchlist={() => {}} signals={signals} onUpdateSignals={() => {}} users={users} onUpdateUsers={() => {}} logs={logs} onNavigate={setPage} onHardSync={() => sync(true)} />}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 px-6 py-3 flex justify-around items-center">
        <button onClick={() => setPage('dashboard')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'dashboard' ? 'text-blue-500' : 'text-slate-500'}`}>
          <Radio size={24} strokeWidth={page === 'dashboard' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Live</span>
        </button>
        <button onClick={() => setPage('booked')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'booked' ? 'text-emerald-500' : 'text-slate-500'}`}>
          <CheckCircle size={24} strokeWidth={page === 'booked' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">History</span>
        </button>
        <button onClick={() => setPage('stats')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'stats' ? 'text-yellow-500' : 'text-slate-500'}`}>
          <BarChart2 size={24} strokeWidth={page === 'stats' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Stats</span>
        </button>
      </div>
    </Layout>
  );
};

export default App;
