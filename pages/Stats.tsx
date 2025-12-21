
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TradeSignal, TradeStatus } from '../types';
import { TrendingUp, Activity, Calendar, Target } from 'lucide-react';

interface StatsProps {
  signals?: TradeSignal[];
}

const Stats: React.FC<StatsProps> = ({ signals = [] }) => {
  // Helper to get IST components
  const getISTDetails = (date: Date) => {
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
  };

  const performance = useMemo(() => {
    const now = new Date();
    const { dateKey: todayKey, month: currentMonth, year: currentYear } = getISTDetails(now);

    const closedTrades = signals.filter(s => 
      s.status === TradeStatus.EXITED || s.status === TradeStatus.STOPPED || s.status === TradeStatus.ALL_TARGET
    );

    let todayPnL = 0;
    let monthPnL = 0;
    let totalPoints = 0;
    let wins = 0;

    // Grouping for chart (last 7 days)
    const dailyMap: Record<string, number> = {};
    
    // Initialize last 7 days in dailyMap
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const { dateKey } = getISTDetails(d);
      dailyMap[dateKey] = 0;
    }

    closedTrades.forEach(trade => {
      // BTST LOGIC: Use lastTradedTimestamp (the close time) for grouping performance
      // If lastTradedTimestamp isn't available, fall back to timestamp
      const closeDateStr = trade.lastTradedTimestamp || trade.timestamp;
      const closeDate = new Date(closeDateStr);
      const { dateKey, month, year } = getISTDetails(closeDate);

      const pnl = trade.pnlRupees || 0;
      const pts = trade.pnlPoints || 0;

      // Cumulative Stats
      totalPoints += pts;
      if (pts > 0) wins++;

      if (dateKey === todayKey) todayPnL += pnl;
      if (month === currentMonth && year === currentYear) monthPnL += pnl;

      if (dailyMap[dateKey] !== undefined) {
        dailyMap[dateKey] += pnl;
      }
    });

    const chartData = Object.entries(dailyMap).map(([date, value]) => ({
      date: date.split('-').slice(1).reverse().join('/'),
      pnl: value
    }));

    return {
      todayPnL,
      monthPnL,
      totalPoints,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
      chartData,
      totalTrades: closedTrades.length
    };
  }, [signals]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <TrendingUp size={24} className="mr-2 text-yellow-500" />
            Performance Analytics
          </h2>
          <p className="text-slate-400 text-sm">Session metrics and institutional growth tracking.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatItem label="Today's P&L" value={`₹${performance.todayPnL.toLocaleString('en-IN')}`} isPositive={performance.todayPnL >= 0} />
        <StatItem label="Monthly Net" value={`₹${performance.monthPnL.toLocaleString('en-IN')}`} isPositive={performance.monthPnL >= 0} />
        <StatItem label="Win Rate" value={`${performance.winRate.toFixed(1)}%`} isPositive={performance.winRate >= 50} />
        <StatItem label="Net Points" value={`${performance.totalPoints.toFixed(1)}`} isPositive={performance.totalPoints >= 0} />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
        <h3 className="text-white font-bold mb-8 flex items-center text-sm uppercase tracking-widest">
          <Calendar size={16} className="mr-2 text-blue-500" />
          7-Day P&L Distribution
        </h3>
        {/* Fixed height and min-height for ResponsiveContainer parent to solve sizing warnings */}
        <div className="h-72 w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performance.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} tickFormatter={(val) => `₹${val}`} />
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

const StatItem = ({ label, value, isPositive }: { label: string; value: string; isPositive: boolean }) => (
  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg hover:border-slate-700 transition-all">
    <p className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-widest opacity-80">{label}</p>
    <p className={`text-2xl font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{value}</p>
  </div>
);

export default Stats;
