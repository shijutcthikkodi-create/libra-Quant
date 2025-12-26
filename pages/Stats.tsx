
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TradeSignal, TradeStatus } from '../types';
import { TrendingUp, Activity, Calendar, Zap, CheckCircle2, Clock, BarChart3, Filter, Target } from 'lucide-react';

interface StatsProps {
  signals?: TradeSignal[];
  historySignals?: TradeSignal[];
}

const Stats: React.FC<StatsProps> = ({ signals = [], historySignals = [] }) => {
  const getISTStrings = () => {
    const now = new Date();
    // en-CA gives YYYY-MM-DD which matches the sheet/ISO format
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const dayName = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(now);
    
    const today = fmt(now);
    const monthYear = today.split('-').slice(0, 2).join('-'); // YYYY-MM
    return { today, monthYear, dayName };
  };

  const performance = useMemo(() => {
    const { today: istToday, monthYear: currentMonthYear, dayName } = getISTStrings();
    const combinedData = [...signals, ...historySignals];
    
    // Deduplicate trades by ID
    const seenIds = new Set();
    const uniqueTrades = combinedData.filter(item => {
      if (!item.id) return false;
      const duplicate = seenIds.has(item.id);
      seenIds.add(item.id);
      return !duplicate;
    });

    // Filter for finalized trades only
    const closedTrades = uniqueTrades.filter(s => 
      s.status === TradeStatus.EXITED || s.status === TradeStatus.STOPPED || s.status === TradeStatus.ALL_TARGET
    );

    let todayPnL = 0;
    let todayClosedCount = 0;
    let latestSessionPnL = 0;
    let latestSessionCount = 0;
    let latestSessionDate = "";
    
    const monthlySetupGroups: Record<string, number> = {};
    const monthlyIntraGroups: Record<string, number> = {};
    const monthlyBtstGroups: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};

    // Prep 10-day chart slots for IST to ensure weekends don't push Friday off the chart too early
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      dailyMap[dateKey] = 0;
    }

    // First pass: Group data and find latest trading day
    const tradesByDate: Record<string, { pnl: number, count: number }> = {};

    closedTrades.forEach(trade => {
      const effectiveCloseTimestamp = trade.lastTradedTimestamp || trade.timestamp;
      const effectiveCloseDate = effectiveCloseTimestamp ? effectiveCloseTimestamp.split('T')[0] : (trade.date || '');
      
      const pnl = trade.pnlRupees !== undefined 
        ? trade.pnlRupees 
        : (trade.pnlPoints || 0) * (trade.quantity || 1);
      
      const setupKey = `${trade.instrument}_${trade.symbol}_${trade.type}`.toUpperCase();
      
      // Track P&L per date
      if (!tradesByDate[effectiveCloseDate]) tradesByDate[effectiveCloseDate] = { pnl: 0, count: 0 };
      tradesByDate[effectiveCloseDate].pnl += pnl;
      tradesByDate[effectiveCloseDate].count += 1;

      // Current Month Stats
      if (effectiveCloseDate.startsWith(currentMonthYear)) {
        monthlySetupGroups[setupKey] = (monthlySetupGroups[setupKey] || 0) + pnl;
        if (trade.isBTST) monthlyBtstGroups[setupKey] = (monthlyBtstGroups[setupKey] || 0) + pnl;
        else monthlyIntraGroups[setupKey] = (monthlyIntraGroups[setupKey] || 0) + pnl;
      }

      // Populate Daily Distribution Chart
      if (dailyMap[effectiveCloseDate] !== undefined) {
        dailyMap[effectiveCloseDate] += pnl;
      }
    });

    // Calculate Today's P&L
    if (tradesByDate[istToday]) {
        todayPnL = tradesByDate[istToday].pnl;
        todayClosedCount = tradesByDate[istToday].count;
    }

    // Identify Latest Session (for weekends or empty today)
    const sortedDates = Object.keys(tradesByDate).sort((a, b) => b.localeCompare(a));
    const mostRecentDate = sortedDates[0];
    
    if (mostRecentDate) {
        latestSessionPnL = tradesByDate[mostRecentDate].pnl;
        latestSessionCount = tradesByDate[mostRecentDate].count;
        latestSessionDate = mostRecentDate;
    }

    const calculateWinRate = (groups: Record<string, number>) => {
      const outcomes = Object.values(groups);
      const wins = outcomes.filter(val => val > 0).length;
      return outcomes.length > 0 ? (wins / outcomes.length) * 100 : 0;
    };

    const isWeekend = dayName === 'Saturday' || dayName === 'Sunday';
    const showLatestInsteadOfToday = isWeekend || todayClosedCount === 0;

    return {
      todayPnL,
      todayClosedCount,
      displayPnL: showLatestInsteadOfToday ? latestSessionPnL : todayPnL,
      displayCount: showLatestInsteadOfToday ? latestSessionCount : todayClosedCount,
      displayDateLabel: showLatestInsteadOfToday ? (latestSessionDate ? `Session: ${latestSessionDate.split('-').slice(1).reverse().join('/')}` : 'No Session') : 'Session: Today',
      displayTitle: showLatestInsteadOfToday ? 'Latest Session P&L' : "Today's Net P&L",
      monthPnL: Object.values(tradesByDate).filter((_, i) => sortedDates[i]?.startsWith(currentMonthYear)).reduce((acc, curr) => acc + curr.pnl, 0),
      overallWinRate: calculateWinRate(monthlySetupGroups),
      intradayWinRate: calculateWinRate(monthlyIntraGroups),
      btstWinRate: calculateWinRate(monthlyBtstGroups),
      chartData: Object.entries(dailyMap).map(([date, value]) => ({
        date: date.split('-').slice(1).reverse().join('/'),
        pnl: value
      })).slice(-7), // Keep only last 7 days for the actual visual
      totalSetups: Object.keys(monthlySetupGroups).length,
      totalIntra: Object.keys(monthlyIntraGroups).length,
      totalBTST: Object.keys(monthlyBtstGroups).length,
      currentMonthLabel: new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date())
    };
  }, [signals, historySignals]);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <TrendingUp size={24} className="mr-2 text-yellow-500" />
            Performance Analytics
          </h2>
          <div className="flex items-center space-x-2 text-slate-400 text-sm">
            <Filter size={14} className="text-blue-500" />
            <span>Reporting Cycle: <span className="text-blue-400 font-bold uppercase tracking-tighter">{performance.currentMonthLabel}</span></span>
          </div>
        </div>
        <div className="flex items-center px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl">
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Terminal Activity</span>
              <span className="text-xs font-mono font-bold text-white">{performance.displayCount} Trades in {performance.displayDateLabel}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatItem 
          label={performance.displayTitle} 
          value={formatCurrency(performance.displayPnL)} 
          isPositive={performance.displayPnL >= 0} 
          icon={Activity}
          highlight={true}
          subtext={performance.displayDateLabel}
        />
        <StatItem 
          label="Monthly Surplus" 
          value={formatCurrency(performance.monthPnL)} 
          isPositive={performance.monthPnL >= 0} 
          icon={Calendar}
          subtext="Net for this cycle"
        />
        <StatItem 
          label="Monthly Win Rate" 
          value={`${performance.overallWinRate.toFixed(2)}%`} 
          isPositive={performance.overallWinRate >= 50} 
          subtext={`Across ${performance.totalSetups} Signals`}
          icon={CheckCircle2}
        />
        <StatItem 
          label="Intraday Accuracy" 
          value={`${performance.intradayWinRate.toFixed(2)}%`} 
          isPositive={performance.intradayWinRate >= 50} 
          subtext={`${performance.totalIntra} Day trades`}
          icon={Zap}
        />
        <StatItem 
          label="BTST Reliability" 
          value={`${performance.btstWinRate.toFixed(2)}%`} 
          isPositive={performance.btstWinRate >= 50} 
          subtext={`${performance.totalBTST} Overnight`}
          icon={Clock}
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <BarChart3 size={120} className="text-slate-400" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 relative z-10">
            <div>
              <h3 className="text-white font-bold flex items-center text-sm uppercase tracking-[0.2em]">
                <BarChart3 size={16} className="mr-3 text-blue-500" />
                7-Day Net P&L Distribution (IST)
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">Rolling institutional performance log</p>
            </div>
            <div className="px-3 py-1 bg-slate-800/50 rounded-lg border border-slate-700 text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center">
                <Target size={10} className="mr-1.5 text-blue-500" />
                Verified Archive Data
            </div>
        </div>
        
        <div className="h-72 w-full min-h-[300px] relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performance.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.3} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 800}} dy={15} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 800}} tickFormatter={(val) => `₹${Math.abs(val) > 1000 ? (val/1000).toFixed(1) + 'k' : val}`} />
              <Tooltip 
                cursor={{fill: 'rgba(30, 41, 59, 0.2)'}} 
                contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)'}}
                itemStyle={{fontSize: '13px', fontWeight: '900', fontFamily: 'monospace'}}
                labelStyle={{color: '#64748b', fontSize: '10px', marginBottom: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px'}}
              />
              <Bar dataKey="pnl" radius={[8, 8, 0, 0]} barSize={45}>
                {performance.chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, isPositive, subtext, icon: Icon, highlight = false }: { label: string; value: string; isPositive: boolean; subtext?: string; icon: any; highlight?: boolean }) => (
  <div className={`bg-slate-900 border ${highlight ? 'border-blue-500/30' : 'border-slate-800'} p-5 rounded-2xl shadow-xl hover:border-slate-600 transition-all relative overflow-hidden group`}>
    {highlight && (
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl -mr-12 -mt-12 rounded-full"></div>
    )}
    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={48} className="text-white" />
    </div>
    <div className="flex items-center space-x-2 mb-3">
        <Icon size={14} className={highlight ? 'text-blue-500' : 'text-slate-500'} />
        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest truncate">{label}</p>
    </div>
    <p className={`text-2xl font-mono font-black tracking-tighter leading-none ${isPositive ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]' : 'text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.3)]'}`}>
        {value}
    </p>
    {subtext && (
        <p className={`text-[9px] font-bold ${highlight ? 'text-blue-400' : 'text-slate-600'} uppercase mt-2 tracking-widest opacity-80`}>{subtext}</p>
    )}
  </div>
);

export default Stats;
