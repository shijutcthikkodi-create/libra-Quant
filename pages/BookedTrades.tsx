
import React, { useMemo } from 'react';
import SignalCard from '../components/SignalCard';
import { History, Moon, Zap, Activity, BarChart3, TrendingUp, Layers, Calendar } from 'lucide-react';
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
  // Helper to get YYYY-MM-DD in IST
  const getISTDateString = (dateInput: string | Date | undefined) => {
    if (!dateInput) return '';
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return '';
      return new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Kolkata', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).format(d);
    } catch (e) {
      return '';
    }
  };

  // Helper to normalize dates for history signals (YYYY-MM-DD format)
  const normalizeDate = (trade: TradeSignal): string => {
    const ts = trade.lastTradedTimestamp || trade.timestamp;
    if (ts && String(ts).includes('T')) return String(ts).split('T')[0];
    
    const rawDate = String(trade.date || '').trim();
    if (!rawDate) return '';

    if (rawDate.includes('-')) {
      const parts = rawDate.split('-');
      if (parts[0].length === 4) return rawDate;
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const y = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
        const m = parts[1].padStart(2, '0');
        const d = parts[0].padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    return '';
  };

  const isIndex = (instrument: string) => {
    const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];
    return indices.includes(instrument.toUpperCase());
  };

  const { groupedSignals, stats, monthlyStats, todayDateLabel } = useMemo(() => {
    const today = getISTDateString(new Date());
    const currentMonthPrefix = today.split('-').slice(0, 2).join('-'); // YYYY-MM
    
    const tradeMap = new Map<string, TradeSignal>();
    
    // Process Active Signals tab
    (signals || []).forEach(item => {
      if (!item.id) return;
      const isClosed = item.status === TradeStatus.EXITED || item.status === TradeStatus.STOPPED || item.status === TradeStatus.ALL_TARGET;
      if (isClosed) tradeMap.set(item.id, item);
    });

    // TODAY'S BOOKED (Closed trades in active signals tab with IST date = today)
    const bookedToday = Array.from(tradeMap.values())
      .filter(s => getISTDateString(s.lastTradedTimestamp || s.timestamp) === today);

    const categories = {
      indexIntra: [] as TradeSignal[],
      indexBtst: [] as TradeSignal[],
      stockIntra: [] as TradeSignal[],
      stockBtst: [] as TradeSignal[]
    };

    let netPnL = 0;
    bookedToday.forEach(s => {
      const qty = Number(s.quantity && s.quantity > 0 ? s.quantity : 1);
      const pnl = Number(s.pnlRupees !== undefined ? s.pnlRupees : (s.pnlPoints || 0) * qty);
      netPnL += pnl;

      const isIdx = isIndex(s.instrument);
      if (isIdx) {
        if (s.isBTST) categories.indexBtst.push(s);
        else categories.indexIntra.push(s);
      } else {
        if (s.isBTST) categories.stockBtst.push(s);
        else categories.stockIntra.push(s);
      }
    });

    // MONTHLY POOL (History Tab Current Month + Active Signals Closed Current Month)
    const unifiedMonthlyMap = new Map<string, TradeSignal>();
    
    (historySignals || []).forEach(s => {
      const id = s.id || `hist-${normalizeDate(s)}-${s.symbol}-${s.entryPrice}`;
      if (normalizeDate(s).startsWith(currentMonthPrefix)) unifiedMonthlyMap.set(id, s);
    });
    
    Array.from(tradeMap.values()).forEach(s => {
      if (normalizeDate(s).startsWith(currentMonthPrefix)) unifiedMonthlyMap.set(s.id, s);
    });

    let monthlyPnLTotal = 0;
    unifiedMonthlyMap.forEach(s => {
      const qty = Number(s.quantity && s.quantity > 0 ? s.quantity : 1);
      const pnl = Number(s.pnlRupees !== undefined ? s.pnlRupees : (s.pnlPoints || 0) * qty);
      monthlyPnLTotal += pnl;
    });

    const sortByTime = (arr: TradeSignal[]) => arr.sort((a, b) => 
      new Date(b.lastTradedTimestamp || b.timestamp).getTime() - new Date(a.lastTradedTimestamp || a.timestamp).getTime()
    );

    return { 
      groupedSignals: {
        indexIntra: sortByTime(categories.indexIntra),
        indexBtst: sortByTime(categories.indexBtst),
        stockIntra: sortByTime(categories.stockIntra),
        stockBtst: sortByTime(categories.stockBtst)
      },
      stats: { net: netPnL, count: bookedToday.length },
      monthlyStats: { net: monthlyPnLTotal, count: unifiedMonthlyMap.size },
      todayDateLabel: today.split('-').reverse().join('/')
    };
  }, [signals, historySignals]);

  const RenderSection = ({ title, icon: Icon, colorClass, signals: data }: { title: string, icon: any, colorClass: string, signals: TradeSignal[] }) => {
    const sectionPnL = data.reduce((acc, s) => {
      const qty = Number(s.quantity && s.quantity > 0 ? s.quantity : 1);
      return acc + Number(s.pnlRupees !== undefined ? s.pnlRupees : (s.pnlPoints || 0) * qty);
    }, 0);

    return (
      <div className="mb-10 last:mb-0">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-l-4 border-l-current rounded-r-xl mb-4 shadow-lg group" style={{ color: `var(--tw-text-opacity, 1)` }}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
              <Icon size={18} className={colorClass} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{data.length} Realized Trade{data.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-sm font-mono font-black ${sectionPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {sectionPnL >= 0 ? '+' : ''}₹{sectionPnL.toLocaleString('en-IN')}
            </p>
            <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Segment P&L</p>
          </div>
        </div>
        
        {data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map(signal => (
              <SignalCard 
                key={signal.id} 
                signal={signal} 
                user={user} 
                highlights={granularHighlights[signal.id]} 
                onSignalUpdate={onSignalUpdate}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 bg-slate-900/10 border border-dashed border-slate-800/40 rounded-2xl text-center">
            <p className="text-[10px] text-slate-700 font-black uppercase tracking-[0.2em]">No activity in this segment</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <div>
           <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none mb-1 flex items-center">
             <History size={32} className="mr-3 text-emerald-500" />
             Trade History Ledger
           </h2>
           <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest font-mono italic">
             Session: {todayDateLabel}
           </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
           <div className="px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center justify-center min-w-[180px] border-l-4 border-l-blue-500">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Today's Net P&L</p>
              <p className={`text-2xl font-mono font-black ${stats.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{stats.net.toLocaleString('en-IN')}
              </p>
              <p className="text-[8px] text-slate-600 font-bold uppercase mt-1">{stats.count} Trades Closed</p>
           </div>
           
           <div className="px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center justify-center min-w-[180px] border-l-4 border-l-emerald-500">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Monthly Surplus</p>
              <p className={`text-2xl font-mono font-black ${monthlyStats.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{monthlyStats.net.toLocaleString('en-IN')}
              </p>
              <p className="text-[8px] text-slate-600 font-bold uppercase mt-1">{monthlyStats.count} Total (Hist + Book)</p>
           </div>
        </div>
      </div>

      <div className="space-y-2">
        <RenderSection title="Index Intraday" icon={Zap} colorClass="text-blue-400" signals={groupedSignals.indexIntra} />
        <RenderSection title="Index BTST" icon={Moon} colorClass="text-amber-500" signals={groupedSignals.indexBtst} />
        <RenderSection title="Stock Intraday" icon={Activity} colorClass="text-emerald-400" signals={groupedSignals.stockIntra} />
        <RenderSection title="Stock BTST" icon={Layers} colorClass="text-purple-400" signals={groupedSignals.stockBtst} />
      </div>

      {stats.count === 0 && (
        <div className="py-32 bg-slate-900/10 border border-dashed border-slate-800/50 rounded-3xl text-center">
          <History size={48} className="mx-auto text-slate-800 mb-4 opacity-30" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-sm italic">No trades closed in today's session</p>
        </div>
      )}
    </div>
  );
};

export default BookedTrades;
