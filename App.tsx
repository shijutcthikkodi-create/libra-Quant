
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Stats from './pages/Stats';
import Rules from './pages/Rules';
import Admin from './pages/Admin';
import BookedTrades from './pages/BookedTrades';
import ChatWidget from './components/ChatWidget';
import { User, WatchlistItem, TradeSignal, TradeStatus, LogEntry, ChatMessage } from './types';
import { fetchSheetData, updateSheetData } from './services/googleSheetsService';
import { MOCK_WATCHLIST, MOCK_SIGNALS } from './constants';
import { Radio, CheckCircle, BarChart2, ShieldAlert, Volume2, VolumeX, RefreshCw, WifiOff } from 'lucide-react';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; 
const SESSION_KEY = 'libra_user_session';
const POLL_INTERVAL = 8000; 
const HIGHLIGHT_DURATION = 15000;

export type GranularHighlights = Record<string, Set<string>>;

const SIGNAL_KEYS: Array<keyof TradeSignal> = [
  'instrument', 'symbol', 'type', 'action', 'entryPrice', 
  'stopLoss', 'targets', 'trailingSL', 'status', 'pnlPoints', 'pnlRupees', 'comment', 'targetsHit',
  'quantity', 'cmp', 'isBTST'
];

const WATCH_KEYS: Array<keyof WatchlistItem> = ['symbol', 'price', 'change', 'lastUpdated'];

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
  const [historySignals, setHistorySignals] = useState<TradeSignal[]>([]); 
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'syncing'>('connected');
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--:--');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('libra_sound_enabled') === 'true');
  const [granularHighlights, setGranularHighlights] = useState<GranularHighlights>({});
  
  const prevSignalsRef = useRef<TradeSignal[]>([]);
  const prevWatchRef = useRef<WatchlistItem[]>([]);
  const prevMessagesCountRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);

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
        const currentHighlights: GranularHighlights = {};

        if (!isInitial && prevSignalsRef.current.length > 0) {
          data.signals.forEach(s => {
            const sid = s.id;
            const old = prevSignalsRef.current.find(o => o.id === sid);
            const diff = new Set<string>();
            
            if (!old) {
              SIGNAL_KEYS.forEach(k => diff.add(k));
            } else {
              SIGNAL_KEYS.forEach(k => {
                const newVal = JSON.stringify(s[k]);
                const oldVal = JSON.stringify(old[k]);
                if (newVal !== oldVal) {
                  diff.add(k);
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
              hasSignalChanges = true; 
            }
          });

          data.watchlist.forEach(w => {
            const sym = w.symbol;
            const old = prevWatchRef.current.find(o => o.symbol === sym);
            const diff = new Set<string>();
            if (!old) {
              WATCH_KEYS.forEach(k => diff.add(k));
            } else {
              WATCH_KEYS.forEach(k => {
                if (JSON.stringify((w as any)[k]) !== JSON.stringify((old as any)[k])) diff.add(k);
              });
            }
            if (diff.size > 0) { currentHighlights[sym] = diff; hasAnyChanges = true; }
          });

          // Check for new messages
          if (data.messages.length > prevMessagesCountRef.current) {
            const lastMsg = data.messages[data.messages.length - 1];
            if (user?.isAdmin || (lastMsg.userId === user?.id && lastMsg.isAdminReply)) {
                hasAnyChanges = true;
            }
          }
        }

        if (hasAnyChanges) {
          playLongBeep(isCriticalAlert);
          if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
          setGranularHighlights(currentHighlights);
          highlightTimeoutRef.current = setTimeout(() => setGranularHighlights({}), HIGHLIGHT_DURATION);

          if (hasSignalChanges) {
            setPage('dashboard');
          }
        }

        const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(nowStr);
        prevSignalsRef.current = [...data.signals];
        prevWatchRef.current = [...data.watchlist];
        prevMessagesCountRef.current = data.messages.length;
        
        setSignals([...data.signals]);
        setHistorySignals([...(data.history || [])]);
        setWatchlist([...data.watchlist]);
        setUsers([...data.users]);
        setLogs([...(data.logs || [])]);
        setMessages([...data.messages]);
        setConnectionStatus('connected');
      }
    } catch (err: any) {
      setConnectionStatus('error');
    } finally {
      isFetchingRef.current = false;
    }
  }, [playLongBeep, user]);

  const handleSignalUpdate = useCallback(async (updatedSignal: TradeSignal) => {
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', updatedSignal, updatedSignal.id);
    if (success) {
      setSignals(prev => prev.map(s => s.id === updatedSignal.id ? updatedSignal : s));
      setPage('dashboard');
      prevSignalsRef.current = prevSignalsRef.current.map(s => s.id === updatedSignal.id ? updatedSignal : s);
    }
    return success;
  }, []);

  const handleSendMessage = useCallback(async (text: string, isAdminReply = false, targetUserId?: string) => {
    if (!user) return false;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      userId: targetUserId || user.id,
      senderName: isAdminReply ? 'Libra Support' : user.name,
      text,
      timestamp: new Date().toISOString(),
      isAdminReply
    };

    const success = await updateSheetData('messages', 'ADD', newMessage);
    if (success) {
      setMessages(prev => [...prev, newMessage]);
      prevMessagesCountRef.current += 1;
    }
    return success;
  }, [user]);

  useEffect(() => {
    sync(true);
    const timer = setInterval(() => sync(false), POLL_INTERVAL);
    return () => {
      clearInterval(timer);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [sync]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('libra_sound_enabled', String(next));
    if (next) playLongBeep();
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
          <button 
            onClick={() => sync(false)} 
            disabled={connectionStatus === 'syncing'}
            className={`p-1.5 rounded-lg transition-all ${connectionStatus === 'error' ? 'bg-rose-500 text-white animate-bounce' : 'text-slate-500 hover:text-white'}`}
          >
             {connectionStatus === 'error' ? <WifiOff size={14} /> : <RefreshCw size={14} className={connectionStatus === 'syncing' ? 'animate-spin' : ''} />}
          </button>
        </div>

        <button 
          onClick={toggleSound} 
          className={`p-4 rounded-full border shadow-2xl transition-all ${soundEnabled ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-emerald-500/10' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
          title="Toggle Alert Sounds"
        >
          {soundEnabled ? <Volume2 size={32} /> : <VolumeX size={32} />}
        </button>
      </div>

      {connectionStatus === 'error' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-rose-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-2xl flex items-center animate-bounce">
            <ShieldAlert size={14} className="mr-2" />
            Network Unstable - Retrying Connection...
        </div>
      )}
      
      {page === 'dashboard' && <Dashboard watchlist={watchlist} signals={signals} user={user} granularHighlights={granularHighlights} onSignalUpdate={handleSignalUpdate} />}
      {page === 'booked' && <BookedTrades signals={signals} historySignals={historySignals} user={user} granularHighlights={granularHighlights} onSignalUpdate={handleSignalUpdate} />}
      {page === 'stats' && <Stats signals={signals} historySignals={historySignals} />}
      {page === 'rules' && <Rules />}
      {user?.isAdmin && page === 'admin' && <Admin watchlist={watchlist} onUpdateWatchlist={setWatchlist} signals={signals} onUpdateSignals={setSignals} users={users} onUpdateUsers={setUsers} logs={logs} messages={messages} onSendMessage={handleSendMessage} onNavigate={setPage} />}

      {/* Universal Instant Chat for both Client and Admin */}
      <ChatWidget messages={messages} onSendMessage={handleSendMessage} user={user} users={users} />

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
