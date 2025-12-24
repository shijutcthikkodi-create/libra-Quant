
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TradeSignal, TradeStatus } from '../types';
import { TrendingUp, Activity, Calendar, Zap, CheckCircle2, Clock, BarChart3, Filter } from 'lucide-react';

interface StatsProps {
  signals?: TradeSignal[];
  historySignals?: TradeSignal[];
}

const Stats: React.FC<StatsProps> = ({ signals = [], historySignals = [] }) => {
  // Helper to get IST components with robustness
  const getISTDetails = (date: Date) => {
    if (!date || isNaN(date.getTime())) {
      return { dateKey: 'INVALID', month: '00', year: '0000' };
    }
    try {
      const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(date);
      const day = parts.find(p => p.type === 'day')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const year = parts.find(p => p.type === 'year')?.value;
      const dateKey = `${year}-${month}-${day}`;
      return { dateKey, month, year };
    } catch (e) {
      return { dateKey: 'INVALID', month: '00', year: '0000' };
    }
  };

  const performance = useMemo(() => {
    const now = new Date();
    const { dateKey: todayKey, month: currentMonth, year: currentYear } = getISTDetails(now);

    // Merge active session data with historical vault
    const combinedData = [...signals, ...historySignals];
    
    // Deduplicate by ID to ensure accuracy
    const seenIds = new Set();
    const uniqueTrades = combinedData.filter(item => {
      const duplicate = seenIds.has(item.id);
      seenIds.add(item.id);
      return !duplicate;
    });

    const closedTrades = uniqueTrades.filter(s => 
      s.status === TradeStatus.EXITED || s.status === TradeStatus.STOPPED || s.status === TradeStatus.ALL_TARGET
    );

    let todayPnL = 0;
    let monthPnL = 0;
    
    // Monthly Grouping logic for rigorous performance calculation
    const monthlySetupGroups: Record<string, number> = {};
    const monthlyIntraGroups: Record<string, number> = {};
    const monthlyBtstGroups: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};

    // Initialize 7-day chart map
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const { dateKey } = getISTDetails(d);
      if (dateKey !== 'INVALID') {
        dailyMap[dateKey] = 0;
      }
    }

    closedTrades.forEach(trade => {
      const closeTimeStr = trade.lastTradedTimestamp || trade.timestamp;
      if (!closeTimeStr) return;
      
      const closeDate = new Date(closeTimeStr);
      const { dateKey, month, year } = getISTDetails(closeDate);
      if (dateKey === 'INVALID') return;

      const pnl = trade.pnlRupees || 0;
      
      // Strict Performance Key (Instrument + Symbol + Type)
      const setupKey = `${trade.instrument}_${trade.symbol}_${trade.type}`.toUpperCase();
      
      // 1. P&L Net Calculations (Today vs Month)
      if (dateKey === todayKey) todayPnL += pnl;
      
      // Check if trade belongs to CURRENT month for win-rate inclusion
      if (month === currentMonth && year === currentYear) {
        monthPnL += pnl;

        // Populate Monthly Groups (Strict Win-Rate Data)
        monthlySetupGroups[setupKey] = (monthlySetupGroups[setupKey] || 0) + pnl;

        if (trade.isBTST) {
          monthlyBtstGroups[setupKey] = (monthlyBtstGroups[setupKey] || 0) + pnl;
        } else {
          monthlyIntraGroups[setupKey] = (monthlyIntraGroups[setupKey] || 0) + pnl;
        }
      }

      // Update Daily Chart Map (Always shows last 7 days)
      if (dailyMap[dateKey] !== undefined) {
        dailyMap[dateKey] += pnl;
      }
    });

    // Monthly Logic Helper
    const calculateWinRate = (groups: Record<string, number>) => {
      const outcomes = Object.values(groups);
      const wins = outcomes.filter(pnl => pnl > 0).length;
      return outcomes.length > 0 ? (wins / outcomes.length) * 100 : 0;
    };

    return {
      todayPnL,
      monthPnL,
      overallWinRate: calculateWinRate(monthlySetupGroups),
      intradayWinRate: calculateWinRate(monthlyIntraGroups),
      btstWinRate: calculateWinRate(monthlyBtstGroups),
      chartData: Object.entries(dailyMap).map(([date, value]) => ({
        date: date === 'INVALID' ? '--' : date.split('-').slice(1).reverse().join('/'),
        pnl: value
      })),
      totalSetups: Object.keys(monthlySetupGroups).length,
      totalIntra: Object.keys(monthlyIntraGroups).length,
      totalBTST: Object.keys(monthlyBtstGroups).length,
      currentMonthLabel: new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(now)
    };
  }, [signals, historySignals]);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <TrendingUp size={24} className="mr-2 text-yellow-500" />
            Performance Analytics
          </h2>
          <div className="flex items-center space-x-2 text-slate-400 text-sm">
            <Filter size={14} className="text-blue-500" />
            <span>Cycle: <span className="text-blue-400 font-bold uppercase tracking-tighter">{performance.currentMonthLabel}</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatItem 
          label="Today's P&L" 
          value={formatCurrency(performance.todayPnL)} 
          isPositive={performance.todayPnL >= 0} 
          icon={Activity}
        />
        <StatItem 
          label="Monthly Net" 
          value={formatCurrency(performance.monthPnL)} 
          isPositive={performance.monthPnL >= 0} 
          icon={Calendar}
        />
        <StatItem 
          label="Monthly Win Rate" 
          value={`${performance.overallWinRate.toFixed(2)}%`} 
          isPositive={performance.overallWinRate >= 50} 
          subtext={`Across ${performance.totalSetups} Setups`}
          icon={CheckCircle2}
        />
        <StatItem 
          label="Monthly Intra WR" 
          value={`${performance.intradayWinRate.toFixed(2)}%`} 
          isPositive={performance.intradayWinRate >= 50} 
          subtext={`${performance.totalIntra} Intraday Setups`}
          icon={Zap}
        />
        <StatItem 
          label="Monthly BTST WR" 
          value={`${performance.btstWinRate.toFixed(2)}%`} 
          isPositive={performance.btstWinRate >= 50} 
          subtext={`${performance.totalBTST} Overnight Setups`}
          icon={Clock}
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-white font-bold flex items-center text-sm uppercase tracking-widest">
              <BarChart3 size={16} className="mr-2 text-blue-500" />
              7-Day Net P&L Distribution
            </h3>
            <div className="px-3 py-1 bg-slate-800 rounded-lg border border-slate-700 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                Institutional History
            </div>
        </div>
        
        <div className="h-72 w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performance.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} tickFormatter={(val) => `₹${val.toFixed(2)}`} />
              <Tooltip 
                cursor={{fill: 'rgba(30, 41, 59, 0.4)'}} 
                contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '12px'}}
                itemStyle={{fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace'}}
                labelStyle={{color: '#64748b', fontSize: '10px', marginBottom: '6px', fontWeight: 800, textTransform: 'uppercase'}}
              />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]} barSize={40}>
                {performance.chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, isPositive, subtext, icon: Icon }: { label: string; value: string; isPositive: boolean; subtext?: string; icon: any }) => (
  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg hover:border-slate-700 transition-all relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={48} className="text-white" />
    </div>
    <div className="flex items-center space-x-2 mb-2">
        <Icon size={14} className="text-slate-500" />
        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest opacity-80">{label}</p>
    </div>
    <p className={`text-2xl font-mono font-black tracking-tighter ${isPositive ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.3)]'}`}>
        {value}
    </p>
    {subtext && (
        <p className="text-[9px] font-bold text-slate-600 uppercase mt-1 tracking-widest">{subtext}</p>
    )}
  </div>
);

export default Stats;
