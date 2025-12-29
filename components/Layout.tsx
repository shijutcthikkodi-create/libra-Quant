
import React, { useState, useMemo, useEffect } from 'react';
import { Menu, X, BarChart2, Radio, ShieldAlert, LogOut, FileText, User as UserIcon, Scale, Clock, CheckCircle, AlertCircle, EyeOff, ExternalLink, TrendingUp, ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { SEBI_DISCLAIMER, FOOTER_TEXT, BRANDING_TEXT } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentPage, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number, expired: boolean, soon: boolean, perpetual: boolean } | null>(null);

  useEffect(() => {
    if (user?.isAdmin) return;
    const handleVisibility = () => setIsTabFocused(!document.hidden);
    const handleBlur = () => setIsTabFocused(false);
    const handleFocus = () => setIsTabFocused(true);
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  useEffect(() => {
    const calculateTime = () => {
        const rawExpiry = String(user?.expiryDate || '').trim();
        if (!rawExpiry || rawExpiry.toLowerCase() === 'perpetual' || rawExpiry.toLowerCase() === 'admin') {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false, soon: false, perpetual: true });
          return;
        }
        
        let expiryStr = rawExpiry;
        if (expiryStr.includes('-') && expiryStr.split('-')[0].length === 2) {
          const parts = expiryStr.split('-');
          expiryStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else if (expiryStr.includes('/')) {
           const parts = expiryStr.split('/');
           if (parts[0].length === 2) expiryStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        const end = new Date(expiryStr);
        if (isNaN(end.getTime())) {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false, soon: false, perpetual: true });
          return;
        }
        
        end.setHours(23, 59, 59, 999);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        
        if (diff <= 0) {
            setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, soon: false, perpetual: false });
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setTimeLeft({ 
          days, 
          hours, 
          minutes, 
          seconds, 
          expired: false, 
          soon: days < 5,
          perpetual: false
        });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [user?.expiryDate]);

  const NavItem = ({ page, icon: Icon, label }: { page: string; icon: any; label: string }) => (
    <button
      onClick={() => {
        onNavigate(page);
        setIsSidebarOpen(false);
      }}
      className={`flex items-center w-full px-4 py-3 mb-2 rounded-lg transition-colors ${
        currentPage === page
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} className="mr-3" />
      <span className="font-medium">{label}</span>
    </button>
  );

  const formatUnit = (n: number) => n.toString().padStart(2, '0');

  const CountdownBadge = () => {
    if (!timeLeft) return null;
    return (
      <div className={`flex items-center space-x-1.5 text-[9px] font-mono font-black px-2 py-1 rounded-md transition-all duration-300 ${
          timeLeft.perpetual ? 'bg-blue-900/20 text-blue-400 border border-blue-500/20' :
          timeLeft.expired ? 'bg-rose-950 text-rose-500 border border-rose-500/50' : 
          timeLeft.soon ? 'bg-rose-600 text-white animate-critical border border-white/40 shadow-lg' : 
          'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20'
      }`}>
          {timeLeft.perpetual ? <ShieldCheck size={10} /> : (timeLeft.soon || timeLeft.expired ? <AlertCircle size={10} /> : <Clock size={10} />)}
          <span className="uppercase tracking-tighter whitespace-nowrap">
            {timeLeft.perpetual ? 'UNLIMITED ACCESS' : 
             timeLeft.expired ? 'EXPIRED' : (
              timeLeft.soon ? (
                `${timeLeft.days}D ${formatUnit(timeLeft.hours)}:${formatUnit(timeLeft.minutes)}:${formatUnit(timeLeft.seconds)}`
              ) : `${timeLeft.days} DAYS LEFT`
            )}
          </span>
      </div>
    );
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row relative overflow-hidden ${!isTabFocused ? 'app-protected' : ''} ${!user?.isAdmin ? 'no-screenshot' : ''}`}>
      {!isTabFocused && !user?.isAdmin && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-6">
          <EyeOff size={64} className="text-slate-500 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter">Secure Terminal Locked</h2>
          <p className="text-slate-400 max-w-xs text-sm">Application content is hidden for your security while the tab is inactive.</p>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center z-50 sticky top-0 shadow-xl">
        <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                <Scale size={18} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs text-white tracking-tight uppercase leading-none">LibraQuant</span>
              <div className="mt-1">
                 <CountdownBadge />
              </div>
            </div>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg text-slate-300">
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <aside
        className={`fixed md:relative z-40 top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } flex flex-col shadow-2xl`}
      >
        <div className="p-6 hidden md:flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
             <Scale size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-bold text-xl text-white tracking-tight">LibraQuant</h1>
            <p className="text-xs text-purple-400 font-mono">PRO TERMINAL</p>
          </div>
        </div>

        <nav className="flex-1 px-4 overflow-y-auto">
          <NavItem page="dashboard" icon={Radio} label="Live Signals" />
          <NavItem page="booked" icon={CheckCircle} label="Booked Trades" />
          <NavItem page="stats" icon={BarChart2} label="P&L Analytics" />
          <NavItem page="rules" icon={ShieldAlert} label="Rules & Disclaimer" />
          {user?.isAdmin && <NavItem page="admin" icon={FileText} label="Admin Panel" />}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 mr-3">
              <UserIcon size={16} />
            </div>
            <div className="overflow-hidden w-full">
              <p className="text-sm font-bold text-white truncate">{user?.name}</p>
              <div className="mt-1.5">
                <CountdownBadge />
              </div>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center justify-center w-full py-2 px-4 rounded-lg bg-slate-800 text-slate-300 hover:bg-rose-900/30 hover:text-rose-400 transition-colors text-xs font-bold uppercase tracking-widest">
            <LogOut size={14} className="mr-2" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto bg-slate-950 relative z-10">
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
            {children}
        </div>
        <div className="bg-slate-900/95 border-t border-slate-800 p-2 text-center fixed bottom-0 w-full md:w-[calc(100%-16rem)] right-0 backdrop-blur-md z-50 flex flex-col items-center justify-center space-y-1">
           <div className="text-[9px] text-slate-500 font-mono tracking-tight opacity-70 uppercase leading-none px-4">
              {FOOTER_TEXT}
           </div>
           <div className="text-[10px] font-bold text-blue-500/90 tracking-[0.15em] font-mono leading-none pt-0.5">
              {BRANDING_TEXT}
           </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
