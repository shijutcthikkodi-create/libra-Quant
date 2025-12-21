// Add missing useMemo import from 'react'
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Target, Cpu, Edit2, Check, X, TrendingUp, TrendingDown, Clock, ShieldAlert, Zap, AlertTriangle, Trophy, Loader2, History } from 'lucide-react';
import { TradeSignal, TradeStatus, OptionType, User } from '../types';
import { analyzeTradeSignal } from '../services/geminiService';

interface SignalCardProps {
  signal: TradeSignal;
  user: User;
  highlights?: Set<string>;
  onSignalUpdate?: (updated: TradeSignal) => Promise<boolean>;
  isRecentlyClosed?: boolean;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, user, highlights, onSignalUpdate, isRecentlyClosed }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  
  const [isEditingTrail, setIsEditingTrail] = useState(false);
  const [isSavingTrail, setIsSavingTrail] = useState(false);
  const [trailValue, setTrailValue] = useState<string>(signal.trailingSL != null ? String(signal.trailingSL) : '');
  const [displayTrail, setDisplayTrail] = useState<number | null | undefined>(signal.trailingSL);

  useEffect(() => {
    if (!isEditingTrail) {
      setDisplayTrail(signal.trailingSL);
      setTrailValue(signal.trailingSL != null ? String(signal.trailingSL) : '');
    }
  }, [signal.trailingSL, isEditingTrail]);

  const isBuy = signal.action === 'BUY';
  const isActive = signal.status === TradeStatus.ACTIVE || signal.status === TradeStatus.PARTIAL;
  const isExited = signal.status === TradeStatus.EXITED || signal.status === TradeStatus.STOPPED || signal.status === TradeStatus.ALL_TARGET;
  const isSLHit = signal.status === TradeStatus.STOPPED;
  const isAllTarget = signal.status === TradeStatus.ALL_TARGET;
  const isTSLHit = isExited && !isAllTarget && (signal.comment?.toUpperCase().includes('TSL') || (signal.status === TradeStatus.EXITED && (signal.pnlPoints || 0) > 0 && signal.comment?.toUpperCase().includes('TRAILING')));
  const canEdit = user.isAdmin && !isExited;
  
  const getStatusColor = (status: TradeStatus) => {
    switch (status) {
      case TradeStatus.ACTIVE: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case TradeStatus.PARTIAL: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case TradeStatus.ALL_TARGET: return 'bg-emerald-600/20 text-emerald-400 border-emerald-400/50';
      case TradeStatus.EXITED: return 'bg-slate-800 text-slate-500 border-slate-700';
      case TradeStatus.STOPPED: return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  const getTargetStyle = (index: number) => {
    const isHit = isAllTarget || (signal.targetsHit || 0) > index;
    if (!isHit) return 'bg-slate-950 border-slate-800 text-slate-600';
    return 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]';
  };

  const handleAIAnalysis = async () => {
    if (analysis) {
        setAnalysis(null);
        return;
    }
    setLoadingAnalysis(true);
    const result = await analyzeTradeSignal(signal);
    setAnalysis(result);
    setLoadingAnalysis(false);
  };

  const handleSaveTrail = async () => {
    const val = trailValue.trim() === '' ? null : parseFloat(trailValue);
    if (onSignalUpdate) {
        setIsSavingTrail(true);
        const success = await onSignalUpdate({
            ...signal,
            trailingSL: val,
            stopLoss: val !== null ? val : signal.stopLoss
        });
        if (success) {
            setDisplayTrail(val);
            setIsEditingTrail(false);
        }
        setIsSavingTrail(false);
    } else {
        if (!isNaN(val as any)) setDisplayTrail(val); else setDisplayTrail(null);
        setIsEditingTrail(false);
    }
  };

  const riskReward = useMemo(() => {
    if (signal.targets && signal.targets.length > 0) {
      const risk = Math.abs(signal.entryPrice - (signal.stopLoss || 1));
      if (risk > 0) {
        return isBuy 
          ? (signal.targets[0] - signal.entryPrice) / risk
          : (signal.entryPrice - signal.targets[0]) / risk;
      }
    }
    return 0;
  }, [signal, isBuy]);

  const getStampText = () => {
    if (isAllTarget) return { text: 'SEALED SUCCESS', color: 'text-emerald-500' };
    if (isSLHit) return { text: 'EXITED - LOSS', color: 'text-rose-500' };
    if (isTSLHit) return { text: 'TSL EXECUTED', color: 'text-amber-500' };
    return { text: 'TRADE SEALED', color: 'text-slate-400' };
  };

  const stamp = getStampText();

  return (
    <div className={`relative bg-slate-900 border rounded-xl overflow-hidden transition-all duration-500 ${isActive ? 'border-slate-700 shadow-2xl' : 'border-slate-800 shadow-md'}`}>
      
      {/* Dimmed Background Overlay (Only when recently closed) */}
      {isRecentlyClosed && (
        <div className="absolute inset-0 z-10 bg-slate-950/80 pointer-events-none"></div>
      )}

      {/* Clear Status Stamp (On top of dimmed overlay) */}
      {isRecentlyClosed && (
        <div className="status-stamp-wrapper">
           <div className={`status-stamp ${stamp.color}`}>
              <div className="flex flex-col items-center">
                 <span className="text-xl md:text-2xl">{stamp.text}</span>
                 <div className="flex items-center mt-2 space-x-2 opacity-80">
                    <History size={14} />
                    <span className="text-[10px] font-bold tracking-widest">ARCHIVING... (1M)</span>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Target Hit Blast (Green) */}
      {(highlights?.has('blast') || isAllTarget) && isActive && (
        <div className="absolute inset-0 z-50 overflow-hidden pointer-events-none">
          <div className="animate-blast"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="text-emerald-400 animate-pulse" size={100} strokeWidth={1} />
          </div>
        </div>
      )}

      {/* Main Content (Dimmed if closed) */}
      <div className={`${isRecentlyClosed ? 'opacity-30 grayscale-[0.5]' : ''}`}>
          <div className="flex justify-between items-start p-5 pb-3">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${isBuy ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                {isBuy ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-0.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${isBuy ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'}`}>
                        {signal.action}
                    </span>
                    <h3 className="text-xl font-bold text-white tracking-tight font-mono">{signal.instrument}</h3>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                    <span className="font-mono text-slate-400 uppercase">{signal.symbol}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${signal.type === OptionType.CE ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {signal.type}
                    </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-1.5">
                <div className={`px-3 py-1 rounded text-[10px] font-bold border ${getStatusColor(signal.status)} flex items-center`}>
                    {isAllTarget ? <Trophy size={10} className="mr-2" /> : <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isActive ? 'bg-current animate-pulse' : 'bg-current opacity-50'}`}></span>}
                    {signal.status}
                </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-slate-800 border-y border-slate-800">
            <div className="bg-slate-900 p-4">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Entry Price</p>
                <p className="text-2xl font-mono font-bold text-white">₹{signal.entryPrice}</p>
            </div>
            
            <div className={`p-4 flex flex-col transition-colors duration-500 ${isSLHit ? 'bg-rose-950/20' : 'bg-slate-900'}`}>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Stop Loss</p>
                <p className={`text-2xl font-mono font-bold mb-3 ${isSLHit ? 'text-rose-500' : 'text-rose-400'}`}>
                  ₹{signal.stopLoss}
                </p>
                
                <div className="mt-auto pt-2 border-t border-slate-800/80">
                    {isEditingTrail ? (
                        <div className="flex items-center space-x-1">
                            <input type="number" value={trailValue} onChange={(e) => setTrailValue(e.target.value)} className="w-full bg-slate-950 border border-blue-500 rounded text-[10px] px-2 py-1 text-white focus:outline-none font-mono" autoFocus disabled={isSavingTrail} />
                            <button onClick={handleSaveTrail} disabled={isSavingTrail} className="p-1 bg-emerald-500/20 text-emerald-400 rounded">
                              {isSavingTrail ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                            </button>
                            <button onClick={() => setIsEditingTrail(false)} disabled={isSavingTrail} className="p-1 bg-slate-700 text-slate-400 rounded"><X size={10} /></button>
                        </div>
                    ) : (
                        <div className={`flex items-center justify-between rounded px-1 py-1 transition-colors ${canEdit ? 'cursor-pointer hover:bg-slate-800' : 'opacity-70'}`} onClick={() => canEdit && setIsEditingTrail(true)}>
                             <div className="flex items-center space-x-1.5">
                                <TrendingUp size={10} className="text-yellow-600" />
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Trail SL</span>
                             </div>
                             <div className="flex items-center space-x-2">
                                <span className="text-xs font-mono font-bold text-yellow-500">
                                  {displayTrail ? `₹${displayTrail}` : '--'}
                                </span>
                                {canEdit && <Edit2 size={10} className="text-slate-700" />}
                             </div>
                        </div>
                    )}
                </div>
            </div>
          </div>

          {(isExited || signal.pnlPoints !== undefined) && (
            <div className={`px-5 py-3 flex items-center justify-between border-b border-slate-800 ${ (signal.pnlPoints || 0) >= 0 ? 'bg-emerald-500/5' : 'bg-rose-500/5' }`}>
                <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-full ${(signal.pnlPoints || 0) >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {(signal.pnlPoints || 0) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {isExited ? 'Final Result' : 'Current P&L'}
                    </span>
                </div>
                <div className="text-right">
                     <div className={`text-xl font-mono font-bold ${(signal.pnlPoints || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(signal.pnlPoints || 0) > 0 ? '+' : ''}{signal.pnlPoints || 0} pts
                     </div>
                </div>
            </div>
          )}

          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                    <Target size={14} className="text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Targets</span>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
                {signal.targets && signal.targets.length > 0 ? (
                  signal.targets.map((t, idx) => {
                    const isHit = isAllTarget || (signal.targetsHit || 0) > idx;
                    return (
                      <div key={idx} className={`rounded px-2 py-2 text-center border transition-all duration-700 ${getTargetStyle(idx)}`}>
                          <p className="text-[10px] font-bold uppercase mb-0.5 opacity-60">T{idx + 1}</p>
                          <p className="text-xs font-mono font-bold">{t}</p>
                          {isHit && <Check size={8} className="mx-auto mt-1" />}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-3 text-center py-4 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">No targets defined</p>
                  </div>
                )}
            </div>

            {signal.comment && (
                <div className="mt-4 p-3 rounded-lg border bg-slate-950/50 border-slate-800/50">
                    <p className="text-xs leading-relaxed text-slate-400 italic">" {signal.comment} "</p>
                </div>
            )}

            <div className="mt-4 border-t border-slate-800 pt-3 flex justify-between items-center">
                <div className="flex items-center text-[10px] text-slate-600 font-mono">
                    <Clock size={10} className="mr-1" />
                    {new Date(signal.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
                
                <button onClick={handleAIAnalysis} disabled={loadingAnalysis} className="flex items-center py-1 text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors">
                    <Cpu size={12} className="mr-1.5" />
                    {loadingAnalysis ? 'Consulting AI...' : 'AI Analysis'}
                </button>
            </div>
            
            {analysis && (
                <div className="mt-2 p-3 bg-slate-950 border border-blue-900/30 rounded text-[10px] text-slate-300 leading-relaxed font-mono">
                    {analysis}
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default SignalCard;