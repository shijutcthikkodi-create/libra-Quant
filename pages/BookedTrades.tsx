
import React, { useMemo } from 'react';
import SignalCard from '../components/SignalCard';
import { History, Briefcase, Calendar, BarChart3, PieChart, Clock, Moon, Landmark } from 'lucide-react';
import { TradeSignal, User, TradeStatus } from '../types';
import { GranularHighlights } from '../App';

interface BookedTradesProps {
  signals: (TradeSignal & { sheetIndex?: number })[];
  historySignals?: TradeSignal[];
  user: User;
  granularHighlights: GranularHighlights;
  onSignalUpdate?: (updated: TradeSignal) => Promise<boolean>;
}

const BookedTrades: React.FC<BookedTradesProps> = ({ 
  signals, 
  historySignals = [],
  user, 
  granularHighlights,
  onSignalUpdate
}) => {
  // Enhanced index matchers for Indian Markets
  const INDEX_MATCHERS = ['NIFTY', 'BANK', 'FINNIFTY', 'MIDCP', 'SENSEX', 'BANKEX', 'INDIAVIX'];

  const getISTStrings = () => {
    const now = new Date();
    // Use en-CA for YYYY-MM-DD format easily
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    
    const today = fmt(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = fmt(yesterdayDate);
    
    return { today, yesterday };
  };

  const { groupedSignals, stats, totalCount } = useMemo(() => {
    const { today, yesterday } = getISTStrings();
    
    // 1. Unified De-duplication and Filtering
    const tradeMap = new Map<string, TradeSignal>();
    
    [...signals, ...historySignals].forEach(item => {
      if (!item.id) return;
      
      const isClosed = 
        item.status === TradeStatus.EXITED || 
        item.status === TradeStatus.STOPPED || 
        item.status === TradeStatus.ALL_TARGET;
        
      if (isClosed) {
        // Preference: If duplicate, keep history version as it's the "Final Truth"
        tradeMap.set(item.id, item);
      }
    });

    const bookedTrades = Array.from(tradeMap.values());

    // 2. Precise Calculation Engine
    const groups: Record<string, TradeSignal[]> = {
      'TODAY': [],
      'YESTERDAY': [],
      'PAST RECORDS': []
    };

    let indexIntraday = 0;
    let stockIntraday = 0;
    let indexBTST = 0;
    let stockBTST = 0;
    let totalNet = 0;

    bookedTrades.forEach(s => {
      // Calculate individual trade P&L with explicit Number() casting to avoid string issues
      const qty = Number(s.quantity && s.quantity > 0 ? s.quantity : 1);
      const tradePnl = Number(s.pnlRupees !== undefined ? s.pnlRupees : (s.pnlPoints || 0) * qty);
      
      totalNet += tradePnl;

      // Classify Instrument (Check both Instrument and Symbol for Index keywords)
      const instRaw = String(s.instrument || '').toUpperCase();
      const symRaw = String(s.symbol || '').toUpperCase();
      const isIndex = INDEX_MATCHERS.some(idx => instRaw.includes(idx) || symRaw.includes(idx));

      // Update Stats using strictly verified BTST flag
      if (s.isBTST) {
        if (isIndex) indexBTST += tradePnl;
        else stockBTST += tradePnl;
      } else {
        if (isIndex) indexIntraday += tradePnl;
        else stockIntraday += tradePnl;
      }

      // Grouping logic based on IST dates
      const tradeDate = s.date || (s.timestamp ? s.timestamp.split('T')[0] : '');
      if (tradeDate === today) {
        groups['TODAY'].push(s);
      } else if (tradeDate === yesterday) {
        groups['YESTERDAY'].push(s);
      } else {
        groups['PAST RECORDS'].push(s);
      }
    });

    // Sort within groups (Newest First) - USE STABLE SORT
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const timeB = new Date(b.timestamp).getTime();
        const timeA = new Date(a.timestamp).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return b.id.localeCompare(a.id); // Tie-breaker
      });
    });

    return { 
      groupedSignals: groups, 
      stats: { indexIntraday, stockIntraday, indexBTST, stockBTST, totalNet },
      totalCount: bookedTrades.length
    };
  }, [signals, historySignals]);

  const StatBox = ({ label, value, icon: Icon, iconColor, subtext, bgColor }: any) => (
    <div className={`flex flex-col flex-1 p-4 bg-slate-900 border rounded-xl shadow-lg transition-all hover:border-slate-600 hover:shadow-xl ${bgColor || 'border-slate-800'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest flex items-center">
          <Icon size={12} className={`mr-2 ${iconColor}`} />
          {label}
        </span>
        <span className="text-[8px] font-black text-slate-600 px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700/50 uppercase">{subtext}</span>
      </div>
      <p className={`text-xl font-mono font-black tracking-tighter ${value >= 0 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.3)]'}`}>
        {value >= 0 ? '+' : ''}₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );

  const activeGroupKeys = Object.keys(groupedSignals).filter(key => groupedSignals[key].length > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-8">
        <div className="shrink-0">
          <div className="flex items-center space-x-3 mb-2">
             <div className="w-12 h-12 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <History size={28} />
             </div>
             <div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                  Trade Ledger
                </h2>
                <div className="flex items-center space-x-2 mt-1">
                   <div className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 tracking-tighter flex items-center uppercase">
                      <Briefcase size={10} className="mr-1" />
                      {totalCount} Verified Closures
                   </div>
                </div>
             </div>
          </div>
          
          <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-start min-w-[240px] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <Landmark size={48} className="text-white" />
            </div>
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Total Realized P&L</span>
            <p className={`text-3xl font-mono font-black tracking-tighter ${stats.totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.totalNet >= 0 ? '+' : ''}₹{stats.totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="w-full xl:max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBox label="Index Intra" value={stats.indexIntraday} icon={BarChart3} iconColor="text-blue-500" subtext="Scalps" />
            <StatBox label="Stock Intra" value={stats.stockIntraday} icon={PieChart} iconColor="text-purple-500" subtext="Equity" />
            <StatBox label="Index BTST" value={stats.indexBTST} icon={Moon} iconColor="text-amber-500" subtext="Overnight" bgColor="border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]" />
            <StatBox label="Stock BTST" value={stats.stockBTST} icon={Clock} iconColor="text-orange-500" subtext="Overnight" bgColor="border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.05)]" />
          </div>
        </div>
      </div>

      <div className="relative">
        {activeGroupKeys.length === 0 ? (
          <div className="py-32 bg-slate-900/20 border border-dashed border-slate-800/50 rounded-3xl text-center">
            <div className="w-20 h-20 bg-slate-800/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700/50">
              <Calendar size={40} className="text-slate-800" />
            </div>
            <p className="text-slate-500 font-black uppercase tracking-widest text-sm italic">Ledger Empty</p>
            <p className="text-[10px] text-slate-700 mt-3 uppercase tracking-widest font-mono">Archive syncs automatically from terminal.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {activeGroupKeys.map(dateKey => (
              <div key={dateKey} className="space-y-6">
                <div className="flex items-center space-x-3 sticky top-0 z-20 py-3 bg-slate-950/90 backdrop-blur-md border-b border-slate-900/50">
                   <div className={`px-4 py-1.5 rounded text-[11px] font-black border tracking-widest ${
                     dateKey === 'TODAY' ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 
                     dateKey === 'YESTERDAY' ? 'bg-slate-800 text-slate-300 border-slate-700' :
                     'bg-slate-900/50 text-slate-500 border-slate-800 italic'
                   }`}>
                      {dateKey}
                   </div>
                   <div className="flex-1 h-px bg-slate-800/30"></div>
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                     {groupedSignals[dateKey].length} TRADES
                   </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedSignals[dateKey].map((signal) => (
                    <div key={signal.id} className={signal.isBTST ? 'relative z-10' : ''}>
                       {signal.isBTST && (
                         <div className="absolute -inset-1 bg-amber-500/5 blur-md rounded-2xl pointer-events-none"></div>
                       )}
                       <SignalCard 
                         signal={signal} 
                         user={user} 
                         highlights={granularHighlights[signal.id]} 
                         onSignalUpdate={onSignalUpdate}
                       />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookedTrades;
