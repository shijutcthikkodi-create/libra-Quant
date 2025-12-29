
import React, { useMemo, useRef } from 'react';
import SignalCard from '../components/SignalCard';
import { Bell, List, Clock, Zap, Activity, ExternalLink, TrendingUp, Moon, ShieldAlert } from 'lucide-react';
import { WatchlistItem, TradeSignal, User, TradeStatus } from '../types';
import { GranularHighlights } from '../App';

interface DashboardProps {
  watchlist: WatchlistItem[];
  signals: (TradeSignal & { sheetIndex?: number })[];
  user: User;
  granularHighlights: GranularHighlights;
  onSignalUpdate: (updated: TradeSignal) => Promise<boolean>;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  watchlist, 
  signals, 
  user, 
  granularHighlights,
  onSignalUpdate
}) => {
  const GRACE_PERIOD_MS = 60 * 1000;

  const isTodayOrYesterdayIST = (date: Date) => {
    if (!date || isNaN(date.getTime())) return false;
    const now = new Date();
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    
    const todayStr = fmt(now);
    const targetStr = fmt(date);
    
    if (todayStr === targetStr) return true;
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = fmt(yesterday);
    
    return targetStr === yesterdayStr;
  };

  const liveSignals = useMemo(() => {
    const now = new Date();

    return (signals || []).filter(signal => {
      const signalDate = new Date(signal.timestamp);
      const isRecent = isTodayOrYesterdayIST(signalDate);

      if (!isRecent) return false;

      const isLive = signal.status === TradeStatus.ACTIVE || signal.status === TradeStatus.PARTIAL;
      if (isLive) return true;

      const closeTimeStr = signal.lastTradedTimestamp || signal.timestamp;
      const closeDateObj = new Date(closeTimeStr);
      return (now.getTime() - closeDateObj.getTime()) < GRACE_PERIOD_MS;
    });
  }, [signals]);

  const activeBTSTs = useMemo(() => {
    return liveSignals.filter(s => s.isBTST && (s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL));
  }, [liveSignals]);

  const otherLiveSignals = useMemo(() => {
    return liveSignals.filter(s => !s.isBTST || (s.status !== TradeStatus.ACTIVE && s.status !== TradeStatus.PARTIAL));
  }, [liveSignals]);

  const sortedSignals = useMemo(() => {
    return [...otherLiveSignals].sort((a, b) => {
      const activityA = Math.max(new Date(a.timestamp).getTime(), new Date(a.lastTradedTimestamp || 0).getTime());
      const activityB = Math.max(new Date(b.timestamp).getTime(), new Date(b.lastTradedTimestamp || 0).getTime());
      if (activityA !== activityB) return (isNaN(activityB) ? 0 : activityB) - (isNaN(activityA) ? 0 : activityA);
      const indexA = a.sheetIndex ?? 0;
      const indexB = b.sheetIndex ?? 0;
      return indexB - indexA;
    });
  }, [otherLiveSignals]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <Activity size={24} className="mr-2 text-emerald-500" />
            Live Trading Floor
          </h2>
          <p className="text-slate-400 text-sm font-mono tracking-tighter italic">Tension free trading</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
            <div className="flex items-center px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold text-slate-500">
              <Clock size={12} className="mr-1.5 text-blue-500" />
              IST Today: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </div>
            <a href="https://oa.mynt.in/?ref=ZTN348" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-lg transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-900/20">
                <TrendingUp size={16} className="mr-2" /> Open Demat
            </a>
        </div>
      </div>

      {/* SPECIAL BTST TERMINAL SECTION */}
      {activeBTSTs.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center space-x-3 px-1">
             <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 animate-pulse border border-amber-500/30">
                <Moon size={22} fill="currentColor" />
             </div>
             <div>
               <h3 className="text-sm font-black text-amber-500 uppercase tracking-[0.2em] leading-none mb-1">Active BTST Terminal</h3>
               <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Priority overnight monitoring enabled</p>
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeBTSTs.map(signal => (
              <div key={signal.id} id={`signal-${signal.id}`}>
                <SignalCard 
                    signal={signal} 
                    user={user} 
                    highlights={granularHighlights[signal.id]} 
                    onSignalUpdate={onSignalUpdate}
                />
              </div>
            ))}
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent my-6"></div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 order-2 lg:order-1">
              <div className="mb-4 flex items-center space-x-2 px-1">
                 <Zap size={16} className="text-emerald-500" />
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Market Feed</h3>
              </div>
              {sortedSignals.length === 0 && activeBTSTs.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl">
                      <Zap size={40} className="mx-auto text-slate-800 mb-4" />
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-sm italic">Scanning terminal Truth...</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sortedSignals.map((signal) => (
                      <div key={signal.id} id={`signal-${signal.id}`}>
                        <SignalCard 
                            signal={signal} 
                            user={user} 
                            highlights={granularHighlights[signal.id]} 
                            onSignalUpdate={onSignalUpdate}
                            isRecentlyClosed={signal.status === TradeStatus.EXITED || signal.status === TradeStatus.STOPPED || signal.status === TradeStatus.ALL_TARGET}
                        />
                      </div>
                    ))}
                  </div>
              )}
          </div>

          <div className="w-full lg:w-80 shrink-0 order-1 lg:order-2 space-y-4">
             <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden sticky top-4 shadow-2xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur">
                    <div className="flex items-center space-x-2">
                        <List size={16} className="text-blue-400" />
                        <h3 className="font-bold text-white text-sm uppercase tracking-widest">Watch List</h3>
                    </div>
                </div>
                <div className="divide-y divide-slate-800">
                    {watchlist.length > 0 ? watchlist.map((item, idx) => (
                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                            <div>
                                <p className="font-bold text-sm text-slate-200">{item.symbol}</p>
                                <div className="flex items-center mt-1 text-slate-500">
                                    <Clock size={10} className="mr-1" />
                                    <span className="text-[10px] font-mono">{item.lastUpdated || '--'}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-sm text-white font-medium">{Number(item.price || 0).toFixed(2)}</p>
                                <p className={`text-xs font-mono mt-0.5 ${item.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {item.isPositive ? '+' : ''}{Number(item.change || 0).toFixed(2)}%
                                </p>
                            </div>
                        </div>
                    )) : (
                        <div className="p-4 text-center text-slate-500 text-sm italic">Scanning market...</div>
                    )}
                </div>
             </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
