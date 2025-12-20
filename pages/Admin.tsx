import React, { useState } from 'react';
import { WatchlistItem, TradeSignal, OptionType, TradeStatus, User } from '../types';
import { Plus, Trash2, Edit2, List, X, Check, Radio, UserCheck, RefreshCw, Smartphone, Search, Calendar, ShieldCheck, UserPlus, Clock, Target } from 'lucide-react';
import { updateSheetData } from '../services/googleSheetsService';

interface AdminProps {
  watchlist: WatchlistItem[];
  onUpdateWatchlist: (list: WatchlistItem[]) => void;
  signals: TradeSignal[];
  onUpdateSignals: (list: TradeSignal[]) => void;
  users: User[];
  onUpdateUsers: (list: User[]) => void;
}

const Admin: React.FC<AdminProps> = ({ watchlist, onUpdateWatchlist, signals, onUpdateSignals, users, onUpdateUsers }) => {
  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'WATCHLIST' | 'CLIENTS'>('SIGNALS');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Watchlist State ---
  const [isAddingWatch, setIsAddingWatch] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newChange, setNewChange] = useState('');

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

  const [editingSignalId, setEditingSignalId] = useState<string | null>(null);
  const [editSigStatus, setEditSigStatus] = useState<TradeStatus>(TradeStatus.ACTIVE);
  const [editSigPnl, setEditSigPnl] = useState('');
  const [editSigPnlRupees, setEditSigPnlRupees] = useState('');
  const [editSigTrail, setEditSigTrail] = useState('');
  const [editSigTargetsHit, setEditSigTargetsHit] = useState<number>(0);

  // User management state
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserExpiry, setNewUserExpiry] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  const handleAddSignal = async () => {
    if (!sigSymbol || !sigEntry || !sigSL) return;
    setIsSaving(true);
    const targets = sigTargets.split(',').map(t => parseFloat(t.trim())).filter(n => !isNaN(n));
    const newSignal: TradeSignal = {
        id: `SIG-${Date.now().toString().slice(-4)}`,
        instrument: sigInstrument,
        symbol: sigSymbol,
        type: sigType,
        action: sigAction,
        entryPrice: parseFloat(sigEntry),
        stopLoss: parseFloat(sigSL),
        targets: targets.length > 0 ? targets : [parseFloat(sigEntry) * 1.1],
        targetsHit: 0,
        status: TradeStatus.ACTIVE,
        timestamp: new Date().toISOString(),
        comment: sigComment
    };

    const success = await updateSheetData('signals', 'ADD', newSignal);
    if (success) {
      onUpdateSignals([newSignal, ...signals]);
      setSigSymbol(''); setSigEntry(''); setSigSL(''); setSigTargets(''); setSigComment('');
      setIsAddingSignal(false);
    }
    setIsSaving(false);
  };

  const saveSignalEdit = async () => {
    if (!editingSignalId) return;
    setIsSaving(true);
    const updatedSignal = signals.find(s => s.id === editingSignalId);
    if (updatedSignal) {
        const payload = {
            ...updatedSignal,
            status: editSigStatus,
            pnlPoints: editSigPnl ? parseFloat(editSigPnl) : undefined,
            pnlRupees: editSigPnlRupees ? parseFloat(editSigPnlRupees) : undefined,
            trailingSL: editSigTrail ? parseFloat(editSigTrail) : undefined,
            targetsHit: editSigTargetsHit
        };
        const success = await updateSheetData('signals', 'UPDATE_SIGNAL', payload, editingSignalId);
        if (success) {
          onUpdateSignals(signals.map(s => s.id === editingSignalId ? payload : s));
        }
    }
    setEditingSignalId(null);
    setIsSaving(false);
  };

  const handleAddWatch = async () => {
    if (!newSymbol || !newPrice || !newChange) return;
    setIsSaving(true);
    const newItem: WatchlistItem = {
      symbol: newSymbol.toUpperCase(),
      price: parseFloat(newPrice),
      change: parseFloat(newChange),
      isPositive: parseFloat(newChange) >= 0,
      lastUpdated: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', 
        minute:'2-digit', 
        second: '2-digit',
        hour12: true
      })
    };
    const success = await updateSheetData('watchlist', 'ADD', newItem);
    if (success) {
      onUpdateWatchlist([...watchlist, newItem]);
      setNewSymbol(''); setNewPrice(''); setNewChange(''); setIsAddingWatch(false);
    }
    setIsSaving(false);
  };

  const handleAddUser = async () => {
    if (!newUserPhone || !newUserName) return;
    setIsSaving(true);
    const newUser: User = {
        id: `USR-${Date.now().toString().slice(-4)}`,
        name: newUserName,
        phoneNumber: newUserPhone,
        password: newUserPass || '123456',
        expiryDate: newUserExpiry,
        isAdmin: false,
        deviceId: null
    };
    const success = await updateSheetData('users', 'ADD', newUser, undefined);
    if (success) {
      onUpdateUsers([newUser, ...users]);
      setIsAddingUser(false);
      setNewUserName(''); setNewUserPhone(''); setNewUserPass('');
    }
    setIsSaving(false);
  };

  const handleResetDevice = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setIsSaving(true);
    const updatedUser = { ...user, deviceId: null };
    const success = await updateSheetData('users', 'UPDATE_USER', updatedUser, userId);
    if (success) {
      onUpdateUsers(users.map(u => u.id === userId ? updatedUser : u));
    }
    setIsSaving(false);
  };

  const handleExtendAccess = async (userId: string, days: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setIsSaving(true);
    const currentExpiry = new Date(user.expiryDate);
    currentExpiry.setDate(currentExpiry.getDate() + days);
    const updatedUser = { ...user, expiryDate: currentExpiry.toISOString().split('T')[0] };
    const success = await updateSheetData('users', 'UPDATE_USER', updatedUser, userId);
    if (success) {
      onUpdateUsers(users.map(u => u.id === userId ? updatedUser : u));
    }
    setIsSaving(false);
  };

  const handleDeleteUser = async (userId: string) => {
      if (!confirm('Are you sure you want to delete this client?')) return;
      setIsSaving(true);
      const success = await updateSheetData('users', 'DELETE_USER', null, userId);
      if (success) {
        onUpdateUsers(users.filter(u => u.id !== userId));
      }
      setIsSaving(false);
  };

  const filteredUsers = (users || []).filter(u => 
      (u.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
      (u.phoneNumber || '').includes(searchQuery || '')
  );

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Institutional Control</h2>
            <p className="text-slate-400 text-sm">System administration and client lifecycle management.</p>
        </div>
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 mt-4 md:mt-0">
            {[
              { id: 'SIGNALS', icon: Radio, label: 'Signals' },
              { id: 'WATCHLIST', icon: List, label: 'Market' },
              { id: 'CLIENTS', icon: UserCheck, label: 'Clients' }
            ].map((tab) => (
              <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                  <tab.icon size={14} className="mr-2" />
                  {tab.label}
              </button>
            ))}
        </div>
      </div>

      {activeTab === 'SIGNALS' && (
          <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                  <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                      <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><Radio size={20} /></div>
                          <h3 className="text-lg font-bold text-white">Signal Dispatch</h3>
                      </div>
                      <button onClick={() => setIsAddingSignal(!isAddingSignal)} className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-colors ${isAddingSignal ? 'bg-slate-700 text-white' : 'bg-blue-600 text-white'}`}>
                          {isAddingSignal ? <X size={14} className="mr-2" /> : <Plus size={14} className="mr-2" />}
                          {isAddingSignal ? 'Cancel' : 'New Signal'}
                      </button>
                  </div>

                  {isAddingSignal && (
                      <div className="p-6 bg-slate-800/30 border-b border-slate-800">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 text-xs font-bold text-slate-500">
                              <div>
                                  <label className="block mb-1 text-[10px] uppercase">Instrument</label>
                                  <select value={sigInstrument} onChange={e => setSigInstrument(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white">
                                      <option value="NIFTY">NIFTY</option>
                                      <option value="BANKNIFTY">BANKNIFTY</option>
                                      <option value="FINNIFTY">FINNIFTY</option>
                                      <option value="MIDCPNIFTY">MIDCPNIFTY</option>
                                      <option value="STOCK">STOCK</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block mb-1 text-[10px] uppercase">Strike</label>
                                  <input type="text" value={sigSymbol} onChange={e => setSigSymbol(e.target.value)} placeholder="22500" className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white" />
                              </div>
                              <div>
                                  <label className="block mb-1 text-[10px] uppercase">Type</label>
                                  <select value={sigType} onChange={e => setSigType(e.target.value as OptionType)} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white">
                                      <option value="CE">CE</option>
                                      <option value="PE">PE</option>
                                      <option value="FUT">FUT</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block mb-1 text-[10px] uppercase">Action</label>
                                  <div className="flex bg-slate-950 rounded p-1 border border-slate-700">
                                      <button onClick={() => setSigAction('BUY')} className={`flex-1 py-1.5 rounded text-[10px] font-bold ${sigAction === 'BUY' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>BUY</button>
                                      <button onClick={() => setSigAction('SELL')} className={`flex-1 py-1.5 rounded text-[10px] font-bold ${sigAction === 'SELL' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>SELL</button>
                                  </div>
                              </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 text-xs font-bold text-slate-500">
                              <div>
                                  <label className="block mb-1 text-[10px] uppercase">Entry Price</label>
                                  <input type="number" value={sigEntry} onChange={e => setSigEntry(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white" />
                              </div>
                              <div>
                                  <label className="block mb-1 text-[10px] uppercase">Stop Loss</label>
                                  <input type="number" value={sigSL} onChange={e => setSigSL(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white" />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="block mb-1 text-[10px] uppercase">Targets (e.g. 100, 110, 120)</label>
                                  <input type="text" value={sigTargets} onChange={e => setSigTargets(e.target.value)} placeholder="100, 110, 120" className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white" />
                              </div>
                          </div>
                          <div className="mb-4">
                              <label className="block mb-1 text-[10px] uppercase font-bold text-slate-500">Comments</label>
                              <input type="text" value={sigComment} onChange={e => setSigComment(e.target.value)} placeholder="Strong breakout setup..." className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-xs" />
                          </div>
                          <button onClick={handleAddSignal} disabled={isSaving} className="w-full bg-emerald-600 py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center transition-all hover:bg-emerald-500 disabled:opacity-50">
                              {isSaving ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Check className="mr-2" size={16} />}
                              {isSaving ? 'Processing...' : 'Broadcast Signal'}
                          </button>
                      </div>
                  )}

                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-slate-800/50 text-[10px] uppercase font-bold text-slate-500">
                              <tr>
                                  <th className="p-4 pl-6">Trade Details</th>
                                  <th className="p-4">Status</th>
                                  <th className="p-4">Target Progress</th>
                                  <th className="p-4">P&L Points</th>
                                  <th className="p-4 text-right pr-6">Action</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                              {signals.map(s => (
                                  <tr key={s.id} className={`hover:bg-slate-800/30 transition-colors ${editingSignalId === s.id ? 'bg-blue-900/10' : ''}`}>
                                      <td className="p-4 pl-6">
                                          <div className="font-bold text-white text-sm">{s.instrument} {s.symbol}</div>
                                          <div className="text-[10px] text-slate-500 font-mono flex items-center mt-0.5">
                                              <span className={`px-1 rounded mr-1.5 ${s.action === 'BUY' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400'}`}>{s.action}</span>
                                              {s.type} @ {s.entryPrice}
                                          </div>
                                      </td>
                                      <td className="p-4">
                                          {editingSignalId === s.id ? (
                                              <select value={editSigStatus} onChange={e => setEditSigStatus(e.target.value as TradeStatus)} className="bg-slate-950 border border-blue-500 rounded text-xs p-1.5 text-white w-32 focus:outline-none">
                                                  {Object.values(TradeStatus).map(st => <option key={st} value={st}>{st}</option>)}
                                              </select>
                                          ) : <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                              s.status === TradeStatus.ACTIVE ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' :
                                              s.status === TradeStatus.EXITED ? 'border-slate-700 text-slate-500 bg-slate-800' :
                                              'border-rose-500/30 text-rose-400 bg-rose-500/5'
                                          }`}>{s.status}</span>}
                                      </td>
                                      <td className="p-4">
                                          {editingSignalId === s.id ? (
                                              <div className="flex items-center space-x-2">
                                                  <Target size={14} className="text-slate-500" />
                                                  <select value={editSigTargetsHit} onChange={e => setEditSigTargetsHit(Number(e.target.value))} className="bg-slate-950 border border-blue-500 rounded text-xs p-1.5 text-white w-16 focus:outline-none">
                                                      <option value={0}>None</option>
                                                      <option value={1}>T1</option>
                                                      <option value={2}>T2</option>
                                                      <option value={3}>T3</option>
                                                  </select>
                                              </div>
                                          ) : (
                                              <div className="flex items-center space-x-1">
                                                  {[1, 2, 3].map(i => (
                                                      <div key={i} className={`w-2 h-2 rounded-full ${ (s.targetsHit || 0) >= i ? 'bg-emerald-500 animate-pulse' : 'bg-slate-800' }`}></div>
                                                  ))}
                                                  <span className="text-[10px] text-slate-500 ml-1">{(s.targetsHit || 0)}/3</span>
                                              </div>
                                          )}
                                      </td>
                                      <td className="p-4">
                                          {editingSignalId === s.id ? (
                                              <div className="flex space-x-2">
                                                  <input type="number" value={editSigPnl} onChange={e => setEditSigPnl(e.target.value)} placeholder="Pts" className="w-16 bg-slate-950 border border-blue-500 rounded p-1.5 text-xs text-white" />
                                                  <input type="number" value={editSigPnlRupees} onChange={e => setEditSigPnlRupees(e.target.value)} placeholder="INR" className="w-20 bg-slate-950 border border-blue-500 rounded p-1.5 text-xs text-white" />
                                              </div>
                                          ) : (
                                              <div className="flex flex-col">
                                                  <span className={`text-xs font-mono font-bold ${ (s.pnlPoints || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400' }`}>
                                                      {s.pnlPoints ? (s.pnlPoints > 0 ? `+${s.pnlPoints}` : s.pnlPoints) : '--'}
                                                  </span>
                                                  {s.pnlRupees !== undefined && <span className="text-[9px] font-mono text-slate-600">₹{s.pnlRupees.toLocaleString()}</span>}
                                              </div>
                                          )}
                                      </td>
                                      <td className="p-4 text-right pr-6">
                                          {editingSignalId === s.id ? (
                                              <div className="flex items-center justify-end space-x-2">
                                                  <button onClick={saveSignalEdit} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/40 transition-colors" title="Save Changes"><Check size={14} /></button>
                                                  <button onClick={() => setEditingSignalId(null)} className="p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 transition-colors" title="Cancel"><X size={14} /></button>
                                              </div>
                                          ) : (
                                              <button onClick={() => {
                                                  setEditingSignalId(s.id); 
                                                  setEditSigStatus(s.status); 
                                                  setEditSigPnl(s.pnlPoints?.toString() || '');
                                                  setEditSigPnlRupees(s.pnlRupees?.toString() || '');
                                                  setEditSigTrail(s.trailingSL?.toString() || '');
                                                  setEditSigTargetsHit(s.targetsHit || 0);
                                              }} className="text-blue-400 hover:text-blue-300 transition-colors p-2 rounded-lg hover:bg-blue-500/10">
                                                  <Edit2 size={16} />
                                              </button>
                                          )}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'WATCHLIST' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><List size={20} /></div>
                    <h3 className="text-lg font-bold text-white">Market Watch Configuration</h3>
                </div>
                <button onClick={() => setIsAddingWatch(!isAddingWatch)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center transition-all">
                    {isAddingWatch ? <X size={14} className="mr-2" /> : <Plus size={14} className="mr-2" />} 
                    {isAddingWatch ? 'Cancel' : 'Add Item'}
                </button>
            </div>
            <div className="p-5">
                {isAddingWatch && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Index/Symbol</label>
                            <input type="text" value={newSymbol} onChange={e => setNewSymbol(e.target.value)} placeholder="NIFTY 50" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">LTP</label>
                            <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="22450.30" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">% Change</label>
                            <input type="number" value={newChange} onChange={e => setNewChange(e.target.value)} placeholder="0.45" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-blue-500 outline-none" />
                        </div>
                        <div className="flex items-end">
                            <button onClick={handleAddWatch} disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-xs font-bold transition-all disabled:opacity-50">
                                {isSaving ? 'Saving...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50 text-[10px] uppercase font-bold text-slate-500">
                            <tr>
                                <th className="p-4 pl-6">Index</th>
                                <th className="p-4">Last Traded Price</th>
                                <th className="p-4">Daily Change</th>
                                <th className="p-4 text-right pr-6">Updated At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {watchlist.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="p-4 pl-6 font-bold text-white text-sm">{item.symbol}</td>
                                    <td className="p-4 font-mono text-sm text-slate-300">₹{item.price.toLocaleString()}</td>
                                    <td className={`p-4 font-mono text-sm font-bold ${item.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {item.isPositive ? '+' : ''}{item.change}%
                                    </td>
                                    <td className="p-4 text-right pr-6 text-[10px] font-mono text-slate-600">
                                        {item.lastUpdated || '--'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'CLIENTS' && (
          <div className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">Total Clients</p>
                      <p className="text-3xl font-bold text-white">{(users || []).length}</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">Active Subs</p>
                      <p className="text-3xl font-bold text-emerald-400">{(users || []).filter(u => new Date(u.expiryDate) > new Date()).length}</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">Expired</p>
                      <p className="text-3xl font-bold text-rose-500">{(users || []).filter(u => new Date(u.expiryDate) <= new Date()).length}</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">Security Roles</p>
                      <p className="text-3xl font-bold text-blue-400">{(users || []).filter(u => u.isAdmin).length} Admins</p>
                  </div>
              </div>

              {/* Client Directory */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                  <div className="p-5 border-b border-slate-800 bg-slate-800/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div className="relative w-full md:w-96">
                          <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                          <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, phone or UID..." 
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-11 pr-4 text-sm text-white focus:border-blue-500 outline-none transition-all shadow-inner"
                          />
                      </div>
                      <button 
                        onClick={() => setIsAddingUser(!isAddingUser)}
                        className="w-full md:w-auto flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/40 transition-all"
                      >
                          <UserPlus size={16} className="mr-2" />
                          Register New Client
                      </button>
                  </div>

                  {isAddingUser && (
                      <div className="p-6 bg-slate-800/30 border-b border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-5 animate-in slide-in-from-top-4">
                          <div>
                              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider">Full Name</label>
                              <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Full Name" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                          </div>
                          <div>
                              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider">Mobile Number</label>
                              <input type="tel" value={newUserPhone} onChange={e => setNewUserPhone(e.target.value)} placeholder="9876543210" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                          </div>
                          <div>
                              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5 tracking-wider">Password</label>
                              <input type="text" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} placeholder="Passphrase" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                          </div>
                          <div className="flex items-end">
                              <button onClick={handleAddUser} disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center transition-all disabled:opacity-50">
                                  {isSaving ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Check size={16} className="mr-2" />}
                                  {isSaving ? 'Creating...' : 'Finalize Access'}
                              </button>
                          </div>
                      </div>
                  )}

                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-slate-800/50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">
                              <tr>
                                  <th className="p-4 pl-6">Client Identity</th>
                                  <th className="p-4">Subscription Status</th>
                                  <th className="p-4">Hardware Binding</th>
                                  <th className="p-4 text-right pr-6">Management</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                              {filteredUsers.map(u => {
                                  const isExpired = new Date(u.expiryDate) <= new Date();
                                  const expiresSoon = !isExpired && (new Date(u.expiryDate).getTime() - Date.now()) < (7 * 24 * 60 * 60 * 1000);

                                  return (
                                    <tr key={u.id} className="hover:bg-slate-800/20 group transition-all">
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mr-3 font-bold text-sm shadow-inner ${u.isAdmin ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                                    {(u.name || '?').charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-sm flex items-center">
                                                        {u.name || 'Premium User'}
                                                        {u.isAdmin && <ShieldCheck size={12} className="ml-1.5 text-blue-400" />}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-slate-500 flex items-center mt-0.5">
                                                        <Clock size={8} className="mr-1" />
                                                        {u.phoneNumber}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <div className={`text-[10px] font-black mb-1 px-1.5 py-0.5 rounded w-fit ${isExpired ? 'bg-rose-900/30 text-rose-500 border border-rose-900/50' : expiresSoon ? 'bg-amber-900/30 text-amber-500 border border-amber-900/50' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50'}`}>
                                                    {isExpired ? 'ACCESS EXPIRED' : expiresSoon ? 'EXPIRES SOON' : 'ACTIVE SUBSCRIPTION'}
                                                </div>
                                                <div className="flex items-center text-[10px] text-slate-500 font-mono mt-1">
                                                    <Calendar size={10} className="mr-1.5" />
                                                    Ends: {u.expiryDate}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <div className={`flex items-center text-[10px] font-bold mb-1.5 ${u.deviceId ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                    <Smartphone size={11} className={`mr-1.5 ${u.deviceId ? 'text-emerald-500' : 'text-slate-600'}`} />
                                                    {u.deviceId ? 'DEVICE BOUND' : 'NO DEVICE LINKED'}
                                                </div>
                                                {u.deviceId ? (
                                                    <button 
                                                        onClick={() => handleResetDevice(u.id)}
                                                        disabled={isSaving}
                                                        className="text-[9px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest text-left transition-colors flex items-center"
                                                    >
                                                        <RefreshCw size={8} className="mr-1" /> Release Lock
                                                    </button>
                                                ) : <span className="text-[9px] text-slate-600 uppercase font-bold tracking-tighter">Auto-locks on first login</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button 
                                                    onClick={() => handleExtendAccess(u.id, 30)}
                                                    className="p-2 bg-slate-800 hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-400 rounded-lg transition-all"
                                                    title="Extend 30 Days"
                                                >
                                                    <Calendar size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    className="p-2 bg-slate-800 hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                                                    title="Terminate Access"
                                                >
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
    </div>
  );
};

export default Admin;