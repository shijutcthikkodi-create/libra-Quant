
import React, { useState, useMemo } from 'react';
import { WatchlistItem, TradeSignal, OptionType, TradeStatus, User, LogEntry } from '../types';
import { 
  Trash2, Edit2, Radio, UserCheck, RefreshCw, Smartphone, Search, 
  History, Zap, Loader2, AlertTriangle, Clock, ShieldCheck, Activity, 
  Terminal, Download, LogIn, Users, Monitor, Plus, Target, TrendingUp,
  ArrowUpCircle, ArrowDownCircle, ShieldAlert, Briefcase, ChevronRight, X, Database
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
  onHardSync?: () => Promise<void>;
}

const Admin: React.FC<AdminProps> = ({ signals, users, logs = [], onHardSync }) => {
  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'CLIENTS' | 'LOGS'>('SIGNALS');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'SECURITY' | 'TRADE' | 'SYSTEM' | 'LOGIN'>('ALL');

  // New Signal Form State
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
    const newSignal: any = {
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
        quantity: sigQty ? parseInt(sigQty) : 0,
        cmp: parseFloat(sigEntry)
    };

    const success = await updateSheetData('signals', 'ADD', newSignal);
    
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: 'SIGNAL_BROADCAST',
        details: `New: ${newSignal.instrument} ${newSignal.symbol}`,
        type: 'TRADE'
      });
      // Clear form
      setSigSymbol(''); setSigEntry(''); setSigSL(''); setSigTargets(''); setSigComment(''); setSigQty('');
      setIsAddingSignal(false);
    }
    setIsSaving(false);
  };

  const triggerQuickUpdate = async (signal: TradeSignal, updates: Partial<TradeSignal>, actionLabel: string) => {
    setIsSaving(true);
    const payload = { ...signal, ...updates, lastTradedTimestamp: new Date().toISOString() };
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', payload, signal.id);
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: `Trade ${actionLabel}`,
        details: `${signal.instrument}: ${updates.status || 'Updated'}`,
        type: 'TRADE'
      });
    }
    setIsSaving(false);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Admin Terminal</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">Order Execution • Client Management</p>
        </div>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 mt-4 md:mt-0 shadow-lg overflow-x-auto">
            {[
              { id: 'SIGNALS', icon: Radio, label: 'Live Trades' },
              { id: 'CLIENTS', icon: UserCheck, label: 'Subscribers' },
              { id: 'LOGS', icon: History, label: 'Audit Trail' }
            ].map((tab) => (
              <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  <tab.icon size={14} className="mr-2" />
                  {tab.label}
              </button>
            ))}
        </div>
      </div>

      {activeTab === 'SIGNALS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                    <div className="flex items-center">
                        <Plus size={18} className="mr-3 text-blue-500" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Broadcast Engine</h3>
                    </div>
                    {!isAddingSignal && (
                      <div className="flex space-x-2">
                        <button onClick={onHardSync} className="flex items-center px-4 py-2 rounded-lg bg-slate-800 text-blue-400 border border-blue-500/20 text-xs font-bold hover:bg-blue-500/10 transition-all">
                           <Database size={14} className="mr-2" />
                           Hard Sync
                        </button>
                        <button onClick={() => setIsAddingSignal(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-900/40 uppercase tracking-widest">
                            New Signal
                        </button>
                      </div>
                    )}
                </div>

                {isAddingSignal && (
                    <div className="p-6 bg-slate-950/40 space-y-6">
                        {/* Signal form fields here... same as original but Title Case for labels */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Instrument</label>
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
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Strike / Symbol</label>
                                <input type="text" value={sigSymbol} onChange={e => setSigSymbol(e.target.value)} placeholder="e.g. 22500" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Option Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['CE', 'PE', 'FUT'].map(t => (
                                        <button key={t} onClick={() => setSigType(t as any)} className={`py-2 text-xs font-bold rounded-lg border transition-all ${sigType === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Execution Action</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setSigAction('BUY')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${sigAction === 'BUY' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>Buy</button>
                                    <button onClick={() => setSigAction('SELL')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${sigAction === 'SELL' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>Sell</button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Entry Price</label>
                                <input type="number" value={sigEntry} onChange={e => setSigEntry(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Initial Stop Loss</label>
                                <input type="number" value={sigSL} onChange={e => setSigSL(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Take Profit Targets</label>
                                <input type="text" value={sigTargets} onChange={e => setSigTargets(e.target.value)} placeholder="e.g. 120, 140, 180" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 pt-2">
                            <button 
                                onClick={handleAddSignal} 
                                disabled={isSaving || !sigSymbol || !sigEntry} 
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl text-sm font-bold transition-all shadow-xl flex items-center justify-center uppercase tracking-widest"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Zap size={16} className="mr-2" />}
                                {isSaving ? 'Dispatching...' : 'Broadcast Signal'}
                            </button>
                            <button onClick={() => setIsAddingSignal(false)} className="px-6 py-4 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 transition-colors font-bold text-sm uppercase tracking-tighter">Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 bg-slate-800/10 flex justify-between items-center">
                    <div className="flex items-center">
                        <Activity size={18} className="mr-3 text-emerald-500" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Command Center ({activeSignals.length})</h3>
                    </div>
                </div>

                <div className="p-5">
                    {activeSignals.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                            <Briefcase size={32} className="mx-auto text-slate-800 mb-3" />
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No Active Command In System</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeSignals.map((s) => (
                                <div key={s.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row items-center justify-between gap-6 hover:border-slate-700 transition-all group">
                                    <div className="flex items-center space-x-4 w-full lg:w-auto">
                                        <div className={`p-2 rounded-xl ${s.action === 'BUY' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                                            {s.action === 'BUY' ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-0.5">
                                                <h4 className="font-mono font-bold text-white text-base">{s.instrument} {s.symbol}</h4>
                                                {s.isBTST && <span className="text-[8px] font-bold bg-amber-600/20 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-tighter">BTST</span>}
                                            </div>
                                            <div className="flex items-center space-x-3 text-xs font-medium text-slate-500 uppercase tracking-tighter">
                                                <span>Entry: ₹{s.entryPrice}</span>
                                                <span className="text-rose-500">Stop: ₹{s.stopLoss}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
                                        <button 
                                            onClick={() => triggerQuickUpdate(s, { targetsHit: (s.targetsHit || 0) + 1, status: TradeStatus.PARTIAL, comment: `Target ${(s.targetsHit || 0) + 1} Achieved!` }, "Target Update")}
                                            className="px-3 py-2 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-bold transition-all uppercase tracking-tighter"
                                        >
                                            Hit Target {(s.targetsHit || 0) + 1}
                                        </button>
                                        <button 
                                            onClick={() => triggerQuickUpdate(s, { status: TradeStatus.ALL_TARGET, comment: "Golden Trade! All targets successfully booked." }, "All Target")}
                                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold transition-all shadow-lg uppercase tracking-widest"
                                        >
                                            All Target Done
                                        </button>
                                        <button 
                                            onClick={() => triggerQuickUpdate(s, { status: TradeStatus.STOPPED, comment: "Stop Loss triggered." }, "Stop Loss")}
                                            className="px-3 py-2 bg-rose-900/20 hover:bg-rose-900/40 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold transition-all uppercase tracking-tighter"
                                        >
                                            SL Hit
                                        </button>
                                        <button 
                                            onClick={() => triggerQuickUpdate(s, { status: TradeStatus.EXITED, comment: "Exited manual at market price." }, "Manual Exit")}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold transition-all uppercase tracking-tighter"
                                        >
                                            Exit
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
    </div>
  );
};

export default Admin;
