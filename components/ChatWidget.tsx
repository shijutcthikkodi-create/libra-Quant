
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Send, X, User as UserIcon, ShieldCheck, Loader2, ChevronLeft, Users, AlertCircle, Clock } from 'lucide-react';
import { ChatMessage, User as UserType } from '../types';

interface ChatWidgetProps {
  messages: (ChatMessage & { status?: 'sending' | 'failed' })[];
  onSendMessage: (text: string, isAdminReply?: boolean, targetUserId?: string) => Promise<boolean>;
  user: UserType;
  users?: UserType[];
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ messages, onSendMessage, user, users = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = user.isAdmin;
  const adminId = (user.id || user.phoneNumber || '').trim();

  // The "Effective User ID" is the owner of the thread. 
  // For a client, it's their own ID. For an Admin, it's whoever they are currently chatting with.
  const currentChatUserId = isAdmin ? selectedChatUserId : adminId;

  const filteredMessages = useMemo(() => {
    if (!currentChatUserId) return [];
    return messages
      .filter(m => m.userId === currentChatUserId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, currentChatUserId]);

  /**
   * Admin Thread Discovery Logic:
   * 1. Iterate through ALL messages.
   * 2. Every unique userId (that isn't the admin's personal ID) is a thread.
   */
  const adminThreads = useMemo(() => {
    if (!isAdmin) return [];
    
    const threadMap = new Map<string, { lastMsg: ChatMessage; userMeta: UserType | undefined }>();
    
    messages.forEach(m => {
      const mid = (m.userId || '').trim();
      if (!mid || mid === adminId) return; // Ignore admin-only system messages or empty IDs

      // Try to find matching user metadata if available
      const u = users.find(usr => (usr.id || '').trim() === mid || (usr.phoneNumber || '').trim() === mid);
      
      const existing = threadMap.get(mid);
      if (!existing || new Date(m.timestamp) > new Date(existing.lastMsg.timestamp)) {
        threadMap.set(mid, { lastMsg: m, userMeta: u });
      }
    });

    return Array.from(threadMap.entries()).sort((a, b) => 
      new Date(b[1].lastMsg.timestamp).getTime() - new Date(a[1].lastMsg.timestamp).getTime()
    );
  }, [messages, users, isAdmin, adminId]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isOpen && currentChatUserId) {
        const timer = setTimeout(scrollToBottom, 200);
        return () => clearTimeout(timer);
    }
  }, [filteredMessages.length, isOpen, currentChatUserId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending || !currentChatUserId) return;

    setIsSending(true);
    const textToSend = inputText.trim();
    setInputText(''); 
    
    const success = await onSendMessage(textToSend, isAdmin, currentChatUserId);
    setIsSending(false);
  };

  const hasNewClientMessages = useMemo(() => {
    if (!isAdmin) return false;
    // Notify admin if the absolute last message in the entire pool is from a client
    if (messages.length === 0) return false;
    const sorted = [...messages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return sorted[0] && !sorted[0].isAdminReply && sorted[0].userId !== adminId;
  }, [messages, isAdmin, adminId]);

  const hasNewSupportMessages = useMemo(() => {
    if (isAdmin) return false;
    if (filteredMessages.length === 0) return false;
    const last = filteredMessages[filteredMessages.length - 1];
    return last.isAdminReply;
  }, [filteredMessages, isAdmin]);

  const getChatTitle = () => {
    if (!isAdmin) return 'Libra Support';
    if (!selectedChatUserId) return 'Client Enquiries';
    
    const u = users.find(u => u.id === selectedChatUserId || u.phoneNumber === selectedChatUserId);
    return u?.name || `Subscriber ${selectedChatUserId.slice(-4)}`;
  };

  return (
    <div className="fixed bottom-24 md:bottom-20 right-4 z-[120] flex flex-col items-end pointer-events-auto">
      {isOpen && (
        <div className="mb-4 w-[88vw] md:w-96 h-[520px] max-h-[75vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between shadow-lg relative z-10">
            <div className="flex items-center space-x-3 overflow-hidden">
              {isAdmin && selectedChatUserId && (
                <button onClick={() => setSelectedChatUserId(null)} className="p-1 text-slate-400 hover:text-white transition-colors mr-1">
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${isAdmin ? 'bg-purple-600/20 text-purple-400 border-purple-500/20' : 'bg-blue-600/20 text-blue-500 border-blue-500/20'}`}>
                {isAdmin && !selectedChatUserId ? <Users size={20} /> : <ShieldCheck size={20} />}
              </div>
              <div className="truncate">
                <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1 truncate">{getChatTitle()}</h3>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,1)]"></span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{isAdmin ? 'Admin Console' : 'Support Online'}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-500 hover:text-white rounded-lg transition-colors ml-2">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/30 scroll-smooth">
            {isAdmin && !selectedChatUserId ? (
              /* Admin Thread Selection */
              <div className="space-y-2">
                {adminThreads.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 opacity-30">
                    <MessageSquare size={40} className="mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No Client Threads Detected</p>
                  </div>
                ) : (
                  adminThreads.map(([uid, data]) => (
                    <button 
                      key={uid}
                      onClick={() => setSelectedChatUserId(uid)}
                      className={`w-full p-3 border rounded-xl flex items-center space-x-3 transition-all text-left group ${!data.lastMsg.isAdminReply ? 'bg-blue-600/10 border-blue-500/40 ring-1 ring-blue-500/20 shadow-lg' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black transition-colors ${!data.lastMsg.isAdminReply ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
                        {data.userMeta?.name.slice(0, 1).toUpperCase() || uid.slice(-1).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[11px] font-black text-white truncate">{data.userMeta?.name || `Subscriber ${uid.slice(-4)}`}</span>
                          <span className="text-[8px] font-bold text-slate-600 whitespace-nowrap">{new Date(data.lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className={`text-[10px] truncate leading-tight ${!data.lastMsg.isAdminReply ? 'text-blue-400 font-bold' : 'text-slate-500 italic'}`}>
                          {data.lastMsg.isAdminReply ? 'You: ' : ''}{data.lastMsg.text}
                        </p>
                      </div>
                      {!data.lastMsg.isAdminReply && (
                         <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      )}
                    </button>
                  ))
                )}
              </div>
            ) : (
              /* Message Thread View */
              <>
                {filteredMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <MessageSquare size={40} className="text-slate-800 mb-4 opacity-20" />
                    <p className="text-[11px] text-slate-600 font-bold uppercase tracking-[0.2em] leading-relaxed whitespace-pre-wrap">
                      {isAdmin ? 'NO MESSAGES IN THIS THREAD' : 'START A CONVERSATION\nSUPPORT IS MONITORING'}
                    </p>
                  </div>
                ) : (
                  filteredMessages.map((msg, idx) => {
                    const isSelf = isAdmin ? msg.isAdminReply : !msg.isAdminReply;
                    return (
                      <div key={msg.id || idx} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed shadow-lg relative ${
                          isSelf 
                            ? (isAdmin ? 'bg-purple-600 text-white rounded-tr-none shadow-purple-600/10' : 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/10')
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                        }`}>
                          {msg.text}
                          
                          {msg.status === 'sending' && (
                            <div className="absolute -bottom-4 right-0 flex items-center text-[8px] font-black text-slate-600 uppercase tracking-tighter">
                              <Clock size={8} className="mr-1 animate-pulse" /> Sending...
                            </div>
                          )}
                          {msg.status === 'failed' && (
                            <div className="absolute -bottom-4 right-0 flex items-center text-[8px] font-black text-rose-500 uppercase tracking-tighter">
                              <AlertCircle size={8} className="mr-1" /> Delivery Failed
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-tighter opacity-70">
                          {msg.isAdminReply ? 'Libra Support' : (msg.senderName || 'Subscriber')} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} className="h-4" />
              </>
            )}
          </div>

          {/* Footer Input */}
          {(currentChatUserId || !isAdmin) && (
            <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-slate-800 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
              <div className="relative group">
                <input 
                  type="text" 
                  value={inputText}
                  autoComplete="off"
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={currentChatUserId ? "Type message..." : "Select thread..."}
                  disabled={isAdmin && !currentChatUserId}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-xs text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-700 disabled:opacity-50 font-medium"
                />
                <button 
                  type="submit" 
                  disabled={!inputText.trim() || isSending || (isAdmin && !currentChatUserId)}
                  className={`absolute right-1.5 top-1.5 p-2 text-white rounded-lg transition-all shadow-lg ${isAdmin ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'} disabled:opacity-50 disabled:grayscale disabled:pointer-events-none hover:scale-105 active:scale-95`}
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Floating Bubble */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 hover:scale-110 active:scale-90 border-4 border-slate-950 relative overflow-hidden group/btn ${
          isOpen 
            ? 'bg-slate-800 text-white rotate-90 border-slate-700' 
            : (isAdmin ? 'bg-purple-600 text-white shadow-purple-600/40' : 'bg-blue-600 text-white shadow-blue-600/40')
        }`}
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
        {isOpen ? <X size={24} /> : <MessageSquare size={24} strokeWidth={2.5} />}
        
        {/* Unread Indicator */}
        {!isOpen && (hasNewSupportMessages || hasNewClientMessages) && (
           <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 border-2 border-slate-950 rounded-full animate-bounce flex items-center justify-center text-[8px] font-black text-white shadow-lg">!</span>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;
