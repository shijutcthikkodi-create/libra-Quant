
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, MessageSquare, ShieldCheck, Loader2, Clock, Trash2, ShieldAlert } from 'lucide-react';
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

  // Filter messages older than 2 hours
  const activeMessages = useMemo(() => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    return (messages || [])
      .filter(m => {
        const msgTime = new Date(m.timestamp).getTime();
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
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    const newMessage: Partial<ChatMessage> = {
      userId: user.id,
      senderName: user.name,
      text: inputText.trim(),
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <MessageSquare size={24} className="mr-2 text-blue-500" />
            Community Floor
          </h2>
          <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Live discussion • 2h Auto-Cleanup enabled</p>
        </div>
        {user.isAdmin && (
            <div className="flex items-center space-x-2 bg-rose-900/20 border border-rose-500/30 px-3 py-1 rounded-lg">
                <ShieldAlert size={14} className="text-rose-500" />
                <span className="text-[10px] font-bold text-rose-500 uppercase">Moderator View</span>
            </div>
        )}
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {activeMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3 opacity-50">
              <MessageSquare size={48} />
              <p className="text-sm font-bold uppercase tracking-[0.2em]">Awaiting Discussion...</p>
            </div>
          ) : (
            activeMessages.map((msg) => {
              const isOwn = msg.userId === user.id;
              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group items-end space-x-2`}>
                  {!isOwn && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getAvatarColor(msg.senderName)} shrink-0 mb-1`}>
                      {msg.senderName.charAt(0)}
                    </div>
                  )}
                  <div className={`max-w-[80%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center space-x-2 mb-1 px-1">
                      {!isOwn && (
                        <span className={`text-[9px] font-black uppercase tracking-widest ${msg.isAdminReply ? 'text-blue-400' : 'text-slate-500'}`}>
                          {msg.isAdminReply ? '🛡️ Research Desk' : msg.senderName}
                        </span>
                      )}
                      <span className="text-[8px] font-mono text-slate-700">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {user.isAdmin && (
                        <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-rose-500 order-last transition-all">
                          <Trash2 size={12} />
                        </button>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm border shadow-lg ${
                        isOwn 
                          ? 'bg-blue-600 border-blue-500 text-white rounded-tr-none' 
                          : msg.isAdminReply ? 'bg-slate-800 border-blue-500/40 text-blue-100 rounded-tl-none' : 'bg-slate-800 border-slate-700 text-slate-200 rounded-tl-none'
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

        <form onSubmit={handleSend} className="p-4 bg-slate-950/50 border-t border-slate-800 flex items-center space-x-3">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Discuss trades or ask a query..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
          />
          <button type="submit" disabled={!inputText.trim() || isSending} className="w-12 h-12 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg transition-all active:scale-95 disabled:opacity-50">
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Support;
