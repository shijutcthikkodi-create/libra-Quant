
import React, { useMemo } from 'react';
import SignalCard from '../components/SignalCard';
import { Bell, List, Clock, Zap, Activity, ExternalLink, TrendingUp, Moon, ShieldAlert, Loader2, ShieldCheck, ArrowRight, Send, Timer } from 'lucide-react';
import { WatchlistItem, TradeSignal, User, TradeStatus } from '../types';
import { GranularHighlights } from '../App';

interface DashboardProps {
  watchlist: WatchlistItem[];
  signals: (TradeSignal & { sheetIndex?: number })[];
  user: User;
  granularHighlights: GranularHighlights;
  activeMajorAlerts: Record<string, number>;
  activeWatchlistAlerts: Record<string, number>;
  onSignalUpdate: (updated: TradeSignal) => Promise<boolean>;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  watchlist, 
  signals, 
  user, 
  granularHighlights,
  activeMajorAlerts,
  activeWatchlistAlerts,
  onSignalUpdate
}) => {
  const GRACE_PERIOD_MS = 60 * 1000;

  const parseFlexibleDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    
    // Handle DD-MM-YYYY or DD/MM/YYYY
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) { // DD-MM-YYYY
        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else if (parts[0].length === 4) { // YYYY-MM-DD
        d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
      }
    }
    return isNaN(d.getTime()) ? null : d;
  };

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

  /**
   * REFINED LATEST LOGIC: 
   * The "Last Given Trade" is strictly the bottom-most row in the sheet.
   */
  const lastGivenTrade = useMemo(() => {
    if (!signals || signals.length === 0) return null;
    // Always pick the one with the highest sheetIndex (literal last row)
    return [...signals].sort((a, b) => (b.sheetIndex ?? 0) - (a.sheetIndex ?? 0))[0];
  }, [signals]);

  const liveSignals = useMemo(() => {
    const now = new Date();

    return (signals || []).filter(signal => {
      const signalDate = parseFlexibleDate(signal.timestamp);
      if (!signalDate) return false;
      
      const isRecent = isTodayOrYesterdayIST(signalDate);
      if (!isRecent) return false;

      const isLive = signal.status === TradeStatus.ACTIVE || signal.status === TradeStatus.PARTIAL;
      if (isLive) return true;

      const closeTimeStr = signal.lastTradedTimestamp || signal.timestamp;
      const closeDateObj = parseFlexibleDate(closeTimeStr);
      return closeDateObj && (now.getTime() - closeDateObj.getTime()) < GRACE_PERIOD_MS;
    });
  }, [signals]);

  const sortedSignals = useMemo(() => {
    return [...liveSignals].sort((a, b) => {
      const dateA = parseFlexibleDate(a.timestamp)?.getTime() || 0;
      const dateB = parseFlexibleDate(b.timestamp)?.getTime() || 0;
      const activityA = Math.max(dateA, parseFlexibleDate(a.lastTradedTimestamp)?.getTime() || 0);
      const activityB = Math.max(dateB, parseFlexibleDate(b.lastTradedTimestamp)?.getTime() || 0);
      
      if (activityA !== activityB) return activityB - activityA;
      return (b.sheetIndex ?? 0) - (a.sheetIndex ?? 0);
    });
  }, [liveSignals]);

  const scrollToSignal = (id: string) => {
      const el = document.getElementById(`signal-${id}`);
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('animate-card-pulse');
          setTimeout(() => el.classList.remove('animate-card-pulse'), 3000);
      }
  };

  const timeSince = (timestamp: string) => {
    const tradeDate = parseFlexibleDate(timestamp);
    if (!tradeDate) return "LIVE";
    const seconds = Math.floor((new Date().getTime() - tradeDate.getTime()) / 1000);
    if (seconds < 60) return "JUST NOW";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}M AGO`;
    return `${Math.floor(seconds / 3600)}H AGO`;
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <Activity size={24} className="mr-2 text-emerald-500" />
            Live Trading Floor
          </h2>
          <p className="text-slate-400 text-sm font-mono tracking-tighter italic">Institutional Terminal Active</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
            <div className="flex items-center px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold text-slate-500">
              <Clock size={12} className="mr-1.5 text-blue-500" />
              IST Today: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </div>
            <div className="flex items-center px-4 py-2 bg-slate-900/50 border border-emerald-500/20 text-emerald-500 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest">
                <ShieldCheck size={14} className="mr-2" /> Verified Partner
            </div>
        </div>
      </div>

      {/* LAST GIVEN TRADE BANNER - ALWAYS LATEST ROW FROM SHEET */}
      {lastGivenTrade && (
        <div 
          onClick={() => scrollToSignal(lastGivenTrade.id)}
          className="relative group cursor-pointer overflow-hidden rounded-2xl border border-blue-500/40 bg-gradient-to-r from-slate-900 via-blue-900/40 to-slate-900 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700"
        >
          <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center p-3 sm:p-5">
              <div className="flex-shrink-0 mr-5 hidden sm:block">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 border border-blue-500/30 animate-pulse">
                      <Send size={28} />
                  </div>
              </div>
              <div className="flex-grow">
                  <div className="flex items-center space-x-3 mb-1.5">
                      <span className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-[0.1em] animate-pulse">
                        Last Signal Broadcast
                      </span>
                      <div className="flex items-center text-[10px] font-mono font-black text-blue-400">
                          <Timer size={12} className="mr-1.5" />
                          <span>{timeSince(lastGivenTrade.timestamp)}</span>
                      </div>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-4">
                      <h3 className="text-xl sm:text-2xl font-black text-white tracking-tighter uppercase font-mono">
                          {lastGivenTrade.instrument} {lastGivenTrade.symbol} {lastGivenTrade.type}
                      </h3>
                      <div className="flex items-center text-sm font-black space-x-3">
                          <span className={`px-3 py-1 rounded-lg border ${lastGivenTrade.action === 'BUY' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-rose-400 bg-rose-400/10 border-rose-400/20'}`}>
                              {lastGivenTrade.action} @ ₹{lastGivenTrade.entryPrice}
                          </span>
                      </div>
                  </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                  <div className="p-3 rounded-full bg-slate-800 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-400/10 transition-all border border-transparent group-hover:border-blue-500/20">
                      <ArrowRight size={24} />
                  </div>
              </div>
          </div>
          <div className="absolute bottom-0 left-0 h-[3px] bg-blue-500 w-full opacity-40 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-out"></div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 order-2 lg:order-1">
              <div className="mb-4 flex items-center space-x-2 px-1">
                 <Zap size={16} className="text-emerald-500" />
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Market Feed</h3>
              </div>
              {sortedSignals.length === 0 ? (
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
                            isMajorAlerting={!!activeMajorAlerts[signal.id]}
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
                    {watchlist.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[9px] font-black text-emerald-500 uppercase">Live Feed</span>
                      </div>
                    )}
                </div>
                <div className="divide-y divide-slate-800">
                    {watchlist.length > 0 ? watchlist.map((item, idx) => {
                        const isAlerting = !!activeWatchlistAlerts[item.symbol];
                        return (
                          <div key={idx} className={`p-4 flex items-center justify-between transition-all duration-500 relative ${isAlerting ? 'animate-box-glow z-10 scale-[1.02] bg-blue-500/10' : 'hover:bg-slate-800/50'}`}>
                              <div className="relative z-10">
                                  <p className="font-bold text-sm text-slate-200">{item.symbol}</p>
                                  <div className="flex items-center mt-1 text-slate-500">
                                      <Clock size={10} className="mr-1" />
                                      <span className="text-[10px] font-mono">{item.lastUpdated || '--'}</span>
                                  </div>
                              </div>
                              <div className="text-right relative z-10">
                                  <p className={`font-mono text-sm font-black ${isAlerting ? 'text-cyan-400 animate-pulse' : 'text-white'}`}>
                                    {Number(item.price || 0).toFixed(2)}
                                  </p>
                                  <p className={`text-xs font-mono mt-0.5 ${item.isPositive ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}`}>
                                      {item.isPositive ? '+' : ''}{Number(item.change || 0).toFixed(2)}%
                                  </p>
                              </div>
                          </div>
                        );
                    }) : (
                        <div className="p-8 text-center">
                            <Loader2 size={24} className="animate-spin mx-auto text-slate-700 mb-2" />
                            <p className="text-slate-500 text-xs italic">Syncing market feed...</p>
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
