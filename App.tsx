
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
const MAJOR_ALERT_DURATION = 15000; // STRICT 15s Alert window

export type GranularHighlights = Record<string, Set<string>>;

// These keys trigger the 15s beep and card pulse (Broadcasting/Update/Price events)
const ALERT_TRIGGER_KEYS: Array<keyof TradeSignal> = [
  'instrument', 'symbol', 'type', 'action', 'entryPrice', 
  'stopLoss', 'targets', 'status', 'targetsHit', 'isBTST', 'trailingSL', 'cmp', 'comment'
];

// All keys that can cause a box to blink
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
  
  const [activeMajorAlerts, setActiveMajorAlerts] = useState<Record<string, number>>({});
  const [activeWatchlistAlerts, setActiveWatchlistAlerts] = useState<Record<string, number>>({});
  const [granularHighlights, setGranularHighlights] = useState<GranularHighlights>({});
  
  const prevSignalsRef = useRef<TradeSignal[]>([]);
  const prevWatchlistRef = useRef<WatchlistItem[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeOscillatorRef = useRef<OscillatorNode | null>(null);
  const activeGainRef = useRef<GainNode | null>(null);
  
  // Use ReturnType<typeof setTimeout> to avoid NodeJS namespace issues in browser environment
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const initAudio = () => {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    };
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const handleRedirectToCard = useCallback((id: string) => {
    setPage('dashboard');
    let attempts = 0;
    const scrollWithRetry = () => {
      const el = document.getElementById(`signal-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempts < 10) {
        attempts++;
        setTimeout(scrollWithRetry, 300);
      }
    };
    setTimeout(scrollWithRetry, 300);
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
    if (!soundEnabled) return;
    
    // Always clear existing alert before starting a new one to ensure fresh beep
    stopAlertAudio();

    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Frequency selection
      const baseFreq = isBTST ? 980 : (isCritical ? 440 : 880);
      osc.type = (isBTST || isCritical) ? 'square' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      
      // Create a pulsing effect (Beep-Beep-Beep) for 15s
      const pulseDuration = 0.8; 
      const totalPulses = Math.ceil(MAJOR_ALERT_DURATION / 1000 / pulseDuration);
      
      for (let i = 0; i < totalPulses; i++) {
        const startTime = ctx.currentTime + (i * pulseDuration);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.1);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.5);
        gain.gain.linearRampToValueAtTime(0, startTime + 0.7);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      
      activeOscillatorRef.current = osc;
      activeGainRef.current = gain;

      alertTimeoutRef.current = setTimeout(() => stopAlertAudio(), MAJOR_ALERT_DURATION);
    } catch (e) {
      console.error("Audio Playback Failed", e);
    }
  }, [soundEnabled, stopAlertAudio]);

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
        const nextMajor = { ...activeMajorAlerts };
        const nextWatch = { ...activeWatchlistAlerts };
        const nextHighs = { ...granularHighlights };

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
            // Check all keys for granular highlight and major audio trigger
            ALL_SIGNAL_KEYS.forEach(k => {
              if (JSON.stringify(s[k]) !== JSON.stringify(old[k])) {
                diff.add(k);
                // Any change in ALERT_TRIGGER_KEYS (includes CMP, instrument, letters, status) triggers the long beep
                if (ALERT_TRIGGER_KEYS.includes(k)) {
                   majorUpdateFound = anyChangeDetected = true;
                   if (k === 'status' && s.status === TradeStatus.STOPPED) isCriticalAlert = true;
                }
              }
            });
          }

          if (majorUpdateFound) {
            nextMajor[sid] = now + MAJOR_ALERT_DURATION;
            if (s.sheetIndex > topIndex) { topIndex = s.sheetIndex; targetSid = sid; }
            if (s.isBTST && (s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL)) isBTSTUpdate = true;
          }
          
          if (diff.size > 0) {
            nextHighs[sid] = diff;
            // Always ensure visual blink is active for 15s when field changes
            nextMajor[sid] = now + MAJOR_ALERT_DURATION;
          }
        });

        // Watchlist Update Check
        data.watchlist.forEach(w => {
          const old = prevWatchlistRef.current.find(o => o.symbol === w.symbol);
          if (old && !isInitial && Number(w.price) !== Number(old.price)) {
            anyChangeDetected = true;
            nextWatch[w.symbol] = now + MAJOR_ALERT_DURATION;
          }
        });

        // TRIGGER LONG BEEP IF ANY CHANGE (PRICE, LETTERS, STATUS, WATCHLIST)
        if (anyChangeDetected && !isInitial) {
          playLongBeep(isCriticalAlert, isBTSTUpdate);
          if (targetSid) handleRedirectToCard(targetSid);
        }

        setActiveMajorAlerts(nextMajor);
        setActiveWatchlistAlerts(nextWatch);
        setGranularHighlights(nextHighs);

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
  }, [playLongBeep, handleRedirectToCard, activeMajorAlerts, activeWatchlistAlerts, granularHighlights]);

  // Unified Cleanup Timer - Strict 15s to stop glows
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const nextMajor = { ...activeMajorAlerts };
      const nextWatch = { ...activeWatchlistAlerts };
      const nextHighs = { ...granularHighlights };

      Object.keys(nextMajor).forEach(key => {
        if (now >= nextMajor[key]) {
          delete nextMajor[key];
          delete nextHighs[key];
          changed = true;
        }
      });

      Object.keys(nextWatch).forEach(key => {
        if (now >= nextWatch[key]) {
          delete nextWatch[key];
          changed = true;
        }
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
    return () => clearInterval(poll);
  }, [sync]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('libra_sound_enabled', String(next));
    if (!next) stopAlertAudio();
  };

  if (!user) return <Login onLogin={(u) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, timestamp: Date.now() }));
    setUser(u);
    sync(true);
  }} />;

  return (
    <Layout user={user} onLogout={() => { localStorage.removeItem(SESSION_KEY); setUser(null); }} currentPage={page} onNavigate={setPage}>
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
