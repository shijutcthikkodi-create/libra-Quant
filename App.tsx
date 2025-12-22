
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
import { Radio, CheckCircle, BarChart2, ShieldAlert, Volume2, VolumeX, RefreshCw, WifiOff, BellRing, MonitorPlay } from 'lucide-react';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; 
const SESSION_KEY = 'libra_user_session';
const POLL_INTERVAL = 8000; 
const HIGHLIGHT_DURATION = 15000;

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
  const [wakeLockActive, setWakeLockActive] = useState(false);
  
  const prevSignalsRef = useRef<TradeSignal[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);
  const wakeLockRef = useRef<any>(null);

  // --- WAKE LOCK LOGIC (Prevents Standby) ---
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && user) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Wake Lock failed:', err);
      }
    }
  }, [user]);

  // Re-request wake lock when app becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [requestWakeLock]);

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

  const sendPushNotification = useCallback((title: string, body: string, isCritical = false) => {
    if (notificationPermission === 'granted') {
      const n = new Notification(title, {
        body: body + " - Click to open terminal",
        silent: !soundEnabled,
        icon: 'https://cdn-icons-png.flaticon.com/512/2533/2533475.png',
        tag: 'libra-alert',
        requireInteraction: true // Keeps notification visible until user acts
      });
      
      n.onclick = () => {
        window.focus();
        if (window.parent) window.parent.focus();
        n.close();
      };
    }
  }, [notificationPermission, soundEnabled]);

  const playLongBeep = useCallback((isCritical = false) => {
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
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + (isCritical ? 1.2 : 0.7));
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (isCritical ? 1.3 : 0.8));
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (isCritical ? 1.3 : 0.8));
    } catch (e) { }
  }, [soundEnabled]);

  const sync = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setConnectionStatus('syncing');
    
    try {
      const data = await fetchSheetData();
      if (data) {
        let hasAnyChanges = false;
        let hasSignalChanges = false;
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
              alertMessage = `NEW SIGNAL: ${s.instrument} ${s.symbol} ${s.action}`;
            } else {
              SIGNAL_KEYS.forEach(k => {
                const newVal = JSON.stringify(s[k]);
                const oldVal = JSON.stringify(old[k]);
                if (newVal !== oldVal) {
                  diff.add(k);
                  if (k === 'status') {
                    alertMessage = `${s.instrument} Status: ${s.status}`;
                  }
                  if (k === 'targetsHit' && (s.targetsHit || 0) > (old.targetsHit || 0)) {
                    diff.add('blast'); 
                    alertMessage = `${s.instrument} Target ${s.targetsHit} Done!`;
                  }
                  if (k === 'status' && s.status === TradeStatus.STOPPED && old.status !== TradeStatus.STOPPED) {
                    isCriticalAlert = true;
                    diff.add('blast-red');
                    alertMessage = `CRITICAL: ${s.instrument} SL HIT!`;
                  }
                }
              });
            }
            if (diff.size > 0) { 
              currentHighlights[sid] = diff; 
              hasAnyChanges = true; 
              hasSignalChanges = true; 
            }
          });

          if (hasAnyChanges) {
            playLongBeep(isCriticalAlert);
            sendPushNotification("LibraQuant Alert", alertMessage, isCriticalAlert);
            
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
            setGranularHighlights(currentHighlights);
            highlightTimeoutRef.current = setTimeout(() => setGranularHighlights({}), HIGHLIGHT_DURATION);

            if (hasSignalChanges) setPage('dashboard');
          }
        }

        const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(nowStr);
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
  }, [playLongBeep, sendPushNotification]);

  const handleSignalUpdate = useCallback(async (updatedSignal: TradeSignal) => {
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', updatedSignal, updatedSignal.id);
    if (success) {
      setSignals(prev => prev.map(s => s.id === updatedSignal.id ? updatedSignal : s));
      setPage('dashboard');
      prevSignalsRef.current = prevSignalsRef.current.map(s => s.id === updatedSignal.id ? updatedSignal : s);
    }
    return success;
  }, []);

  useEffect(() => {
    sync(true);
    const timer = setInterval(() => sync(false), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [sync]);

  // Initial wake lock on mount if logged in
  useEffect(() => {
    if (user) requestWakeLock();
  }, [user, requestWakeLock]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('libra_sound_enabled', String(next));
    if (next) {
      playLongBeep();
      requestNotificationPermission();
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    if (wakeLockRef.current) wakeLockRef.current.release();
    setUser(null);
  };

  if (!user) return <Login onLogin={(u) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, timestamp: Date.now() }));
    setUser(u);
    requestNotificationPermission();
    sync(true);
  }} />;

  return (
    <Layout user={user} onLogout={logout} currentPage={page} onNavigate={setPage}>
      <div className="fixed top-4 right-4 z-[60] flex flex-col items-end space-y-3">
        <div className={`bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] font-bold border shadow-2xl transition-all duration-500 flex items-center ${connectionStatus === 'error' ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800'}`}>
          <div className="flex flex-col items-start mr-3">
              <span className="text-[9px] text-slate-500 uppercase tracking-tighter leading-none mb-1">
                {connectionStatus === 'error' ? 'Auto Reconnect' : 'Server Status'}
              </span>
              <div className="flex items-center">
                 <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connectionStatus === 'syncing' ? 'bg-blue-400 animate-pulse' : connectionStatus === 'error' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></div>
                 <span className={`${connectionStatus === 'error' ? 'text-rose-400' : 'text-white'} font-mono`}>{lastSyncTime}</span>
              </div>
          </div>
          <button onClick={() => sync(false)} disabled={connectionStatus === 'syncing'} className="p-1.5 rounded-lg text-slate-500 hover:text-white">
             {connectionStatus === 'syncing' ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        <div className="flex flex-col items-end space-y-2">
          {wakeLockActive && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center text-emerald-400 text-[9px] font-black uppercase tracking-widest shadow-lg">
                <MonitorPlay size={12} className="mr-2 animate-pulse" />
                Standby Prevented
            </div>
          )}
          {notificationPermission !== 'granted' && (
             <button onClick={requestNotificationPermission} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg shadow-xl animate-bounce flex items-center">
                <BellRing size={12} className="mr-2" />
                Enable Desktop Alerts
             </button>
          )}
          <button onClick={toggleSound} className={`p-4 rounded-full border shadow-2xl transition-all ${soundEnabled ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-emerald-500/10' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
            {soundEnabled ? <Volume2 size={32} /> : <VolumeX size={32} />}
          </button>
        </div>
      </div>

      {connectionStatus === 'error' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-rose-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-2xl flex items-center animate-bounce">
            <ShieldAlert size={14} className="mr-2" />
            Network Unstable - Retrying Connection...
        </div>
      )}
      
      {page === 'dashboard' && <Dashboard watchlist={watchlist} signals={signals} user={user} granularHighlights={granularHighlights} onSignalUpdate={handleSignalUpdate} />}
      {page === 'booked' && <BookedTrades signals={signals} user={user} granularHighlights={granularHighlights} onSignalUpdate={handleSignalUpdate} />}
      {page === 'stats' && <Stats signals={signals} />}
      {page === 'rules' && <Rules />}
      {user?.isAdmin && page === 'admin' && <Admin watchlist={watchlist} onUpdateWatchlist={setWatchlist} signals={signals} onUpdateSignals={setSignals} users={users} onUpdateUsers={setUsers} onNavigate={setPage} />}
    </Layout>
  );
};

export default App;
