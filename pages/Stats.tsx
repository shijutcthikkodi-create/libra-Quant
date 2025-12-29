
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TradeSignal, TradeStatus } from '../types';
import { TrendingUp, Activity, Calendar, Zap, CheckCircle2, Clock, BarChart3, Filter, Target, Award, History as HistoryIcon, Layers, Briefcase } from 'lucide-react';

interface StatsProps {
  signals?: (TradeSignal & { sheetIndex?: number })[];
  historySignals?: TradeSignal[];
}

const Stats: React.FC<StatsProps> = ({ signals = [], historySignals = [] }) => {
  const getISTContext = () => {
    const now = new Date();
    const fmt = (d: Date, options: Intl.DateTimeFormatOptions) => 
      new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'Asia/Kolkata' }).format(d);
    
    const today = fmt(now, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const monthYear = today.split('-').slice(0, 2).join('-'); 
    const currentMonthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(now);
    
    return { today, monthYear, currentMonthLabel };
  };

  const isIndex = (instrument: string) => {
    const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];
    return indices.includes(instrument.toUpperCase());
  };

  const normalizeDate = (trade: TradeSignal): string => {
    const ts = trade.lastTradedTimestamp || trade.timestamp;
    if (ts && String(ts).includes('T')) return String(ts).split('T')[0];
    const rawDate = String(trade.date || '').trim();
    if (!rawDate) return '';

    if (rawDate.includes('-')) {
      const parts = rawDate.split('-');
      if (parts[0].length === 4) return rawDate;
      if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const y = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
        return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return '';
  };

  const performance = useMemo(() => {
    const { today: istToday, monthYear: currentMonthYear, currentMonthLabel } = getISTContext();
    
    // TODAY'S LEDGER (Active signals closed today)
    const activeClosedToday = (signals || []).filter(s => {
      const isClosed = s.status === TradeStatus.EXITED || s.status === TradeStatus.STOPPED || s.status === TradeStatus.ALL_TARGET;
      return isClosed && normalizeDate(s) === istToday;
    });

    let todayPnL = 0;
    activeClosedToday.forEach(s => {
      const qty = Number(s.quantity && s.quantity > 0 ? s.quantity : 1);
      todayPnL += Number(s.pnlRupees !== undefined ? s.pnlRupees : (s.pnlPoints || 0) * qty);
    });

    // UNIFIED POOL (History + Active Closed)
    const unifiedMap = new Map<string, TradeSignal>();
    (historySignals || []).forEach(s => {
      const id = s.id || `hist-${normalizeDate(s)}-${s.symbol}-${s.entryPrice}`;
      unifiedMap.set(id, s);
    });
    (signals || []).forEach(s => {
      if (s.status === TradeStatus.EXITED || s.status === TradeStatus.STOPPED || s.status === TradeStatus.ALL_TARGET) {
        if (s.id) unifiedMap.set(s.id, s);
      }
    });

    const combinedHistory = Array.from(unifiedMap.values());
    const monthlyStats = { pnl: 0, indexPnL: 0, stockPnL: 0, overall: [] as number[], intraday: [] as number[], btst: [] as number[] };

    const chartMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      chartMap[new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)] = 0;
    }

    combinedHistory.forEach(trade => {
      const tradeDateStr = normalizeDate(trade);
      if (!tradeDateStr) return;
      const qty = Number(trade.quantity && trade.quantity > 0 ? trade.quantity : 1);
      const pnl = Number(trade.pnlRupees !== undefined ? trade.pnlRupees : (trade.pnlPoints || 0) * qty);

      if (tradeDateStr.startsWith(currentMonthYear)) {
        monthlyStats.pnl += pnl;
        monthlyStats.overall.push(pnl);
        if (isIndex(trade.instrument)) monthlyStats.indexPnL += pnl; else monthlyStats.stockPnL += pnl;
        if (trade.isBTST) monthlyStats.btst.push(pnl); else monthlyStats.intraday.push(pnl);
      }
      if (chartMap[tradeDateStr] !== undefined) chartMap[tradeDateStr] += pnl;
    });

    const calculateWinRate = (list: number[]) => list.length === 0 ? 0 : (list.filter(v => v > 0).length / list.length) * 100;

    return {
      todayPnL, todayCount: activeClosedToday.length,
      monthlyPnL: monthlyStats.pnl,
      indexPnL: monthlyStats.indexPnL,
      stockPnL: monthlyStats.stockPnL,
      overallWinRate: calculateWinRate(monthlyStats.overall),
      intradayWinRate: calculateWinRate(monthlyStats.intraday),
      btstWinRate: calculateWinRate(monthlyStats.btst),
      totalMonthlyTrades: monthlyStats.overall.length,
      currentMonthLabel,
      chartData: Object.entries(chartMap).map(([date, pnl]) => ({ date: date.split('-').reverse().slice(0, 2).join('/'), pnl }))
    };
  }, [signals, historySignals]);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center"><TrendingUp size={24} className="mr-2 text-yellow-500" />Performance Analytics</h2>
          <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest flex items-center"><Layers className="mr-1.5 text-blue-500" size={12} /> Institutional Intelligence Deck</p>
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-[10px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
           <Filter size={12} className="text-blue-500" />
           <span className="uppercase font-black tracking-tighter">Cycle: {performance.currentMonthLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatItem label="Today's Booked P&L" value={formatCurrency(performance.todayPnL)} isPositive={performance.todayPnL >= 0} icon={Activity} highlight={true} subtext={`Realized Today (${performance.todayCount})`} />
        <StatItem label="Monthly Surplus (Total)" value={formatCurrency(performance.monthlyPnL)} isPositive={performance.monthlyPnL >= 0} icon={HistoryIcon} subtext={`Sample: ${performance.totalMonthlyTrades} Trades (Hist+Book)`} />
        <StatItem label="Win Rate (Overall)" value={`${performance.overallWinRate.toFixed(1)}%`} isPositive={performance.overallWinRate >= 65} icon={Award} subtext="Aggregated Monthly Accuracy" />
        <StatItem label="BTST Reliability" value={`${performance.btstWinRate.toFixed(1)}%`} isPositive={performance.btstWinRate >= 65} icon={Clock} subtext="Overnight Target Accuracy" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatItem label="Index Monthly P&L" value={formatCurrency(performance.indexPnL)} isPositive={performance.indexPnL >= 0} icon={Layers} subtext="Nifty / BankNifty Segment" />
        <StatItem label="Stock Monthly P&L" value={formatCurrency(performance.stockPnL)} isPositive={performance.stockPnL >= 0} icon={Briefcase} subtext="Equity Options / Cash" />
        <StatItem label="Intraday Accuracy" value={`${performance.intradayWinRate.toFixed(1)}%`} isPositive={performance.intradayWinRate >= 65} icon={Zap} subtext="Day-Trading Accuracy" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h3 className="text-white font-bold flex items-center text-sm uppercase tracking-widest"><BarChart3 size={16} className="mr-3 text-blue-500" />Performance curve (Unified)</h3>
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">7-Day Combined History + Active Data Feed</p>
            </div>
        </div>
        <div className="h-64 w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performance.chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.3} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 800}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 800}} tickFormatter={(val) => `₹${Math.abs(val) >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
              <Tooltip cursor={{fill: 'rgba(30, 41, 59, 0.2)'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '12px'}} itemStyle={{fontSize: '12px', fontWeight: 'bold'}} labelStyle={{color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900}} />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]} barSize={45}>
                {performance.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, isPositive, subtext, icon: Icon, highlight = false }: { label: string; value: string; isPositive: boolean; subtext?: string; icon: any; highlight?: boolean }) => (
  <div className={`bg-slate-900 border ${highlight ? 'border-blue-500/30 shadow-[0_0_25px_rgba(59,130,246,0.1)]' : 'border-slate-800'} p-5 rounded-2xl shadow-xl hover:border-slate-700 transition-all group`}>
    <div className="flex items-center space-x-2 mb-3">
        <div className={`p-1.5 rounded-lg ${highlight ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-800 text-slate-500'}`}><Icon size={14} /></div>
        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{label}</p>
    </div>
    <p className={`text-2xl font-mono font-black tracking-tighter leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{value}</p>
    {subtext && <p className="text-[9px] font-bold text-slate-600 uppercase mt-2 tracking-widest opacity-80">{subtext}</p>}
  </div>
);

export default Stats;
