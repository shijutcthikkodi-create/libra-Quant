import React, { useState, useMemo } from 'react';
import { WatchlistItem, TradeSignal, OptionType, TradeStatus, User, LogEntry } from '../types';
import { 
  Trash2, Edit2, Radio, UserCheck, RefreshCw, Smartphone, Search, 
  History, Zap, Loader2, AlertTriangle, Clock, ShieldCheck, Activity, 
  Terminal, Download, LogIn, Users, Monitor, Plus, Target, TrendingUp,
  ArrowUpCircle, ArrowDownCircle, ShieldAlert, Briefcase, ChevronRight, X
} from 'lucide-react';
import { updateSheetData } from '../services/googleSheetsService';

interface AdminProps {
  watchlist: WatchlistItem[];
  onUpdateWatchlist: (list: WatchlistItem[]) => void;
  signals: TradeSignal[];
  onUpdateSignals: (list: TradeSignal[]) => void;
  users: User[];
  onUpdateUsers: (list: User[]) => void;
  logs?: LogEntry[];
  onNavigate: (page: string) => void;
}

const Admin: React.FC<AdminProps> = ({ watchlist, onUpdateWatchlist, signals, onUpdateSignals, users, onUpdateUsers, logs = [], onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'CLIENTS' | 'LOGS'>('SIGNALS');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'SECURITY' | 'TRADE' | 'SYSTEM' | 'LOGIN'>('ALL');

  // New Signal State
  const [isAddingSignal, setIsAddingSignal] = useState(false);
  const [sigInstrument, setSigInstrument] = useState('NIFTY');
  const [sigSymbol, setSigSymbol] = useState('');
  const [sigType, setSigType] = useState<OptionType>(OptionType.CE);
  const [sigAction, setSigAction] = useState<'BUY' | 'SELL'>('BUY');
  const [sigEntry, setSigEntry] = useState('');
  const [sigSL, setSigSL] = useState('');
  const [sigTargets, setSigTargets] = useState('');
  const [sigComment, setSigComment] = useState('');
  const [sigIsBtst, setSigIsBtst] = useState(false);
  const [sigQty, setSigQty] = useState('');

  const activeSignals = useMemo(() => {
    return (signals || []).filter(s => s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL);
  }, [signals]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayLogins = logs.filter(l => l.action === 'LOGIN_SUCCESS' && new Date(l.timestamp).toDateString() === today);
    const uniqueTerminals = new Set(todayLogins.map(l => l.details)).size;

    return {
      totalUsers: users.length,
      todayLogins: todayLogins.length,
      uniqueTerminals,
      securityAlerts: logs.filter(l => l.type === 'SECURITY').length
    };
  }, [logs, users]);

  // Fix: Define missing filteredLogs for the audit logs tab
  const filteredLogs = useMemo(() => {
    const list = logFilter === 'ALL' 
      ? [...logs] 
      : logs.filter(l => l.type === (logFilter as any));
    return [...list].reverse();
  }, [logs, logFilter]);

  const handleAddSignal = async () => {
    if (!sigSymbol || !sigEntry || !sigSL) return;
    setIsSaving(true);
    
    const targets = sigTargets.split(',').map(t => parseFloat(t.trim())).filter(n => !isNaN(n));
    const newSignal: TradeSignal = {
        id: `SIG-${Date.now().toString().slice(-6)}`,
        instrument: sigInstrument,
        symbol: sigSymbol,
        type: sigType,
        action: sigAction,
        entryPrice: parseFloat(sigEntry),
        stopLoss: parseFloat(sigSL),
        targets: targets,
        targetsHit: 0,
        status: TradeStatus.ACTIVE,
        timestamp: new Date().toISOString(),
        comment: sigComment,
        isBTST: sigIsBtst,
        quantity: sigQty ? parseInt(sigQty) : undefined,
        cmp: parseFloat(sigEntry)
    };

    const success = await updateSheetData('signals', 'ADD', newSignal);
    if (success) {
      onUpdateSignals([newSignal, ...signals]);
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: 'SIGNAL_BROADCAST',
        details: `NEW: ${newSignal.instrument} ${newSignal.symbol} ${newSignal.type} @ ${newSignal.entryPrice}`,
        type: 'TRADE'
      });
      // Reset form
      setSigSymbol('');
      setSigEntry('');
      setSigSL('');
      setSigTargets('');
      setSigComment('');
      setSigQty('');
      setIsAddingSignal(false);
    }
    setIsSaving(false);
  };

  const triggerQuickUpdate = async (signal: TradeSignal, updates: Partial<TradeSignal>, actionLabel: string) => {
    setIsSaving(true);
    const payload = { ...signal, ...updates, lastTradedTimestamp: new Date().toISOString() };
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', payload, signal.id);
    if (success) {
      onUpdateSignals(signals.map(s => s.id === signal.id ? (payload as TradeSignal) : s));
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: `TRADE_${actionLabel}`,
        details: `${signal.instrument} ${signal.symbol} ${signal.type}: ${updates.status || 'Updated'}`,
        type: 'TRADE'
      });
    }
    setIsSaving(false);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">Admin Terminal</h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Control Layer • Institutional Data Sync</p>
        </div>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 mt-4 md:mt-0 shadow-lg overflow-x-auto">
            {[
              { id: 'SIGNALS', icon: Radio, label: 'Manage Trades' },
              { id: 'CLIENTS', icon: UserCheck, label: 'Subscribers' },
              { id: 'LOGS', icon: History, label: 'Audit logs' }
            ].map((tab) => (
              <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  <tab.icon size={14} className="mr-2" />
                  {tab.label}
              </button>
            ))}
        </div>
      </div>

      {activeTab === 'SIGNALS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Trade Giving Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                    <div className="flex items-center">
                        <Plus size={18} className="mr-3 text-blue-500" />
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">New Order Dispatch</h3>
                    </div>
                    {!isAddingSignal && (
                      <button onClick={() => setIsAddingSignal(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-blue-900/40">
                          Create Fresh Call
                      </button>
                    )}
                </div>

                {isAddingSignal && (
                    <div className="p-6 bg-slate-950/40 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Instrument</label>
                                <select value={sigInstrument} onChange={e => setSigInstrument(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none">
                                    <option value="NIFTY">NIFTY</option>
                                    <option value="BANKNIFTY">BANKNIFTY</option>
                                    <option value="FINNIFTY">FINNIFTY</option>
                                    <option value="MIDCPNIFTY">MIDCPNIFTY</option>
                                    <option value="SENSEX">SENSEX</option>
                                    <option value="STOCKS">STOCKS</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Strike / Symbol</label>
                                <input type="text" value={sigSymbol} onChange={e => setSigSymbol(e.target.value)} placeholder="e.g. 22500" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['CE', 'PE', 'FUT'].map(t => (
                                        <button key={t} onClick={() => setSigType(t as any)} className={`py-2 text-[10px] font-black rounded-lg border transition-all ${sigType === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Action</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setSigAction('BUY')} className={`py-2 text-[10px] font-black rounded-lg border transition-all ${sigAction === 'BUY' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>BUY</button>
                                    <button onClick={() => setSigAction('SELL')} className={`py-2 text-[10px] font-black rounded-lg border transition-all ${sigAction === 'SELL' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>SELL</button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Entry Price</label>
                                <input type="number" value={sigEntry} onChange={e => setSigEntry(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Initial Stop Loss</label>
                                <input type="number" value={sigSL} onChange={e => setSigSL(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Target Ladder (Comma Separated)</label>
                                <input type="text" value={sigTargets} onChange={e => setSigTargets(e.target.value)} placeholder="e.g. 120, 140, 180" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                             <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Lot Size / Qty</label>
                                <input type="number" value={sigQty} onChange={e => setSigQty(e.target.value)} placeholder="Quantity" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Analyst Comment</label>
                                <input type="text" value={sigComment} onChange={e => setSigComment(e.target.value)} placeholder="Why this trade?" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none" />
                            </div>
                            <div className="flex items-end">
                                <button 
                                    onClick={() => setSigIsBtst(!sigIsBtst)}
                                    className={`w-full py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2 ${sigIsBtst ? 'bg-amber-600/20 border-amber-500 text-amber-500' : 'bg-slate-900 border-slate-700 text-slate-600'}`}
                                >
                                    <Clock size={12} />
                                    <span>{sigIsBtst ? 'BTST ENABLED' : 'INTRADAY ONLY'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 pt-2">
                            <button 
                                onClick={handleAddSignal} 
                                disabled={isSaving || !sigSymbol || !sigEntry} 
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-950/20 flex items-center justify-center"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Zap size={16} className="mr-2" />}
                                {isSaving ? 'Broadcasting...' : 'Dispatch Signal to Cloud'}
                            </button>
                            <button onClick={() => setIsAddingSignal(false)} className="px-6 py-4 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 transition-colors uppercase font-black text-[11px]">Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Live Management Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 bg-slate-800/10 flex justify-between items-center">
                    <div className="flex items-center">
                        <Activity size={18} className="mr-3 text-emerald-500" />
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Inventory Management ({activeSignals.length})</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Live Terminal Sync</span>
                    </div>
                </div>

                <div className="p-5">
                    {activeSignals.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                            <Briefcase size={32} className="mx-auto text-slate-800 mb-3" />
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No active positions found in inventory.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeSignals.map((s) => (
                                <div key={s.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col lg:row items-center justify-between gap-6 hover:border-slate-700 transition-all group">
                                    <div className="flex items-center space-x-4 w-full lg:w-auto">
                                        <div className={`p-2 rounded-xl ${s.action === 'BUY' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                                            {s.action === 'BUY' ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-0.5">
                                                <h4 className="font-mono font-black text-white uppercase tracking-tighter text-base">{s.instrument} {s.symbol} {s.type}</h4>
                                                {s.isBTST && <span className="text-[8px] font-black bg-amber-600/20 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded">BTST</span>}
                                            </div>
                                            <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-500">
                                                <span className="flex items-center"><Target size={10} className="mr-1" /> ENTRY: ₹{s.entryPrice}</span>
                                                <span className="flex items-center text-rose-500"><ShieldAlert size={10} className="mr-1" /> SL: ₹{s.stopLoss}</span>
                                                {s.quantity && <span className="flex items-center text-blue-400"><Briefcase size={10} className="mr-1" /> QTY: {s.quantity}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-2 w-full lg:w-auto">
                                        <button 
                                            onClick={() => triggerQuickUpdate(s, { targetsHit: (s.targetsHit || 0) + 1, status: TradeStatus.PARTIAL, comment: `Target ${(s.targetsHit || 0) + 1} Done! Book Partial.` }, "TARGET")}
                                            className="px-3 py-2 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/20 text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center justify-center space-y-1"
                                        >
                                            <TrendingUp size={14} />
                                            <span>Hit T{(s.targetsHit || 0) + 1}</span>
                                        </button>

                                        <button 
                                            onClick={() => triggerQuickUpdate(s, { status: TradeStatus.ALL_TARGET, comment: "Excellent Trade! All targets achieved." }, "ALL_DONE")}
                                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center justify-center space-y-1 shadow-lg shadow-emerald-900/20"
                                        >
                                            <TrendingUp size={14} />
                                            <span>All Done</span>
                                        </button>

                                        <button 
                                            onClick={() => triggerQuickUpdate(s, { status: TradeStatus.STOPPED, comment: "Strict Stop Loss hit. Safety first." }, "SL_HIT")}
                                            className="px-3 py-2 bg-rose-900/20 hover:bg-rose-900/40 border border-rose-500/20 text-rose-400 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center justify-center space-y-1"
                                        >
                                            <ShieldAlert size={14} />
                                            <span>SL Sealed</span>
                                        </button>

                                        <button 
                                            onClick={() => triggerQuickUpdate(s, { status: TradeStatus.EXITED, comment: "Positions squared off at CMP." }, "SQUARE_OFF")}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center justify-center space-y-1"
                                        >
                                            <X size={14} />
                                            <span>Square Off</span>
                                        </button>

                                        <button 
                                            onClick={() => { /* Open Edit Modal - placeholder */ }}
                                            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center justify-center space-y-1"
                                        >
                                            <Edit2 size={14} />
                                            <span>Modify</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'CLIENTS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
               <div className="flex items-center justify-between mb-1">
                 <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Total Active Accounts</p>
                 <Users size={12} className="text-blue-500" />
               </div>
               <p className="text-2xl font-mono font-black text-white">{stats.totalUsers}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
               <div className="flex items-center justify-between mb-1 text-emerald-500">
                 <p className="text-[9px] font-black uppercase tracking-widest">Login sessions Today</p>
                 <LogIn size={12} />
               </div>
               <p className="text-2xl font-mono font-black text-emerald-400">{stats.todayLogins}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
               <div className="flex items-center justify-between mb-1 text-purple-500">
                 <p className="text-[9px] font-black uppercase tracking-widest">Unique IPs / Hardware</p>
                 <Monitor size={12} />
               </div>
               <p className="text-2xl font-mono font-black text-purple-400">{stats.uniqueTerminals}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
               <div className="flex items-center justify-between mb-1 text-rose-500">
                 <p className="text-[9px] font-black uppercase tracking-widest">Threat Detections</p>
                 <ShieldCheck size={12} />
               </div>
               <p className="text-2xl font-mono font-black text-rose-400">{stats.securityAlerts}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center bg-slate-800/10">
                  <Search className="text-slate-500 mr-3" size={18} />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search database..." className="w-full bg-transparent text-xs text-white outline-none" />
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/50 text-slate-500 font-black uppercase text-[9px] tracking-widest border-b border-slate-800">
                          <tr>
                              <th className="p-5">Subscriber Identity</th>
                              <th className="p-5">Activity Trail</th>
                              <th className="p-5">Access Status</th>
                              <th className="p-5">Binding</th>
                              <th className="p-5 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                          {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.phoneNumber.includes(searchQuery)).map(u => {
                            const isExpired = new Date(u.expiryDate) < new Date();
                            return (
                              <tr key={u.id} className={`transition-colors hover:bg-slate-800/30 ${isExpired ? 'bg-rose-500/5' : ''}`}>
                                  <td className="p-5">
                                      <div className="font-black text-white mb-0.5">{u.name}</div>
                                      <div className="text-[10px] text-slate-500 font-mono tracking-tighter">{u.phoneNumber}</div>
                                  </td>
                                  <td className="p-5">
                                      <div className="flex items-center text-[10px] font-bold text-slate-500">
                                        <Clock size={10} className="mr-1.5" />
                                        <span>LAST: {u.id.slice(0, 10)}...</span>
                                      </div>
                                  </td>
                                  <td className="p-5">
                                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black border uppercase ${isExpired ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'}`}>
                                        {isExpired ? 'EXPIRED' : 'ACTIVE'}
                                      </div>
                                      <div className="text-[9px] font-mono text-slate-400 mt-1">{u.expiryDate || 'N/A'}</div>
                                  </td>
                                  <td className="p-5">
                                      <div className={`flex items-center text-[9px] font-black uppercase tracking-widest ${u.deviceId ? 'text-blue-500' : 'text-slate-700'}`}>
                                          <Smartphone size={10} className="mr-2" />
                                          {u.deviceId ? 'BOUND' : 'UNLOCKED'}
                                      </div>
                                  </td>
                                  <td className="p-5 text-right">
                                     <div className="flex items-center justify-end space-x-2">
                                        <button className="p-1.5 text-slate-600 hover:text-blue-500 transition-colors"><Edit2 size={14} /></button>
                                        <button className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                                     </div>
                                  </td>
                              </tr>
                            );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
        </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 bg-slate-800/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="flex items-center">
                    <History size={18} className="mr-3 text-purple-500" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Audit Logs (Last 100)</h3>
                 </div>
                 <div className="flex items-center space-x-2">
                    {(['ALL', 'SECURITY', 'TRADE', 'SYSTEM'] as const).map(type => (
                       <button 
                         key={type}
                         onClick={() => setLogFilter(type)}
                         className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${logFilter === type ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'}`}
                       >
                         {type}
                       </button>
                    ))}
                 </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                 <table className="w-full text-left text-[10px]">
                     <thead className="bg-slate-950/80 text-slate-500 font-black uppercase text-[9px] tracking-widest border-b border-slate-800 sticky top-0 z-10">
                         <tr>
                             <th className="p-4">Time (IST)</th>
                             <th className="p-4">User</th>
                             <th className="p-4">Action</th>
                             <th className="p-4">Details</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800">
                         {filteredLogs.slice(0, 100).map((log, idx) => {
                            const isSecurity = log.type === 'SECURITY';
                            return (
                             <tr key={idx} className={`hover:bg-slate-800/20 transition-colors ${isSecurity ? 'bg-rose-500/5' : ''}`}>
                                 <td className="p-4 font-mono text-slate-500">
                                    {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                 </td>
                                 <td className="p-4 font-black text-white">{log.user}</td>
                                 <td className="p-4">
                                   <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border ${
                                     isSecurity ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                                   }`}>
                                     {log.action}
                                   </span>
                                 </td>
                                 <td className="p-4 text-slate-400 font-mono text-[9px]">{log.details}</td>
                             </tr>
                            );
                         })}
                     </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Admin;