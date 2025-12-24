
import React, { useMemo, useEffect, useRef } from 'react';
import SignalCard from '../components/SignalCard';
import { Bell, List, Clock, Zap, Activity, ExternalLink, TrendingUp } from 'lucide-react';
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

  // Helper to check if a date is Today or Yesterday in IST
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

      // Strictly only show Today and Yesterday
      if (!isRecent) return false;

      const isLive = signal.status === TradeStatus.ACTIVE || signal.status === TradeStatus.PARTIAL;
      if (isLive) return true;

      // For closed trades, also check the grace period
      const closeTimeStr = signal.lastTradedTimestamp || signal.timestamp;
      const closeDateObj = new Date(closeTimeStr);
      return (now.getTime() - closeDateObj.getTime()) < GRACE_PERIOD_MS;
    });
  }, [signals]);

  const sortedSignals = useMemo(() => {
    return [...liveSignals].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      const indexA = a.sheetIndex ?? 0;
      const indexB = b.sheetIndex ?? 0;
      return indexB - indexA;
    });
  }, [liveSignals]);

  const latestSignal = sortedSignals[0];
  const lastScrolledId = useRef<string | null>(null);

  useEffect(() => {
    const updatedIds = Object.keys(granularHighlights).filter(id => 
      liveSignals.some(s => s.id === id)
    );
    
    if (updatedIds.length > 0) {
      const targetId = updatedIds[0];
      if (lastScrolledId.current !== targetId) {
        const element = document.getElementById(`signal-${targetId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          lastScrolledId.current = targetId;
          setTimeout(() => { lastScrolledId.current = null; }, 2000);
        }
      }
    }
  }, [granularHighlights, liveSignals]);

  const isBannerActive = latestSignal && (latestSignal.status === TradeStatus.ACTIVE || latestSignal.status === TradeStatus.PARTIAL);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <Activity size={24} className="mr-2 text-emerald-500" />
            Live Trading Floor
          </h2>
          <p className="text-slate-400 text-sm font-mono tracking-tighter">
            <i className="font-bold">Tension free trading</i>
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
            <div className="flex items-center px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold text-slate-500">
              <Clock size={12} className="mr-1.5 text-blue-500" />
              IST Today: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </div>
            
            <a 
              href="https://oa.mynt.in/?ref=ZTN348" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-lg transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-900/20"
            >
                <TrendingUp size={16} className="mr-2" />
                Open Demat
            </a>

            <button className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors text-sm font-medium">
                <Bell size={18} className="mr-2 text-yellow-500" />
                Alerts
            </button>
        </div>
      </div>

      {isBannerActive && (
        <div className="relative group overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-1">
          <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
            <Zap size={60} className="text-emerald-500" />
          </div>
          <div className="bg-slate-950/80 backdrop-blur-sm rounded-lg p-4 flex flex-col sm:row items-start sm:items-center justify-between border border-emerald-500/20">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 animate-pulse">
                <Zap size={20} fill="currentColor" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded uppercase tracking-tighter">Latest Update</span>
                  <span className="text-xs font-mono text-slate-500">
                    {new Date(latestSignal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white font-mono uppercase tracking-tight">
                  {latestSignal.instrument} {latestSignal.symbol} {latestSignal.type} @ {latestSignal.entryPrice}
                </h3>
              </div>
            </div>
            <div className="mt-3 sm:mt-0 flex items-center space-x-3">
              <button 
                onClick={() => document.getElementById(`signal-${latestSignal.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 order-2 lg:order-1">
              {sortedSignals.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl">
                      <Zap size={40} className="mx-auto text-slate-800 mb-4" />
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-sm italic">No activity in last 48 hours</p>
                      <p className="text-[10px] text-slate-700 mt-2 uppercase tracking-widest font-mono">Terminal Standby • Monitoring Markets</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sortedSignals.map((signal) => {
                        const hasHighlight = !!granularHighlights[signal.id];
                        const isRecentlyClosed = signal.status === TradeStatus.EXITED || signal.status === TradeStatus.STOPPED || signal.status === TradeStatus.ALL_TARGET;
                        
                        return (
                          <div 
                            key={signal.id} 
                            id={`signal-${signal.id}`} 
                            className={`transition-all duration-500 ${hasHighlight ? 'animate-blink' : ''}`}
                          >
                            <SignalCard 
                                signal={signal} 
                                user={user} 
                                highlights={granularHighlights[signal.id]} 
                                onSignalUpdate={onSignalUpdate}
                                isRecentlyClosed={isRecentlyClosed}
                            />
                          </div>
                        );
                    })}
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
                    {watchlist.length > 0 ? watchlist.map((item, idx) => {
                        const hasHighlight = !!granularHighlights[item.symbol];
                        return (
                            <div 
                                key={idx} 
                                className={`p-4 flex items-center justify-between transition-all duration-500 hover:bg-slate-800/50 ${hasHighlight ? 'animate-blink' : ''}`}
                            >
                                <div>
                                    <p className="font-bold text-sm text-slate-200">{item.symbol}</p>
                                    <div className="flex items-center mt-1 text-slate-500">
                                        <Clock size={10} className="mr-1" />
                                        <span className="text-[10px] font-mono">{item.lastUpdated || '--'}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm text-white font-medium">{item.price.toLocaleString()}</p>
                                    <p className={`text-xs font-mono mt-0.5 ${item.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {item.isPositive ? '+' : ''}{item.change}%
                                    </p>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="p-4 text-center text-slate-500 text-sm">
                            Scanning market...
                        </div>
                    )}
                </div>
             </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
