
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
import { Radio, CheckCircle, BarChart2, ShieldAlert, Volume2, VolumeX, RefreshCw, WifiOff, Database, Zap } from 'lucide-react';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; 
const SESSION_KEY = 'libra_user_session';
const POLL_INTERVAL = 8000; 
const MAJOR_ALERT_DURATION = 15000; // STRICT 15s Alert window

export type GranularHighlights = Record<string, Set<string>>;

const ALERT_TRIGGER_KEYS: Array<keyof TradeSignal> = [
  'instrument', 'symbol', 'type', 'action', 'entryPrice', 
  'stopLoss', 'targets', 'status', 'targetsHit', 'isBTST', 'trailingSL', 'cmp', 'comment'
];

const ALL_SIGNAL_KEYS: Array<keyof TradeSignal> = [
  ...ALERT_TRIGGER_KEYS, 'pnlPoints', 'pnlRupees', 'quantity'
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
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  const [activeMajorAlerts, setActiveMajorAlerts] = useState<Record<string, number>>({});
  const [activeWatchlistAlerts, setActiveWatchlistAlerts] = useState<Record<string, number>>({});
  const [granularHighlights, setGranularHighlights] = useState<GranularHighlights>({});
  
  const prevSignalsRef = useRef<TradeSignal[]>([]);
  const prevWatchlistRef = useRef<WatchlistItem[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeOscillatorRef = useRef<OscillatorNode | null>(null);
  const activeGainRef = useRef<GainNode | null>(null);
  
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);

  const initAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      setAudioInitialized(true);
    } catch (e) {
      console.error("Audio init failed", e);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, [initAudio]);

  const handleRedirectToCard = useCallback((id: string) => {
    setPage('dashboard');
    const scrollTask = () => {
      const el = document.getElementById(`signal-${id}`);
      const container = document.getElementById('app-main-container');
      if (el && container) {
        const offset = 80; 
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + container.scrollTop - offset;
        container.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    };
    setTimeout(scrollTask, 350);
  }, []);

  const stopAlertAudio = useCallback(() => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }
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
  }, []);

  const playLongBeep = useCallback((isCritical = false, isBTST = false) => {
    if (!soundEnabled || !audioInitialized) return;
    
    stopAlertAudio();

    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const baseFreq = isBTST ? 980 : (isCritical ? 440 : 880);
      osc.type = (isBTST || isCritical) ? 'square' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      
      // Pattern: Two Long Beeps of 5 seconds each
      // Total timeline: 0s-5s (Beep 1) -> 5s-7.5s (Silence) -> 7.5s-12.5s (Beep 2) -> 12.5s-15s (Silence)
      const now = ctx.currentTime;
      
      // First Beep: 0s to 5.0s
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.1); 
      gain.gain.setValueAtTime(0.15, now + 4.9);
      gain.gain.linearRampToValueAtTime(0, now + 5.0); 
      
      // Second Beep: 7.5s to 12.5s
      const secondStart = now + 7.5;
      gain.gain.setValueAtTime(0, secondStart);
      gain.gain.linearRampToValueAtTime(0.15, secondStart + 0.1); 
      gain.gain.setValueAtTime(0.15, secondStart + 4.9);
      gain.gain.linearRampToValueAtTime(0, secondStart + 5.0); 

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      
      activeOscillatorRef.current = osc;
      activeGainRef.current = gain;

      alertTimeoutRef.current = setTimeout(() => stopAlertAudio(), MAJOR_ALERT_DURATION);
    } catch (e) {
      console.error("Audio Playback Failed", e);
    }
  }, [soundEnabled, audioInitialized, stopAlertAudio]);

  const sync = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setConnectionStatus('syncing');
    
    try {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      
      const data = await fetchSheetData();
      if (data) {
        let anyChangeDetected = false;
        let isCriticalAlert = false;
        let isBTSTUpdate = false;
        let targetSid: string | null = null;
        let topIndex = -1;
        
        const now = Date.now();
        const expirationTime = now + MAJOR_ALERT_DURATION;

        setActiveMajorAlerts(prevMajor => {
          const nextMajor = { ...prevMajor };
          setActiveWatchlistAlerts(prevWatch => {
            const nextWatch = { ...prevWatch };
            setGranularHighlights(prevHighs => {
              const nextHighs = { ...prevHighs };

              data.signals.forEach(s => {
                const sid = s.id;
                const old = prevSignalsRef.current.find(o => o.id === sid);
                const diff = new Set<string>();
                let majorUpdateFound = false;

                if (!old) {
                  if (!isInitial && prevSignalsRef.current.length > 0) {
                    ALL_SIGNAL_KEYS.forEach(k => diff.add(k));
                    majorUpdateFound = anyChangeDetected = true;
                  }
                } else {
                  ALL_SIGNAL_KEYS.forEach(k => {
                    if (JSON.stringify(s[k]) !== JSON.stringify(old[k])) {
                      diff.add(k);
                      if (ALERT_TRIGGER_KEYS.includes(k)) {
                         majorUpdateFound = anyChangeDetected = true;
                         if (k === 'status' && s.status === TradeStatus.STOPPED) isCriticalAlert = true;
                      }
                    }
                  });
                }

                if (majorUpdateFound) {
                  nextMajor[sid] = expirationTime;
                  if (s.sheetIndex > topIndex) { topIndex = s.sheetIndex; targetSid = sid; }
                  if (s.isBTST && (s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL)) isBTSTUpdate = true;
                }
                
                if (diff.size > 0) {
                  nextHighs[sid] = diff;
                  nextMajor[sid] = expirationTime;
                }
              });

              data.watchlist.forEach(w => {
                const old = prevWatchlistRef.current.find(o => o.symbol === w.symbol);
                if (old && !isInitial && Number(w.price) !== Number(old.price)) {
                  anyChangeDetected = true;
                  nextWatch[w.symbol] = expirationTime;
                }
              });

              return nextHighs;
            });
            return nextWatch;
          });
          return nextMajor;
        });

        if (anyChangeDetected && !isInitial) {
          playLongBeep(isCriticalAlert, isBTSTUpdate);
          if (targetSid) handleRedirectToCard(targetSid);
        }

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
    } catch (err) {
      setConnectionStatus('error');
    } finally {
      isFetchingRef.current = false;
    }
  }, [playLongBeep, handleRedirectToCard]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      
      // Functional state updates are critical to avoid race conditions and stale closures
      setActiveMajorAlerts(prev => {
        const next = { ...prev };
        let majorChanged = false;
        
        Object.keys(next).forEach(key => {
          if (now >= next[key]) {
            delete next[key];
            majorChanged = true;
          }
        });

        if (majorChanged) {
          // Sync clearing of granular highlights with major alerts
          setGranularHighlights(prevHighs => {
            const nextHighs = { ...prevHighs };
            Object.keys(prev).forEach(key => {
              if (now >= prev[key]) delete nextHighs[key];
            });
            return nextHighs;
          });
          return next;
        }
        return prev;
      });

      setActiveWatchlistAlerts(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(key => {
          if (now >= next[key]) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });

    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    sync(true);
    const poll = setInterval(() => sync(false), POLL_INTERVAL);
    
    const handleVisibility = () => { if (!document.hidden) sync(false); };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [sync]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('libra_sound_enabled', String(next));
    if (!next) stopAlertAudio();
    if (next && !audioInitialized) initAudio();
  };

  if (!user) return <Login onLogin={(u) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, timestamp: Date.now() }));
    setUser(u);
    sync(true);
  }} />;

  return (
    <Layout user={user} onLogout={() => { localStorage.removeItem(SESSION_KEY); setUser(null); }} currentPage={page} onNavigate={setPage}>
      
      {user && !audioInitialized && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white mb-6 animate-pulse shadow-[0_0_40px_rgba(37,99,235,0.4)]">
            <Zap size={40} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Initialize Terminal</h2>
          <p className="text-slate-400 text-sm mb-8 max-w-xs">Tap below to activate real-time institutional alerts and secure audio stream.</p>
          <button 
            onClick={initAudio} 
            className="w-full max-w-xs bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-900/40 uppercase tracking-[0.2em] text-xs transition-all active:scale-95"
          >
            Activate Live Feed
          </button>
        </div>
      )}

      <div className="fixed top-4 right-4 z-[100] flex flex-col items-end space-y-3">
        <div className={`bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] font-bold border shadow-2xl flex items-center ${connectionStatus === 'error' ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800'}`}>
          <div className="flex flex-col items-start mr-3">
              <span className="text-[9px] text-slate-500 uppercase tracking-tighter leading-none mb-1">Terminal Link</span>
              <div className="flex items-center">
                 <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connectionStatus === 'syncing' ? 'bg-blue-400 animate-pulse' : connectionStatus === 'error' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></div>
                 <span className={`${connectionStatus === 'error' ? 'text-rose-400' : 'text-white'} font-mono`}>{lastSyncTime}</span>
              </div>
          </div>
          <button onClick={() => sync(true)} className="p-1.5 rounded-lg bg-slate-800 text-blue-400 border border-blue-500/20"><Database size={14} /></button>
        </div>
        <button onClick={toggleSound} className={`p-4 rounded-full border shadow-2xl transition-all active:scale-90 ${soundEnabled ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-cyan-500/10' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
          {soundEnabled ? <Volume2 size={32} /> : <VolumeX size={32} />}
        </button>
      </div>

      {page === 'dashboard' && <Dashboard watchlist={watchlist} signals={signals} user={user} granularHighlights={granularHighlights} activeMajorAlerts={activeMajorAlerts} activeWatchlistAlerts={activeWatchlistAlerts} onSignalUpdate={sync} />}
      {page === 'booked' && <BookedTrades signals={signals} historySignals={historySignals} user={user} granularHighlights={granularHighlights} onSignalUpdate={sync} />}
      {page === 'stats' && <Stats signals={signals} historySignals={historySignals} />}
      {page === 'rules' && <Rules />}
      {user?.isAdmin && page === 'admin' && <Admin watchlist={watchlist} onUpdateWatchlist={() => {}} signals={signals} onUpdateSignals={() => {}} users={users} onUpdateUsers={() => {}} logs={logs} onNavigate={setPage} onHardSync={() => sync(true)} />}

      <div className="md:hidden fixed bottom-4 left-4 right-4 z-[100] bg-slate-900/90 backdrop-blur-xl border border-slate-800 px-6 py-4 flex justify-around items-center rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <button onClick={() => setPage('dashboard')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'dashboard' ? 'text-blue-500' : 'text-slate-500'}`}>
          <Radio size={24} strokeWidth={page === 'dashboard' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Live</span>
        </button>
        <button onClick={() => setPage('booked')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'booked' ? 'text-emerald-500' : 'text-slate-500'}`}>
          <CheckCircle size={24} strokeWidth={page === 'booked' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Booked</span>
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
