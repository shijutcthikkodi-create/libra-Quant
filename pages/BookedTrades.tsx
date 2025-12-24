
import React, { useMemo } from 'react';
import SignalCard from '../components/SignalCard';
import { CheckCircle, Calendar, Clock, Briefcase, Zap, BarChart3, PieChart, Activity, TrendingUp, Landmark, LineChart, ChevronRight } from 'lucide-react';
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
  // Helper to get IST Date String for grouping
  const getISTDateDisplay = (date: Date) => {
    if (!date || isNaN(date.getTime())) return null;
    const now = new Date();
    
    // Formatting for comparison
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    
    const todayStr = fmt(now);
    const targetStr = fmt(date);
    
    if (todayStr === targetStr) return 'TODAY';
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = fmt(yesterday);
    if (targetStr === yesterdayStr) return 'YESTERDAY';

    return null; // Signals outside today/yesterday return null
  };

  const { groupedSignals, stats } = useMemo(() => {
    // COMBINE DATA: prioritize 'signals' because it contains the most recent status updates
    // before the Google Sheet background script moves them to the history tab.
    const combinedData = [...signals, ...historySignals];
    
    const seenIds = new Set();
    const uniqueTrades = combinedData.filter(item => {
      if (!item.id) return false;
      const duplicate = seenIds.has(item.id);
      seenIds.add(item.id);
      return !duplicate;
    });

    // Filter only CLOSED trades within strict Today/Yesterday window
    const booked = uniqueTrades.filter(signal => {
      const status = signal.status;
      const isClosed = status === TradeStatus.EXITED || status === TradeStatus.STOPPED || status === TradeStatus.ALL_TARGET;
      if (!isClosed) return false;

      // Use the trade completion timestamp if available, else signal timestamp
      const ts = new Date(signal.lastTradedTimestamp || signal.timestamp);
      return getISTDateDisplay(ts) !== null;
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
    const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];

    booked.forEach(s => {
      const ts = s.lastTradedTimestamp || s.timestamp;
      const dateKey = getISTDateDisplay(new Date(ts));
      if (!dateKey) return; 

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(s);

      const pnl = (s.pnlRupees || 0);
      totalNet += pnl;
      const inst = (s.instrument || '').toUpperCase();
      const isIndex = indices.some(idx => inst.includes(idx));

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
      stats: { indexIntraday, stockIntraday, indexBTST, stockBTST, totalNet } 
    };
  }, [signals, historySignals]);

  const StatBox = ({ label, value, icon: Icon, iconColor, subtext }: any) => (
    <div className="flex flex-col flex-1 p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg transition-all hover:border-slate-700 hover:shadow-blue-500/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest flex items-center">
          <Icon size={12} className={`mr-2 ${iconColor}`} />
          {label}
        </span>
        <span className="text-[8px] font-black text-slate-600 px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700/50 uppercase">{subtext}</span>
      </div>
      <p className={`text-xl font-mono font-black tracking-tighter ${value >= 0 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.3)]'}`}>
        {value >= 0 ? '+' : ''}₹{value.toLocaleString('en-IN')}
      </p>
    </div>
  );

  const groupKeys = Object.keys(groupedSignals);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-8">
        <div className="shrink-0">
          <div className="flex items-center space-x-3 mb-2">
             <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-lg shadow-blue-500/5">
                <TrendingUp size={28} />
             </div>
             <div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                  Trade Ledger
                </h2>
                <div className="flex items-center space-x-2 mt-1">
                   <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 tracking-tighter flex items-center">
                      <Clock size={10} className="mr-1" />
                      <i><b className="font-bold">Tension free trading</b></i>
                   </div>
                   <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Recent Performance</span>
                </div>
             </div>
          </div>
          
          <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-start min-w-[200px] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <Landmark size={48} className="text-white" />
            </div>
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Window Net</span>
            <p className={`text-3xl font-mono font-black tracking-tighter ${stats.totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.totalNet >= 0 ? '+' : ''}₹{stats.totalNet.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="w-full xl:max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBox 
              label="Index Net" 
              value={stats.indexIntraday} 
              icon={BarChart3} 
              iconColor="text-blue-500" 
              subtext="Intraday"
            />
            <StatBox 
              label="Stock Net" 
              value={stats.stockIntraday} 
              icon={PieChart} 
              iconColor="text-purple-500" 
              subtext="Intraday"
            />
            <StatBox 
              label="Index BTST" 
              value={stats.indexBTST} 
              icon={Landmark} 
              iconColor="text-amber-500" 
              subtext="Overnight"
            />
            <StatBox 
              label="Stock BTST" 
              value={stats.stockBTST} 
              icon={Briefcase} 
              iconColor="text-orange-500" 
              subtext="Overnight"
            />
          </div>
        </div>
      </div>

      <div className="relative">
        {groupKeys.length === 0 ? (
          <div className="py-32 bg-slate-900/20 border border-dashed border-slate-800/50 rounded-3xl text-center">
            <div className="w-20 h-20 bg-slate-800/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700/50">
              <Calendar size={40} className="text-slate-800" />
            </div>
            <p className="text-slate-500 font-black uppercase tracking-widest text-sm italic">"No recent closures"</p>
            <p className="text-[10px] text-slate-700 mt-3 uppercase tracking-widest font-mono">Ledger strictly shows last 48 hours only.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {groupKeys.map(dateKey => (
              <div key={dateKey} className="space-y-4">
                <div className="flex items-center space-x-3">
                   <div className="px-3 py-1 bg-slate-800 rounded text-[10px] font-black text-slate-300 border border-slate-700 tracking-widest">
                      {dateKey}
                   </div>
                   <div className="flex-1 h-px bg-slate-800/50"></div>
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
