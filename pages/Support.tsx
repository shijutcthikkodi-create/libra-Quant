
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, MessageSquare, ShieldCheck, Loader2, User as UserIcon, Clock, Trash2, ShieldAlert } from 'lucide-react';
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
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Community view: Sort messages chronologically
  // Added useMemo to React imports to resolve 'Cannot find name useMemo' error
  const chatMessages = useMemo(() => {
    return [...(messages || [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    const newMessage: any = {
      id: `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
    if (!window.confirm('Moderator Action: Delete this message for everyone?')) return;
    setIsDeleting(msgId);
    const success = await updateSheetData('messages', 'DELETE_MESSAGE', {}, msgId);
    if (success) {
      onRefresh();
    }
    setIsDeleting(null);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-180px)] flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <MessageSquare size={24} className="mr-2 text-blue-500" />
            Community Chat
          </h2>
          <p className="text-slate-500 text-[10px] font-mono uppercase tracking-tighter">Verified subscribers floor • Real-time discussion</p>
        </div>
        <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Public Feed</span>
            </div>
            {user.isAdmin && (
                <div className="flex items-center space-x-2 bg-rose-900/20 border border-rose-500/30 px-3 py-1.5 rounded-lg animate-pulse">
                    <ShieldAlert size={14} className="text-rose-500" />
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Mod Active</span>
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]"></div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar relative z-10 pb-24">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
              <MessageSquare size={48} className="text-slate-700" />
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Welcome to the floor. Be the first to speak.</p>
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isOwn = msg.userId === user.id;
              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center space-x-2 mb-1 px-1">
                      {!isOwn && (
                        <span className={`text-[9px] font-black uppercase tracking-widest ${msg.isAdminReply ? 'text-blue-400' : 'text-slate-500'}`}>
                          {msg.isAdminReply ? '🛡️ Research Desk' : msg.senderName}
                        </span>
                      )}
                      <span className="text-[8px] font-mono text-slate-700">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOwn && <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">You</span>}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {user.isAdmin && (
                        <button 
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={isDeleting === msg.id}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-rose-500 transition-all rounded-lg hover:bg-rose-500/10 order-last"
                        >
                          {isDeleting === msg.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      )}
                      
                      <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium shadow-xl border ${
                        isOwn 
                          ? 'bg-blue-600 border-blue-500 text-white rounded-tr-none' 
                          : msg.isAdminReply 
                            ? 'bg-slate-800 border-blue-500/40 text-blue-100 rounded-tl-none'
                            : 'bg-slate-800 border-slate-700 text-slate-200 rounded-tl-none'
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

        <form onSubmit={handleSend} className="absolute bottom-0 left-0 right-0 p-4 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 flex items-center space-x-3 z-20">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask a doubt or share a view..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
          />
          <button 
            type="submit" 
            disabled={!inputText.trim() || isSending}
            className="w-14 h-14 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/40"
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>
      
      <div className="flex items-center justify-center space-x-6 text-[10px] text-slate-600 font-mono uppercase tracking-widest">
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
            {new Set(messages.map(m => m.userId)).size} active members
          </div>
          <div className="flex items-center">
            <Clock size={10} className="mr-2" /> Live
          </div>
      </div>
    </div>
  );
};

export default Support;
