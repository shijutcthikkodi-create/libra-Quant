
import React, { useMemo } from 'react';
import SignalCard from '../components/SignalCard';
import { CheckCircle, Search, TrendingUp, DollarSign, Calendar, Clock } from 'lucide-react';
import { TradeSignal, User, TradeStatus } from '../types';
import { GranularHighlights } from '../App';

interface BookedTradesProps {
  signals: (TradeSignal & { sheetIndex?: number })[];
  user: User;
  granularHighlights: GranularHighlights;
}

const BookedTrades: React.FC<BookedTradesProps> = ({ 
  signals, 
  user, 
  granularHighlights
}) => {
  // Helper to get IST Date String for comparison
  const getISTDateKey = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  const bookedSignals = useMemo(() => {
    const todayIST = getISTDateKey(new Date());

    return signals.filter(signal => {
      const status = signal.status;
      const isBooked = status === TradeStatus.EXITED || status === TradeStatus.STOPPED || status === TradeStatus.ALL_TARGET;
      
      if (!isBooked) return false;

      // Filter by today's date in IST
      const signalDateIST = getISTDateKey(new Date(signal.timestamp));
      return signalDateIST === todayIST;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [signals]);

  const stats = useMemo(() => {
    let totalPoints = 0;
    let totalRupees = 0;
    bookedSignals.forEach(s => {
      totalPoints += (s.pnlPoints || 0);
      totalRupees += (s.pnlRupees || 0);
    });
    return { points: totalPoints, rupees: totalRupees };
  }, [bookedSignals]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 mb-1">
             <h2 className="text-2xl font-bold text-white flex items-center">
                <CheckCircle size={24} className="mr-2 text-blue-500" />
                Session History
              </h2>
              <div className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-tighter flex items-center">
                <Clock size={10} className="mr-1" />
                Resets @ 00:00 IST
              </div>
          </div>
          <p className="text-slate-400 text-sm">Reviewing closed positions for the current IST day.</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 px-5 flex items-center space-x-4 shadow-2xl">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center mb-1">
                <TrendingUp size={10} className="mr-1 text-emerald-500" />
                Session Pts
              </span>
              <p className={`text-lg font-mono font-bold ${stats.points >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.points > 0 ? '+' : ''}{stats.points.toFixed(1)}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center mb-1">
                <DollarSign size={10} className="mr-1 text-blue-500" />
                Session Net
              </span>
              <p className={`text-lg font-mono font-bold ${stats.rupees >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{stats.rupees.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {bookedSignals.length === 0 ? (
        <div className="py-24 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={30} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Closed Trades Today</p>
          <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-tighter">History was automatically archived at midnight.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookedSignals.map((signal) => (
            <div key={signal.id} className="transition-all duration-300">
               <SignalCard 
                 signal={signal} 
                 user={user} 
                 highlights={granularHighlights[signal.id]} 
               />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookedTrades;
