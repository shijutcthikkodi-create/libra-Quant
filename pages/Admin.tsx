
import React, { useState, useMemo } from 'react';
import { WatchlistItem, TradeSignal, OptionType, TradeStatus, User, LogEntry } from '../types';
import { 
  Trash2, Edit2, Radio, UserCheck, RefreshCw, Smartphone, Search, 
  History, Zap, Loader2, AlertTriangle, Clock, ShieldCheck, Activity, 
  Terminal, Download
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
  const [logFilter, setLogFilter] = useState<'ALL' | 'SECURITY' | 'TRADE' | 'SYSTEM'>('ALL');

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => 
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.phoneNumber || '').includes(searchQuery)
    );
  }, [users, searchQuery]);

  const filteredLogs = useMemo(() => {
    let base = [...logs];
    if (logFilter !== 'ALL') {
      base = base.filter(l => l.type === logFilter);
    }
    return base.reverse();
  }, [logs, logFilter]);

  const logStats = useMemo(() => {
    return {
      total: logs.length,
      security: logs.filter(l => l.type === 'SECURITY').length,
      trade: logs.filter(l => l.type === 'TRADE').length,
      system: logs.filter(l => l.type === 'SYSTEM').length
    };
  }, [logs]);

  const getExpiryStatus = (expiryStr: string) => {
    if (!expiryStr) return { label: 'NO EXPIRY', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-800' };
    
    let normalized = expiryStr;
    if (expiryStr.includes('-') && expiryStr.split('-')[0].length === 2) {
      const parts = expiryStr.split('-');
      normalized = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    
    const expiryDate = new Date(normalized);
    expiryDate.setHours(23, 59, 59, 999);
    const now = new Date();
    
    if (isNaN(expiryDate.getTime())) return { label: 'INVALID', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-800' };
    
    const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (now > expiryDate) return { label: 'EXPIRED', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/40' };
    if (diffDays <= 3) return { label: `${diffDays}D LEFT`, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/40' };
    return { label: 'ACTIVE', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40' };
  };

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

  const triggerQuickUpdate = async (signal: TradeSignal, updates: Partial<TradeSignal>, actionLabel: string) => {
    setIsSaving(true);
    const payload = { ...signal, ...updates, lastTradedTimestamp: new Date().toISOString() };
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', payload, signal.id);
    if (success) {
      onUpdateSignals(signals.map(s => s.id === signal.id ? (payload as TradeSignal) : s));
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: `SIGNAL_${actionLabel}`,
        details: `${signal.instrument} ${signal.symbol} ${signal.type}: Status ${updates.status || 'Updated'}`,
        type: 'TRADE'
      });
    }
    setIsSaving(false);
  };

  const handleAddSignal = async () => {
    if (!sigSymbol || !sigEntry || !sigSL) return;
    setIsSaving(true);
    const newSignal: TradeSignal = {
        id: `SIG-${Date.now().toString().slice(-4)}`,
        instrument: sigInstrument,
        symbol: sigSymbol,
        type: sigType,
        action: sigAction,
        entryPrice: parseFloat(sigEntry),
        stopLoss: parseFloat(sigSL),
        targets: sigTargets.split(',').map(t => parseFloat(t.trim())).filter(n => !isNaN(n)),
        targetsHit: 0,
        status: TradeStatus.ACTIVE,
        timestamp: new Date().toISOString(),
        comment: sigComment,
        isBTST: sigIsBtst
    };
    const success = await updateSheetData('signals', 'ADD', newSignal);
    if (success) {
      onUpdateSignals([newSignal, ...signals]);
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: 'SIGNAL_BROADCAST',
        details: `NEW: ${newSignal.instrument} ${newSignal.symbol} ${newSignal.type} @ ${newSignal.entryPrice.toFixed(2)}`,
        type: 'TRADE'
      });
      setIsAddingSignal(false);
      onNavigate('dashboard');
    }
    setIsSaving(false);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">Admin Console</h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Institutional Terminal Management</p>
        </div>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 mt-4 md:mt-0 shadow-lg overflow-x-auto">
            {[
              { id: 'SIGNALS', icon: Radio, label: 'Calls' },
              { id: 'CLIENTS', icon: UserCheck, label: 'Subscribers' },
              { id: 'LOGS', icon: History, label: 'Audit Trail' }
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center">
                        <Zap size={18} className="mr-3 text-blue-500" /> Dispatch Center
                      </h3>
                      <button onClick={() => setIsAddingSignal(!isAddingSignal)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest">
                          {isAddingSignal ? 'Cancel' : 'New Call'}
                      </button>
                  </div>
                  {isAddingSignal && (
                      <div className="p-6 bg-slate-950/50 border-b border-slate-800">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                              <input type="text" value={sigSymbol} onChange={e => setSigSymbol(e.target.value)} placeholder="Strike" className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white" />
                              <input type="number" value={sigEntry} onChange={e => setSigEntry(e.target.value)} placeholder="Entry" className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white" />
                              <input type="number" value={sigSL} onChange={e => setSigSL(e.target.value)} placeholder="SL" className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white" />
                              <input type="text" value={sigTargets} onChange={e => setSigTargets(e.target.value)} placeholder="Targets (e.g. 10,20)" className="md:col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white" />
                          </div>
                          <button onClick={handleAddSignal} disabled={isSaving} className="w-full bg-blue-600 py-3 rounded-xl text-xs font-black text-white uppercase tracking-widest">
                              {isSaving ? 'Broadcasting...' : 'Broadcast Signal'}
                          </button>
                      </div>
                  )}
                  <div className="p-5 space-y-4">
                      {signals.filter(s => s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL).map(s => (
                        <div key={s.id} className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex flex-col xl:flex-row items-center justify-between gap-4">
                          <div className="text-left flex-1">
                            <h5 className="text-sm font-black text-white uppercase font-mono">{s.instrument} {s.symbol} {s.type}</h5>
                            <p className="text-[9px] text-slate-500 font-bold tracking-tight">
                              ENTRY: {s.entryPrice.toFixed(2)} | CMP: {s.cmp !== undefined ? s.cmp.toFixed(2) : '--'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                             <button onClick={() => triggerQuickUpdate(s, { targetsHit: 1, status: TradeStatus.PARTIAL, comment: "T1 Reached." }, "T1")} className="px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase">T1 Done</button>
                             <button onClick={() => triggerQuickUpdate(s, { status: TradeStatus.ALL_TARGET, comment: "All Targets Done!" }, "ALL")} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase">Finish</button>
                             <button onClick={() => triggerQuickUpdate(s, { status: TradeStatus.STOPPED, comment: "SL Hit." }, "SL")} className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 text-[9px] font-black uppercase">SL Hit</button>
                          </div>
                        </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CLIENTS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center bg-slate-800/10">
                  <Search className="text-slate-500 mr-3" size={18} />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filter Subscribers..." className="w-full bg-transparent text-xs text-white outline-none" />
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/50 text-slate-500 font-black uppercase text-[9px] tracking-widest border-b border-slate-800">
                          <tr>
                              <th className="p-5">Name & Identity</th>
                              <th className="p-5">Subscription Expiry</th>
                              <th className="p-5">Terminal Binding</th>
                              <th className="p-5 text-right">Access Control</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                          {filteredUsers.map(u => {
                            const status = getExpiryStatus(u.expiryDate);
                            return (
                              <tr key={u.id} className={`transition-colors ${status.label === 'EXPIRED' ? 'bg-rose-500/5' : ''} hover:bg-slate-800/30`}>
                                  <td className="p-5">
                                      <div className="font-bold text-white mb-1 flex items-center">
                                        {u.name}
                                        {status.label === 'EXPIRED' && <AlertTriangle size={12} className="ml-2 text-rose-500 animate-pulse" />}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">{u.phoneNumber}</div>
                                  </td>
                                  <td className="p-5">
                                      <div className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black border ${status.bg} ${status.color} ${status.border} mb-1.5`}>
                                        <Clock size={10} className="mr-1.5" />
                                        {status.label}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-400">{u.expiryDate || 'PERPETUAL'}</div>
                                  </td>
                                  <td className="p-5">
                                      <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${u.deviceId ? 'text-blue-500' : 'text-slate-700'}`}>
                                          <Smartphone size={12} className="mr-2" />
                                          {u.deviceId ? `BOUND: ${u.deviceId.slice(0, 8)}` : 'UNLINKED'}
                                      </div>
                                      {u.deviceId && (
                                          <button onClick={() => updateSheetData('users', 'UPDATE_USER', { ...u, deviceId: "" }, u.id)} className="text-[8px] font-black text-slate-500 hover:text-rose-500 uppercase mt-1 tracking-tighter transition-colors">
                                              Reset Terminal Lock
                                          </button>
                                      )}
                                  </td>
                                  <td className="p-5 text-right">
                                     <div className="flex items-center justify-end space-x-2">
                                        <button className="p-2 text-slate-500 hover:text-blue-500 transition-colors"><Edit2 size={16} /></button>
                                        <button className="p-2 text-slate-500 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                     </div>
                                  </td>
                              </tr>
                            );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="space-y-4">
           {/* LOG STATS PANEL */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                 <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Events</p>
                 <p className="text-xl font-mono font-black text-white">{logStats.total}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                 <p className="text-[9px] text-rose-500 font-black uppercase tracking-widest mb-1">Security Alerts</p>
                 <p className="text-xl font-mono font-black text-rose-400">{logStats.security}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                 <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest mb-1">Trade Actions</p>
                 <p className="text-xl font-mono font-black text-blue-400">{logStats.trade}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                 <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mb-1">System Status</p>
                 <p className="text-xl font-mono font-black text-emerald-400">{logStats.system}</p>
              </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 bg-slate-800/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="flex items-center">
                    <History size={18} className="mr-3 text-purple-500" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Perfect Audit Trail</h3>
                 </div>
                 <div className="flex items-center space-x-2 overflow-x-auto">
                    {(['ALL', 'SECURITY', 'TRADE', 'SYSTEM'] as const).map(type => (
                       <button 
                         key={type}
                         onClick={() => setLogFilter(type)}
                         className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${logFilter === type ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'}`}
                       >
                         {type}
                       </button>
                    ))}
                    <button className="p-2 text-slate-500 hover:text-white"><Download size={14} /></button>
                 </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                 <table className="w-full text-left text-[10px]">
                     <thead className="bg-slate-950/80 text-slate-500 font-black uppercase text-[9px] tracking-widest border-b border-slate-800 sticky top-0 z-10">
                         <tr>
                             <th className="p-4">Time (IST)</th>
                             <th className="p-4">Entity</th>
                             <th className="p-4">Audit Category</th>
                             <th className="p-4 pr-6">Activity Execution Details</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800">
                         {filteredLogs.length > 0 ? filteredLogs.map((log, idx) => {
                            const isSecurity = log.type === 'SECURITY';
                            const isTrade = log.type === 'TRADE';
                            const isSystem = log.type === 'SYSTEM';

                            return (
                             <tr key={idx} className={`hover:bg-slate-800/20 transition-colors ${isSecurity ? 'bg-rose-500/5' : ''}`}>
                                 <td className="p-4 font-mono text-slate-500 whitespace-nowrap">
                                    <div className="flex items-center space-x-2">
                                       <Clock size={10} />
                                       <span>{new Date(log.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, day: '2-digit', month: 'short' })}</span>
                                    </div>
                                 </td>
                                 <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                       <UserCheck size={12} className="text-slate-600" />
                                       <span className="font-black text-white">{log.user}</span>
                                    </div>
                                 </td>
                                 <td className="p-4">
                                   <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border flex items-center w-fit space-x-1.5 ${
                                     isSecurity ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 
                                     isTrade ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                     'bg-slate-800 text-slate-400 border-slate-700'
                                   }`}>
                                     {isSecurity ? <ShieldCheck size={8} /> : isTrade ? <Activity size={8} /> : <Terminal size={8} />}
                                     <span>{log.action}</span>
                                   </span>
                                 </td>
                                 <td className="p-4 pr-6 text-slate-400 font-mono text-[9px] leading-relaxed">
                                   <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50">
                                      {log.details || 'NO_METADATA_AVAILABLE'}
                                   </div>
                                 </td>
                             </tr>
                            );
                         }) : <tr><td colSpan={4} className="p-20 text-center text-slate-600 uppercase font-black tracking-widest opacity-20">Audit Trail is Empty</td></tr>}
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
