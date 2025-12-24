
import React, { useMemo } from 'react';
import SignalCard from '../components/SignalCard';
import { CheckCircle, Calendar, Clock, Briefcase, Zap, BarChart3, PieChart, Activity, TrendingUp, Landmark, LineChart, ChevronRight, History, Moon } from 'lucide-react';
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
  const INDEX_MATCHERS = ['NIFTY', 'BANK', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'];

  const getISTDateGroup = (date: Date) => {
    if (!date || isNaN(date.getTime())) return 'ARCHIVED TRADES';
    const now = new Date();
    
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-IN', { 
      timeZone: 'Asia/Kolkata', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(d);
    
    const todayStr = fmt(now);
    const targetStr = fmt(date);
    
    if (todayStr === targetStr) return 'TODAY';
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (targetStr === fmt(yesterday)) return 'YESTERDAY';

    return new Intl.DateTimeFormat('en-IN', { 
      timeZone: 'Asia/Kolkata', 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).format(date).toUpperCase();
  };

  const { groupedSignals, stats, totalCount } = useMemo(() => {
    // Merge both live and historical signals
    const combinedData = [...signals, ...historySignals];
    
    // Deduplicate by the now-unique source-prefixed IDs
    const seenIds = new Set();
    const uniqueTrades = combinedData.filter(item => {
      if (!item.id) return false;
      const duplicate = seenIds.has(item.id);
      seenIds.add(item.id);
      return !duplicate;
    });

    const booked = uniqueTrades.filter(signal => {
      const status = signal.status;
      return status === TradeStatus.EXITED || status === TradeStatus.STOPPED || status === TradeStatus.ALL_TARGET;
    }).sort((a, b) => {
      const timeA = new Date(a.lastTradedTimestamp || a.timestamp).getTime();
      const timeB = new Date(b.lastTradedTimestamp || b.timestamp).getTime();
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    const groups: Record<string, TradeSignal[]> = {};
    let totalNet = 0;
    let indexIntraday = 0;
    let stockIntraday = 0;
    let indexBTST = 0;
    let stockBTST = 0;

    booked.forEach(s => {
      const tsStr = s.lastTradedTimestamp || s.timestamp;
      const dateObj = new Date(tsStr);
      const groupKey = getISTDateGroup(dateObj);

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(s);

      const effectiveQty = (s.quantity && s.quantity > 0) ? s.quantity : 1;
      const pnl = s.pnlRupees !== undefined ? s.pnlRupees : (s.pnlPoints || 0) * effectiveQty;
      totalNet += pnl;

      const instRaw = (s.instrument || '').toUpperCase();
      const isIndex = INDEX_MATCHERS.some(idx => instRaw.includes(idx));

      if (s.isBTST) {
        if (isIndex) indexBTST += pnl;
        else stockBTST += pnl;
      } else {
        if (isIndex) indexIntraday += pnl;
        else stockIntraday += pnl;
      }
    });

    return { 
      groupedSignals: groups, 
      stats: { indexIntraday, stockIntraday, indexBTST, stockBTST, totalNet },
      totalCount: booked.length
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

  // Group sorting: Today first, then Yesterday, then chronologically backwards
  const groupKeys = Object.keys(groupedSignals).sort((a, b) => {
    if (a === 'TODAY') return -1;
    if (b === 'TODAY') return 1;
    if (a === 'YESTERDAY') return -1;
    if (b === 'YESTERDAY') return 1;
    if (a === 'ARCHIVED TRADES') return 1;
    if (b === 'ARCHIVED TRADES') return -1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

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
                  Trade History
                </h2>
                <div className="flex items-center space-x-2 mt-1">
                   <div className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 tracking-tighter flex items-center uppercase">
                      <Briefcase size={10} className="mr-1" />
                      Vault Record: {totalCount} Closed Trades
                   </div>
                </div>
             </div>
          </div>
          
          <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-start min-w-[200px] shadow-2xl relative overflow-hidden group">
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
            <StatBox label="Index Intraday" value={stats.indexIntraday} icon={BarChart3} iconColor="text-blue-500" subtext="Regular" />
            <StatBox label="Stock Intraday" value={stats.stockIntraday} icon={PieChart} iconColor="text-purple-500" subtext="Regular" />
            <StatBox label="Index BTST" value={stats.indexBTST} icon={Moon} iconColor="text-amber-500" subtext="Overnight" bgColor="border-amber-500/20" />
            <StatBox label="Stock BTST" value={stats.stockBTST} icon={Clock} iconColor="text-orange-500" subtext="Overnight" bgColor="border-orange-500/20" />
          </div>
        </div>
      </div>

      <div className="relative">
        {groupKeys.length === 0 ? (
          <div className="py-32 bg-slate-900/20 border border-dashed border-slate-800/50 rounded-3xl text-center">
            <div className="w-20 h-20 bg-slate-800/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700/50">
              <Calendar size={40} className="text-slate-800" />
            </div>
            <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Historical vault is empty</p>
            <p className="text-[10px] text-slate-700 mt-3 uppercase tracking-widest font-mono">Check if your 'history' tab is populated in the spreadsheet.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {groupKeys.map(dateKey => (
              <div key={dateKey} className="space-y-4">
                <div className="flex items-center space-x-3 sticky top-0 z-20 py-2 bg-slate-950/80 backdrop-blur-sm">
                   <div className={`px-3 py-1 rounded text-[10px] font-black border tracking-widest ${
                     dateKey === 'TODAY' ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 
                     dateKey === 'YESTERDAY' ? 'bg-slate-800 text-slate-300 border-slate-700' : 
                     'bg-slate-900 text-slate-500 border-slate-800'
                   }`}>
                      {dateKey}
                   </div>
                   <div className="flex-1 h-px bg-slate-800/50"></div>
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                     {groupedSignals[dateKey].length} TRADES
                   </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedSignals[dateKey].map((signal) => (
                    <div key={signal.id} className="transition-all duration-300">
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
