
import React, { useState, useMemo } from 'react';
import { WatchlistItem, TradeSignal, OptionType, TradeStatus, User, LogEntry } from '../types';
import { Plus, Trash2, Edit2, List, X, Check, Radio, UserCheck, RefreshCw, Smartphone, Search, Calendar, ShieldCheck, UserPlus, Clock, Target, KeyRound, ShieldAlert, History, FileText, Zap, Trophy, AlertTriangle, LogOut, Activity } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'WATCHLIST' | 'CLIENTS' | 'LOGS'>('SIGNALS');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [isAddingUser, setIsAddingUser] = useState(false);

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => 
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.phoneNumber || '').includes(searchQuery) ||
      (u.id || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  // --- Signal State ---
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

  // --- Quick Action Logic ---
  // CRITICAL: We now add lastTradedTimestamp to ensure the 48h filter captures the update
  const triggerQuickUpdate = async (signal: TradeSignal, updates: Partial<TradeSignal>, actionLabel: string) => {
    setIsSaving(true);
    const now = new Date().toISOString();
    const payload = { 
      ...signal, 
      ...updates, 
      lastTradedTimestamp: now // Forces it into the "Recent" window
    };
    
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', payload, signal.id);
    if (success) {
      onUpdateSignals(signals.map(s => s.id === signal.id ? (payload as TradeSignal) : s));
      await updateSheetData('logs', 'ADD', {
        timestamp: now,
        user: 'Admin',
        action: 'CALL_UPDATE',
        details: `${actionLabel} on ${signal.instrument} ${signal.symbol}`,
        type: 'TRADE'
      });
    }
    setIsSaving(false);
  };

  const handleAddSignal = async () => {
    setValidationError(null);
    if (!sigSymbol || !sigEntry || !sigSL) {
      setValidationError("Symbol, Entry, and SL are required.");
      return;
    }

    const entry = parseFloat(sigEntry);
    const sl = parseFloat(sigSL);
    const targets = sigTargets.split(',').map(t => parseFloat(t.trim())).filter(n => !isNaN(n));
    
    setIsSaving(true);
    const newSignal: TradeSignal = {
        id: `SIG-${Date.now().toString().slice(-4)}`,
        instrument: sigInstrument,
        symbol: sigSymbol,
        type: sigType,
        action: sigAction,
        entryPrice: entry,
        stopLoss: sl,
        targets: targets,
        targetsHit: 0,
        status: TradeStatus.ACTIVE,
        timestamp: new Date().toISOString(),
        comment: sigComment,
        isBTST: sigIsBtst
    };

    const success = await updateSheetData('signals', 'ADD', newSignal);
    if (success) {
      onUpdateSignals([newSignal, ...signals]);
      setSigSymbol(''); setSigEntry(''); setSigSL(''); setSigTargets(''); setSigComment('');
      setIsAddingSignal(false);
      onNavigate('dashboard');
    }
    setIsSaving(false);
  };

  const [editingUserPassId, setEditingUserPassId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState('');

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">Admin Command Center</h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Institutional Oversight & Logistical Control</p>
        </div>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 mt-4 md:mt-0 shadow-lg">
            {[
              { id: 'SIGNALS', icon: Radio, label: 'Calls' },
              { id: 'CLIENTS', icon: UserCheck, label: 'Subscribers' },
              { id: 'LOGS', icon: History, label: 'Logs' }
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
          <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                      <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/20">
                            <Zap size={20} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Call Dispatcher</h3>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">Broadcast new signals to terminal</p>
                          </div>
                      </div>
                      <button onClick={() => { setIsAddingSignal(!isAddingSignal); setValidationError(null); }} className={`flex items-center px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isAddingSignal ? 'bg-slate-800 text-slate-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'}`}>
                          {isAddingSignal ? <X size={14} className="mr-2" /> : <Plus size={14} className="mr-2" />}
                          {isAddingSignal ? 'Cancel' : 'Initiate Call'}
                      </button>
                  </div>

                  {isAddingSignal && (
                      <div className="p-6 bg-slate-950/50 border-b border-slate-800 animate-in slide-in-from-top-4 duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                              <div className="md:col-span-1">
                                  <label className="block mb-1.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Instrument</label>
                                  <select value={sigInstrument} onChange={e => setSigInstrument(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:border-blue-500 outline-none">
                                      <option value="NIFTY">NIFTY</option>
                                      <option value="BANKNIFTY">BANKNIFTY</option>
                                      <option value="FINNIFTY">FINNIFTY</option>
                                      <option value="MIDCPNIFTY">MIDCPNIFTY</option>
                                      <option value="STOCK">STOCK</option>
                                  </select>
                              </div>
                              <div className="md:col-span-1">
                                  <label className="block mb-1.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Strike/Symbol</label>
                                  <input type="text" value={sigSymbol} onChange={e => setSigSymbol(e.target.value)} placeholder="e.g. 24000" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-white outline-none" />
                              </div>
                              <div className="md:col-span-1">
                                  <label className="block mb-1.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Type</label>
                                  <select value={sigType} onChange={e => setSigType(e.target.value as OptionType)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none">
                                      <option value="CE">CE</option>
                                      <option value="PE">PE</option>
                                      <option value="FUT">FUT</option>
                                  </select>
                              </div>
                              <div className="md:col-span-1">
                                  <label className="block mb-1.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Action</label>
                                  <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700">
                                      <button onClick={() => setSigAction('BUY')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all ${sigAction === 'BUY' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500'}`}>BUY</button>
                                      <button onClick={() => setSigAction('SELL')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all ${sigAction === 'SELL' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-500'}`}>SELL</button>
                                  </div>
                              </div>
                              <div className="md:col-span-1">
                                  <label className="block mb-1.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">BTST</label>
                                  <button onClick={() => setSigIsBtst(!sigIsBtst)} className={`w-full py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${sigIsBtst ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-lg shadow-amber-500/5' : 'bg-slate-900 border-slate-700 text-slate-600'}`}>
                                      {sigIsBtst ? 'YES (BTST)' : 'NO (Intraday)'}
                                  </button>
                              </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                              <div>
                                  <label className="block mb-1.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Entry</label>
                                  <input type="number" value={sigEntry} onChange={e => setSigEntry(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-white outline-none" />
                              </div>
                              <div>
                                  <label className="block mb-1.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Initial SL</label>
                                  <input type="number" value={sigSL} onChange={e => setSigSL(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-white outline-none" />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="block mb-1.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Targets</label>
                                  <input type="text" value={sigTargets} onChange={e => setSigTargets(e.target.value)} placeholder="e.g. 100, 110, 120" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-white outline-none" />
                              </div>
                          </div>
                          <button onClick={handleAddSignal} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl text-xs font-black text-white flex items-center justify-center transition-all shadow-xl shadow-blue-500/20 uppercase tracking-[0.2em]">
                              {isSaving ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Zap className="mr-2" size={16} />}
                              {isSaving ? 'Broadcasting Call...' : 'Confirm & Send Call'}
                          </button>
                      </div>
                  )}

                  <div className="p-5 bg-slate-800/10">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                      <Activity size={12} className="mr-2 text-emerald-500" />
                      Live Position Control Room
                    </h4>
                    <div className="space-y-4">
                      {signals.filter(s => s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL).length === 0 ? (
                        <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">No active positions to manage</p>
                        </div>
                      ) : (
                        signals.filter(s => s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL).map(s => (
                          <div key={s.id} className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-6 hover:border-slate-700 transition-all">
                            <div className="flex items-center space-x-4 min-w-[200px]">
                              <div className={`p-2 rounded-xl ${s.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                <Zap size={20} />
                              </div>
                              <div>
                                <h5 className="text-sm font-black text-white uppercase font-mono">{s.instrument} {s.symbol} {s.type}</h5>
                                <p className="text-[9px] text-slate-500 font-bold">ENTRY: ₹{s.entryPrice} • CMP: <span className="text-white">₹{s.cmp || '--'}</span></p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 flex-1">
                               <QuickActionButton 
                                 label="T1 DONE" 
                                 active={s.targetsHit === 1} 
                                 onClick={() => triggerQuickUpdate(s, { targetsHit: 1, status: TradeStatus.PARTIAL, comment: "Target 1 Done! Book Partial Profit." }, "T1_HIT")}
                                 color="text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                               />
                               <QuickActionButton 
                                 label="T2 DONE" 
                                 active={s.targetsHit === 2} 
                                 onClick={() => triggerQuickUpdate(s, { targetsHit: 2, status: TradeStatus.PARTIAL, comment: "Target 2 Done! Trail SL for more." }, "T2_HIT")}
                                 color="text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                               />
                               <QuickActionButton 
                                 label="ALL DONE" 
                                 onClick={() => {
                                   const finalPoints = s.targets && s.targets.length > 0 ? (s.targets[s.targets.length - 1] - s.entryPrice) : 0;
                                   triggerQuickUpdate(s, { status: TradeStatus.ALL_TARGET, pnlPoints: finalPoints, comment: "BOOM! All Targets Done. Book Full Profit." }, "ALL_TARGET_HIT")
                                 }}
                                 color="text-emerald-500 border-emerald-500 bg-emerald-500/10"
                               />
                               <QuickActionButton 
                                 label="EXIT NOW" 
                                 onClick={() => triggerQuickUpdate(s, { status: TradeStatus.EXITED, comment: "Exit current position at market price." }, "MANUAL_EXIT")}
                                 color="text-amber-500 border-amber-500/20 bg-amber-500/5"
                               />
                               <QuickActionButton 
                                 label="SL HIT" 
                                 onClick={() => triggerQuickUpdate(s, { status: TradeStatus.STOPPED, pnlPoints: (s.stopLoss - s.entryPrice), comment: "Stop Loss Hit. Discipline is key." }, "SL_HIT")}
                                 color="text-rose-500 border-rose-500/50 bg-rose-500/10"
                               />
                               <QuickActionButton 
                                 label="DELETE" 
                                 onClick={() => updateSheetData('signals', 'UPDATE_SIGNAL', { ...s, status: TradeStatus.EXITED, lastTradedTimestamp: new Date().toISOString() }, s.id)}
                                 color="text-slate-600 border-slate-800"
                               />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CLIENTS' && (
          <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-5 border-b border-slate-800 bg-slate-800/20 flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div className="relative w-full md:w-96">
                          <Search className="absolute left-4 top-3 text-slate-500" size={18} />
                          <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search Subscriber Repository..." 
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white focus:border-blue-500 outline-none transition-all"
                          />
                      </div>
                      <button 
                        onClick={() => setIsAddingUser(!isAddingUser)}
                        className="w-full md:w-auto flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                      >
                          <UserPlus size={16} className="mr-2" />
                          Add Subscriber
                      </button>
                  </div>

                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-slate-900/50 text-[9px] uppercase font-black text-slate-500 border-b border-slate-800">
                              <tr>
                                  <th className="p-5 pl-8">Identity</th>
                                  <th className="p-5">Subscription Status</th>
                                  <th className="p-5">Hardware Identity</th>
                                  <th className="p-5 text-right pr-8">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                              {filteredUsers.map(u => {
                                  const isExpired = new Date(u.expiryDate) <= new Date();
                                  return (
                                    <tr key={u.id} className="hover:bg-slate-800/10 transition-all">
                                        <td className="p-5 pl-8">
                                            <div className="font-bold text-white text-sm tracking-tight">{u.name}</div>
                                            <div className="text-[10px] font-mono text-slate-500 mt-1">{u.phoneNumber}</div>
                                        </td>
                                        <td className="p-5">
                                            <div className={`text-[8px] font-black px-2 py-0.5 rounded border inline-block ${isExpired ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                                {isExpired ? 'EXPIRED' : 'ACTIVE'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-tighter">Ends: {u.expiryDate}</div>
                                        </td>
                                        <td className="p-5">
                                            <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${u.deviceId ? 'text-blue-500' : 'text-slate-700'}`}>
                                                <Smartphone size={12} className="mr-2" />
                                                {u.deviceId ? 'TERMINAL BOUND' : 'NOT LINKED'}
                                            </div>
                                            {u.deviceId && (
                                                <button onClick={() => updateSheetData('users', 'UPDATE_USER', { ...u, deviceId: "" }, u.id)} className="text-[8px] font-black text-slate-500 hover:text-rose-500 uppercase mt-1 tracking-tighter">
                                                    Reset Hardware Lock
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-5 text-right pr-8">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button onClick={() => { setEditingUserPassId(u.id); setTempPassword(u.password || ''); }} className="p-2 bg-slate-900 text-slate-500 hover:text-blue-500 rounded-lg border border-slate-800">
                                                    <KeyRound size={16} />
                                                </button>
                                                <button className="p-2 bg-slate-900 text-slate-500 hover:text-rose-500 rounded-lg border border-slate-800">
                                                    <Trash2 size={16} />
                                                </button>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
           <div className="p-5 border-b border-slate-800 bg-slate-800/20">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center">
                  <History size={18} className="mr-3 text-purple-500" />
                  Audit & Security Trail
              </h3>
           </div>
           <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-left">
                  <thead className="bg-slate-900/80 text-[9px] uppercase font-black text-slate-500 border-b border-slate-800 sticky top-0 backdrop-blur">
                      <tr>
                          <th className="p-5 pl-8">Event Timestamp</th>
                          <th className="p-5">Category</th>
                          <th className="p-5">Principal</th>
                          <th className="p-5 pr-8">Metadata & Action Details</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                      {(logs || []).length > 0 ? [...logs].reverse().map((log, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/5 transition-colors">
                              <td className="p-5 pl-8 font-mono text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                              <td className="p-5">
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${
                                      log.type === 'SECURITY' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                      log.type === 'TRADE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                      'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}>{log.type}</span>
                              </td>
                              <td className="p-5 text-[11px] text-white font-bold">{log.user}</td>
                              <td className="p-5 pr-8">
                                  <div className="text-[11px] text-slate-300 font-black uppercase tracking-tight">{log.action}</div>
                                  <div className="text-[10px] text-slate-500 mt-1 font-mono">{log.details}</div>
                              </td>
                          </tr>
                      )) : (
                        <tr>
                            <td colSpan={4} className="p-20 text-center">
                                <FileText size={48} className="mx-auto text-slate-800 mb-4 opacity-20" />
                                <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">Institutional archive empty</p>
                            </td>
                        </tr>
                      )}
                  </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

const QuickActionButton = ({ label, onClick, color, active }: { label: string; onClick: () => void; color: string; active?: boolean }) => (
  <button 
    onClick={onClick}
    className={`px-2 py-2 rounded-xl border text-[8px] font-black uppercase tracking-tighter transition-all hover:scale-95 ${color} ${active ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}
  >
    {label}
  </button>
);

export default Admin;
