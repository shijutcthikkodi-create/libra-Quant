
import React, { useState, useMemo, useEffect } from 'react';
import { Menu, X, BarChart2, Radio, ShieldAlert, LogOut, FileText, User as UserIcon, Scale, Clock, CheckCircle, AlertCircle, EyeOff, ExternalLink, TrendingUp } from 'lucide-react';
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

  // Security: Blur screen when tab loses focus (prevents background recording)
  useEffect(() => {
    if (user?.isAdmin) return; // Admins exempt

    const handleVisibility = () => {
      setIsTabFocused(!document.hidden);
    };

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

  const subscriptionStatus = useMemo(() => {
    if (!user?.expiryDate) return { days: 0, expired: true, soon: false };
    
    let expiryStr = user.expiryDate;
    if (expiryStr.includes('-') && expiryStr.split('-')[0].length === 2) {
      const parts = expiryStr.split('-');
      expiryStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    
    const end = new Date(expiryStr);
    if (isNaN(end.getTime())) return { days: 0, expired: true, soon: false };
    
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      days: diffDays > 0 ? diffDays : 0,
      expired: now > end,
      soon: diffDays <= 5 && diffDays > 0
    };
  }, [user]);

  const { days: daysLeft, expired: isExpired, soon: isExpiringSoon } = subscriptionStatus;

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

  return (
    <div className={`min-h-screen flex flex-col md:flex-row relative overflow-hidden ${!isTabFocused ? 'app-protected' : ''} ${!user?.isAdmin ? 'no-screenshot' : ''}`}>
      {/* Privacy Guard Overlay */}
      {!isTabFocused && !user?.isAdmin && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-6">
          <EyeOff size={64} className="text-slate-500 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter">Secure Terminal Locked</h2>
          <p className="text-slate-400 max-w-xs text-sm">Application content is hidden for your security while the tab is inactive.</p>
        </div>
      )}

      {/* Dynamic Watermark Overlay */}
      {user && (
        <div className="watermark">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="watermark-text text-sm md:text-base">
              {user.phoneNumber} <span className="opacity-40">{user.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center z-50 sticky top-0">
        <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                <Scale size={18} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">LibraQuant</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-300">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <aside
        className={`fixed md:relative z-40 top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } flex flex-col`}
      >
        <div className="p-6 hidden md:flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-900/20">
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
          
          {/* Institutional Demat CTA */}
          <div className="mt-6 px-2">
            <a 
              href="https://oa.mynt.in/?ref=ZTN348" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group relative flex flex-col items-center justify-center p-4 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 transition-all hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 mb-2 group-hover:scale-110 transition-transform">
                <TrendingUp size={18} />
              </div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] text-center">Open Demat A/C</p>
              <p className="text-[8px] text-slate-500 font-bold uppercase mt-1 text-center">Zero AMC * Partners</p>
              <ExternalLink size={10} className="absolute top-2 right-2 text-slate-700 group-hover:text-amber-500" />
            </a>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 mr-3">
              <UserIcon size={16} />
            </div>
            <div className="overflow-hidden w-full">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              
              <div className={`mt-1 flex items-center space-x-1.5 text-xs font-mono font-bold px-2 py-0.5 rounded-md transition-all duration-300 ${
                  isExpired ? 'bg-rose-950 text-rose-500 border border-rose-500/50' : 
                  isExpiringSoon ? 'bg-rose-600 text-white animate-pulse border border-white/20 shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 
                  'bg-emerald-900/20 text-emerald-400'
              }`}>
                  {isExpiringSoon || isExpired ? <AlertCircle size={10} className={isExpiringSoon ? 'animate-bounce' : ''} /> : <Clock size={10} />}
                  <span>{isExpired ? 'EXPIRED' : `${daysLeft} DAYS LEFT`}</span>
              </div>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center justify-center w-full py-2 px-4 rounded-lg bg-slate-800 text-slate-300 hover:bg-red-900/20 hover:text-red-400 transition-colors text-sm">
            <LogOut size={16} className="mr-2" />
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
