
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Stats from './pages/Stats';
import Rules from './pages/Rules';
import Admin from './pages/Admin';
import BookedTrades from './pages/BookedTrades';
import { User, WatchlistItem, TradeSignal, TradeStatus } from './types';
import { fetchSheetData, updateSheetData } from './services/googleSheetsService';
import { MOCK_WATCHLIST, MOCK_SIGNALS } from './constants';
import { Radio, CheckCircle, BarChart2, ShieldAlert, Volume2, VolumeX, RefreshCw, WifiOff, BellRing, MonitorPlay, Moon, Zap, MousePointer2 } from 'lucide-react';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; 
const SESSION_KEY = 'libra_user_session';
const POLL_INTERVAL = 8000; 
const HIGHLIGHT_DURATION = 15000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes to enter idle/standby

export type GranularHighlights = Record<string, Set<string>>;

const SIGNAL_KEYS: Array<keyof TradeSignal> = [
  'instrument', 'symbol', 'type', 'action', 'entryPrice', 
  'stopLoss', 'targets', 'trailingSL', 'status', 'pnlPoints', 'pnlRupees', 'comment', 'targetsHit'
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
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(MOCK_WATCHLIST);
  const [signals, setSignals] = useState<TradeSignal[]>(MOCK_SIGNALS);
  const [users, setUsers] = useState<User[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'syncing'>('connected');
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--:--');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('libra_sound_enabled') === 'true');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [granularHighlights, setGranularHighlights] = useState<GranularHighlights>({});
  
  // Standby & Wake States
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  
  const prevSignalsRef = useRef<TradeSignal[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);
  const wakeLockRef = useRef<any>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- IDLE DETECTION ---
  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsIdle(true), IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // --- WAKE LOCK LOGIC ---
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator) || !user) return;
    
    // Safety: Browser policy often denies WakeLock if tab is not visible or has no interaction
    if (document.visibilityState !== 'visible') return;

    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      setWakeLockActive(true);
      setWakeLockSupported(true);
      
      wakeLockRef.current.addEventListener('release', () => {
        setWakeLockActive(false);
        wakeLockRef.current = null;
      });
    } catch (err: any) {
      setWakeLockActive(false);
      // If disallowed by permissions policy, we stop trying to avoid console flooding
      if (err.name === 'NotAllowedError') {
        setWakeLockSupported(false);
      }
    }
  }, [user]);

  useEffect(() => {
    const handleVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      setIsMinimized(hidden);
      if (!hidden && user) requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, requestWakeLock]);

  // --- NOTIFICATION LOGIC ---
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') await requestWakeLock();
      return permission;
    }
    return 'denied';
  }, [requestWakeLock]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const sendPushNotification = useCallback((title: string, body: string) => {
    if (notificationPermission === 'granted' && (document.hidden || isIdle)) {
      const n = new Notification(title, {
        body: body + " - Click to return to Terminal",
        silent: !soundEnabled,
        icon: 'https://cdn-icons-png.flaticon.com/512/2533/2533475.png',
        tag: 'libra-alert',
        requireInteraction: true 
      });
      n.onclick = () => { window.focus(); n.close(); };
    }
  }, [notificationPermission, soundEnabled, isIdle]);

  const playAlert = useCallback((isCritical = false) => {
    if (!soundEnabled) return;
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
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {}
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
        let alertMessage = "Terminal Update Detected";
        const currentHighlights: GranularHighlights = {};

        if (!isInitial && prevSignalsRef.current.length > 0) {
          data.signals.forEach(s => {
            const sid = s.id;
            const old = prevSignalsRef.current.find(o => o.id === sid);
            const diff = new Set<string>();
            
            if (!old) {
              SIGNAL_KEYS.forEach(k => diff.add(k));
              alertMessage = `NEW: ${s.instrument} ${s.symbol} ${s.action}`;
            } else {
              SIGNAL_KEYS.forEach(k => {
                if (JSON.stringify(s[k]) !== JSON.stringify(old[k])) {
                  diff.add(k);
                  if (k === 'status' && s.status === TradeStatus.STOPPED) isCriticalAlert = true;
                }
              });
            }
            if (diff.size > 0) { 
              currentHighlights[sid] = diff; 
              hasAnyChanges = true; 
            }
          });

          if (hasAnyChanges) {
            playAlert(isCriticalAlert);
            sendPushNotification("LibraQuant Alert", alertMessage);
            setGranularHighlights(currentHighlights);
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = setTimeout(() => setGranularHighlights({}), HIGHLIGHT_DURATION);
            setPage('dashboard');
          }
        }

        setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
        prevSignalsRef.current = [...data.signals];
        setSignals([...data.signals]);
        setWatchlist([...data.watchlist]);
        setUsers([...data.users]);
        setConnectionStatus('connected');
      }
    } catch (err: any) {
      setConnectionStatus('error');
    } finally {
      isFetchingRef.current = false;
    }
  }, [playAlert, sendPushNotification]);

  const handleSignalUpdate = useCallback(async (updatedSignal: TradeSignal) => {
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', updatedSignal, updatedSignal.id);
    if (success) {
      setSignals(prev => prev.map(s => s.id === updatedSignal.id ? updatedSignal : s));
      prevSignalsRef.current = prevSignalsRef.current.map(s => s.id === updatedSignal.id ? updatedSignal : s);
    }
    return success;
  }, []);

  useEffect(() => {
    sync(true);
    const timer = setInterval(() => sync(false), POLL_INTERVAL);
    if (user) requestWakeLock();
    return () => clearInterval(timer);
  }, [sync, user, requestWakeLock]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('libra_sound_enabled', String(next));
    if (next) {
      playAlert();
      requestNotificationPermission();
    }
  };

  if (!user) return <Login onLogin={(u) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, timestamp: Date.now() }));
    setUser(u);
    sync(true);
  }} />;

  const showStandby = isMinimized || isIdle;

  return (
    <Layout user={user} onLogout={() => { setUser(null); localStorage.removeItem(SESSION_KEY); }} currentPage={page} onNavigate={setPage}>
      {/* --- STANDBY / MINIMIZED OVERLAY --- */}
      {showStandby && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="relative p-6 bg-slate-900 border border-slate-800 rounded-full shadow-2xl">
              {isMinimized ? <Moon size={48} className="text-blue-500 animate-bounce" /> : <MousePointer2 size={48} className="text-emerald-500 animate-pulse" />}
            </div>
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
            {isMinimized ? 'System Minimized' : 'Standby Mode'}
          </h2>
          <p className="text-slate-400 max-w-xs text-sm font-mono uppercase tracking-widest leading-relaxed">
            Live sync active. Background workers monitoring market {POLL_INTERVAL/1000}s. 
            <br/><span className="text-blue-400">Click to resume dashboard.</span>
          </p>
          <div className="mt-8 flex items-center space-x-3 bg-slate-900/50 border border-slate-800 px-4 py-2 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Live Sync: {lastSyncTime}</span>
          </div>
          <button onClick={() => { setIsIdle(false); setIsMinimized(false); }} className="absolute inset-0 w-full h-full cursor-pointer" aria-label="Resume"></button>
        </div>
      )}

      {/* --- UI CONTROLS --- */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col items-end space-y-3">
        <div className={`bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] font-bold border shadow-2xl transition-all flex items-center ${connectionStatus === 'error' ? 'border-rose-500' : 'border-slate-800'}`}>
          <div className="flex flex-col items-start mr-3">
              <span className="text-[9px] text-slate-500 uppercase tracking-tighter leading-none mb-1">Server Status</span>
              <div className="flex items-center">
                 <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connectionStatus === 'syncing' ? 'bg-blue-400 animate-pulse' : connectionStatus === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                 <span className="text-white font-mono">{lastSyncTime}</span>
              </div>
          </div>
          <button onClick={() => sync(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white">
             <RefreshCw size={14} className={connectionStatus === 'syncing' ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex flex-col items-end space-y-2">
          {wakeLockActive && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center text-emerald-400 text-[9px] font-black uppercase tracking-widest shadow-lg">
                <Zap size={12} className="mr-2 animate-pulse" />
                Standby Prevented
            </div>
          )}
          {!wakeLockActive && wakeLockSupported && (
            <button onClick={requestWakeLock} className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center text-slate-400 text-[9px] font-bold hover:text-white transition-all">
              <MonitorPlay size={12} className="mr-2" />
              Request Wake Lock
            </button>
          )}
          {notificationPermission !== 'granted' && (
             <button onClick={requestNotificationPermission} className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg shadow-xl flex items-center">
                <BellRing size={12} className="mr-2" />
                Enable Alerts
             </button>
          )}
          <button onClick={toggleSound} className={`p-4 rounded-full border shadow-2xl transition-all ${soundEnabled ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
            {soundEnabled ? <Volume2 size={32} /> : <VolumeX size={32} />}
          </button>
        </div>
      </div>

      {page === 'dashboard' && <Dashboard watchlist={watchlist} signals={signals} user={user} granularHighlights={granularHighlights} onSignalUpdate={handleSignalUpdate} />}
      {page === 'booked' && <BookedTrades signals={signals} user={user} granularHighlights={granularHighlights} onSignalUpdate={handleSignalUpdate} />}
      {page === 'stats' && <Stats signals={signals} />}
      {page === 'rules' && <Rules />}
      {user?.isAdmin && page === 'admin' && <Admin watchlist={watchlist} onUpdateWatchlist={setWatchlist} signals={signals} onUpdateSignals={setSignals} users={users} onUpdateUsers={setUsers} onNavigate={setPage} />}
    </Layout>
  );
};

export default App;
