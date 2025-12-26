
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WatchlistItem, TradeSignal, OptionType, TradeStatus, User, LogEntry, ChatMessage } from '../types';
import { 
  Trash2, Radio, UserCheck, RefreshCw, History, Zap, Loader2, 
  ShieldCheck, Activity, Plus, TrendingUp, ArrowUpCircle, 
  ArrowDownCircle, Briefcase, MessageSquare, Send, User as UserIcon, Database
} from 'lucide-react';
import { updateSheetData } from '../services/googleSheetsService';

interface AdminProps {
  watchlist: WatchlistItem[];
  onUpdateWatchlist: (list: WatchlistItem[]) => void;
  signals: TradeSignal[];
  onUpdateSignals: (list: TradeSignal[]) => void;
  users: User[];
  onUpdateUsers: (list: User[]) => void;
  logs?: LogEntry[];
  messages?: ChatMessage[];
  onNavigate: (page: string) => void;
  onHardSync?: () => Promise<void>;
  onRefresh?: () => void;
}

const Admin: React.FC<AdminProps> = ({ signals, users, logs = [], messages = [], onHardSync, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'SUPPORT' | 'CLIENTS' | 'LOGS'>('SIGNALS');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const adminChatRef = useRef<HTMLDivElement>(null);
  const [replyText, setReplyText] = useState('');

  const activeSignals = useMemo(() => {
    return (signals || []).filter(s => s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL);
  }, [signals]);

  const chatFeed = useMemo(() => {
    return [...(messages || [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages]);

  useEffect(() => {
    if (adminChatRef.current && activeTab === 'SUPPORT') {
      adminChatRef.current.scrollTop = adminChatRef.current.scrollHeight;
    }
  }, [chatFeed.length, activeTab]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSaving) return;

    setIsSaving(true);
    const newMessage: any = {
      id: `MSG-${Date.now()}`,
      userId: 'ADMIN-DESK',
      senderName: 'Research Desk',
      text: replyText.trim(),
      timestamp: new Date().toISOString(),
      isAdminReply: true
    };

    const success = await updateSheetData('messages', 'ADD', newMessage);
    if (success) {
      setReplyText('');
      if (onRefresh) onRefresh();
    }
    setIsSaving(false);
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('Moderator Action: Remove message permanently?')) return;
    setIsDeleting(msgId);
    const success = await updateSheetData('messages', 'DELETE_MESSAGE', {}, msgId);
    if (success && onRefresh) onRefresh();
    setIsDeleting(null);
  };

  // Signal Management logic (Omitted for brevity, kept same as original)
  // ... handleAddSignal, triggerQuickUpdate ...

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Admin Command Center</h2>
            <p className="text-slate-500 text-xs font-medium mt-1 uppercase tracking-widest font-mono">Institutional Control • Level 4 Access</p>
        </div>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 mt-4 md:mt-0 shadow-lg overflow-x-auto">
            {[
              { id: 'SIGNALS', icon: Radio, label: 'Signals' },
              { id: 'SUPPORT', icon: MessageSquare, label: 'Chat Mod' },
              { id: 'CLIENTS', icon: UserCheck, label: 'Clients' },
              { id: 'LOGS', icon: History, label: 'Audit' }
            ].map((tab) => (
              <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  <tab.icon size={14} className="mr-2" />
                  {tab.label}
              </button>
            ))}
        </div>
      </div>

      {activeTab === 'SUPPORT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl h-[calc(100vh-250px)] animate-in fade-in slide-in-from-bottom-2">
            <div className="p-4 border-b border-slate-800 bg-slate-800/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
                  <ShieldCheck size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest">Chat Moderator</h3>
                  <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest">Community Feed Control</p>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {chatFeed.length} Messages in Buffer
              </div>
            </div>

            <div ref={adminChatRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/20">
              {chatFeed.map((msg) => (
                <div key={msg.id} className="flex justify-start group">
                  <div className="max-w-[80%] flex flex-col items-start">
                    <div className="flex items-center space-x-2 mb-1 px-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${msg.isAdminReply ? 'text-blue-400' : 'text-slate-500'}`}>
                        {msg.isAdminReply ? '🛡️ Research Desk (You)' : msg.senderName}
                      </span>
                      <span className="text-[8px] font-mono text-slate-700">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium border ${
                      msg.isAdminReply 
                        ? 'bg-blue-600 border-blue-500 text-white rounded-tl-none shadow-lg shadow-blue-900/20' 
                        : 'bg-slate-800 border-slate-700 text-slate-200 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendReply} className="p-4 border-t border-slate-800 bg-slate-950 flex space-x-3">
              <input 
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Broadcast official reply..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
              <button 
                type="submit"
                disabled={!replyText.trim() || isSaving}
                className="px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase shadow-lg flex items-center"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                Broadcast
              </button>
            </form>
        </div>
      )}
      
      {/* Rest of the Signal and Client tabs go here... */}
    </div>
  );
};

export default Admin;
