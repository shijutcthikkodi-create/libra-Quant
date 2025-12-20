import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MOCK_STATS } from '../constants';

const data = [
  { name: 'Mon', pnl: 4000 },
  { name: 'Tue', pnl: -1200 },
  { name: 'Wed', pnl: 8500 },
  { name: 'Thu', pnl: 2100 },
  { name: 'Fri', pnl: 5600 },
];

const Stats: React.FC = () => {
  const StatCard = ({ label, value, sub, color }: any) => (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-mono font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-slate-600 text-sm mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-8">
        <h2 className="text-2xl font-bold text-white">Performance Analytics</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Net P&L (Est)" value={`₹${MOCK_STATS.estimatedPnL.toLocaleString()}`} color="text-emerald-400" sub="This Month" />
            <StatCard label="Win Rate" value={`${MOCK_STATS.winRate}%`} color="text-blue-400" sub={`${MOCK_STATS.totalTrades} Total Trades`} />
            <StatCard label="Accuracy" value={`${MOCK_STATS.accuracy}%`} color="text-yellow-400" />
            <StatCard label="Net Points" value={MOCK_STATS.netPoints} />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-white">Daily P&L Curve</h3>
                <div className="px-3 py-1 bg-slate-800 rounded text-xs text-slate-400">Last 5 Days</div>
            </div>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                            cursor={{fill: '#1e293b'}}
                        />
                        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.pnl > 0 ? '#10b981' : '#f43f5e'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-medium text-white mb-4">Looker Studio Integration</h3>
            <div className="aspect-video w-full bg-slate-950 rounded border border-slate-800 flex flex-col items-center justify-center text-slate-500">
                <p className="mb-2">Secure Institutional Report Embed</p>
                <p className="text-xs max-w-md text-center">
                    In the production build, the official Looker Studio iFrame loads here. 
                    It is currently disabled in this demo to prevent cross-origin errors without a valid embed URL.
                </p>
                <button className="mt-4 px-4 py-2 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 transition text-sm">
                    Open Full Report
                </button>
            </div>
        </div>
    </div>
  );
};

export default Stats;
