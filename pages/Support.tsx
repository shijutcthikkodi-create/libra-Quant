
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, MessageSquare, ShieldCheck, Loader2, Clock, Trash2, ShieldAlert, RefreshCw } from 'lucide-react';
import { User, ChatMessage } from '../types';
import { updateSheetData } from '../services/googleSheetsService';

interface SupportProps {
  user: User;
  messages: ChatMessage[];
  onRefresh: () => void;
}

const Support: React.FC<SupportProps> = ({ user, messages, onRefresh }) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Filter messages based on a rolling 2-hour window.
   * Also accounts for potential future timestamps (timezone drift).
   */
  const activeMessages = useMemo(() => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    return (messages || [])
      .filter(m => {
        const msgTime = new Date(m.timestamp).getTime();
        if (isNaN(msgTime)) return false;
        
        // If message is in the "future" (likely timezone drift), keep it.
        if (msgTime > now) return true;
        
        // Otherwise, only keep if it's within the 2-hour window.
        return (now - msgTime) < TWO_HOURS_MS;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    const newMessage: Partial<ChatMessage> = {
      userId: user.id,
      senderName: user.name,
      text: trimmed,
      timestamp: new Date().toISOString(),
      isAdminReply: user.isAdmin
    };

    const success = await updateSheetData('messages', 'ADD', newMessage);
    if (success) {
      setInputText('');
      onRefresh();
    }
    setIsSending(false);
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('Delete this message permanently?')) return;
    await updateSheetData('messages', 'DELETE_MESSAGE', {}, msgId);
    onRefresh();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-emerald-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-180px)] flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <MessageSquare size={24} className="mr-3 text-blue-500" />
            Community Floor
          </h2>
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.15em]">Live discussion • 2h History</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
            <button onClick={onRefresh} className="p-2 text-slate-500 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors">
                <RefreshCw size={14} />
            </button>
            {user.isAdmin && (
                <div className="flex items-center space-x-2 bg-rose-900/20 border border-rose-500/30 px-3 py-1 rounded-lg">
                    <ShieldAlert size={14} className="text-rose-500" />
                    <span className="text-[10px] font-bold text-rose-500 uppercase">Moderator</span>
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-slate-950/20">
          {activeMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-40">
              <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-800">
                <MessageSquare size={32} />
              </div>
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-[0.2em]">Floor Cleared</p>
                <p className="text-[10px] font-mono mt-1">Chat resets every 2 hours to keep data fresh.</p>
              </div>
            </div>
          ) : (
            activeMessages.map((msg) => {
              const isOwn = msg.userId === user.id;
              const isModerator = msg.isAdminReply;
              
              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group items-end space-x-3`}>
                  {!isOwn && (
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white ${getAvatarColor(msg.senderName)} shrink-0 mb-1 shadow-lg`}>
                      {msg.senderName.charAt(0)}
                    </div>
                  )}
                  <div className={`max-w-[85%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center space-x-2 mb-1.5 px-1">
                      {!isOwn && (
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isModerator ? 'text-blue-400' : 'text-slate-400'}`}>
                          {isModerator ? '🛡️ Research Desk' : msg.senderName}
                        </span>
                      )}
                      <span className="text-[9px] font-mono text-slate-600">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {user.isAdmin && (
                        <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-rose-500 order-last transition-all">
                          <Trash2 size={14} />
                        </button>
                      )}
                      <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed border shadow-xl ${
                        isOwn 
                          ? 'bg-blue-600 border-blue-500 text-white rounded-tr-none' 
                          : isModerator ? 'bg-slate-800 border-blue-500/40 text-blue-100 rounded-tl-none font-medium' : 'bg-slate-800 border-slate-700/50 text-slate-200 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-slate-800 flex items-center space-x-4 shadow-inner">
          <div className="flex-1 relative">
            <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Discuss trades or report levels..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all shadow-xl placeholder:text-slate-700"
            />
          </div>
          <button type="submit" disabled={!inputText.trim() || isSending} className="w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all active:scale-90 disabled:opacity-50 disabled:grayscale">
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Support;
