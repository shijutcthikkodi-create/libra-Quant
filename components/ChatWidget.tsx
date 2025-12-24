
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Send, X, User, ShieldCheck, Loader2, ChevronLeft, Users } from 'lucide-react';
import { ChatMessage, User as UserType } from '../types';

interface ChatWidgetProps {
  messages: ChatMessage[];
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

  // Determine which user's thread to show
  // If Client: always show their own thread
  // If Admin: show selected thread from list
  const currentChatUserId = isAdmin ? selectedChatUserId : user.id;

  const filteredMessages = useMemo(() => {
    if (!currentChatUserId) return [];
    return messages.filter(m => m.userId === currentChatUserId);
  }, [messages, currentChatUserId]);

  // Admin view: list of users who have sent messages
  const adminThreads = useMemo(() => {
    if (!isAdmin) return [];
    const threadMap = new Map<string, { lastMsg: ChatMessage; user: UserType | undefined }>();
    messages.forEach(m => {
      const u = users.find(usr => usr.id === m.userId);
      if (!threadMap.has(m.userId) || new Date(m.timestamp) > new Date(threadMap.get(m.userId)!.lastMsg.timestamp)) {
        threadMap.set(m.userId, { lastMsg: m, user: u });
      }
    });
    return Array.from(threadMap.entries()).sort((a, b) => 
      new Date(b[1].lastMsg.timestamp).getTime() - new Date(a[1].lastMsg.timestamp).getTime()
    );
  }, [messages, users, isAdmin]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && currentChatUserId) scrollToBottom();
  }, [filteredMessages, isOpen, currentChatUserId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending || !currentChatUserId) return;

    setIsSending(true);
    const success = await onSendMessage(inputText.trim(), isAdmin, currentChatUserId);
    if (success) {
      setInputText('');
    }
    setIsSending(false);
  };

  const hasNewAdminMessages = useMemo(() => {
    if (isAdmin) return false; // Handled differently for admin
    if (filteredMessages.length === 0) return false;
    const last = filteredMessages[filteredMessages.length - 1];
    return last.isAdminReply;
  }, [filteredMessages, isAdmin]);

  const chatTitle = isAdmin 
    ? (selectedChatUserId ? (users.find(u => u.id === selectedChatUserId)?.name || 'Chat') : 'Messages')
    : 'Support Desk';

  return (
    <div className="fixed bottom-24 md:bottom-20 right-4 z-[120] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 md:w-96 h-[480px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isAdmin && selectedChatUserId && (
                <button onClick={() => setSelectedChatUserId(null)} className="p-1 text-slate-400 hover:text-white transition-colors mr-1">
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isAdmin ? 'bg-purple-600/20 text-purple-400 border-purple-500/20' : 'bg-blue-600/20 text-blue-500 border-blue-500/20'}`}>
                {isAdmin && !selectedChatUserId ? <Users size={20} /> : <ShieldCheck size={20} />}
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">{chatTitle}</h3>
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">{isAdmin ? 'Admin Console' : 'Online Now'}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-500 hover:text-white rounded-lg">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/30">
            {isAdmin && !selectedChatUserId ? (
              /* ADMIN USER LIST VIEW */
              <div className="space-y-2">
                {adminThreads.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 opacity-30">
                    <Users size={40} className="mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No Client Threads</p>
                  </div>
                ) : (
                  adminThreads.map(([uid, data]) => (
                    <button 
                      key={uid}
                      onClick={() => setSelectedChatUserId(uid)}
                      className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3 hover:border-blue-500/50 transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 font-black group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {data.user?.name.slice(0, 1).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[11px] font-black text-white truncate">{data.user?.name || 'Guest'}</span>
                          <span className="text-[8px] font-bold text-slate-500 whitespace-nowrap">{new Date(data.lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate leading-tight">{data.lastMsg.text}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              /* CHAT THREAD VIEW */
              <>
                {filteredMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <MessageSquare size={40} className="text-slate-800 mb-3 opacity-20" />
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
                      {isAdmin ? 'Initiate contact with client.' : 'How can we help you today?\nAsk anything about signals.'}
                    </p>
                  </div>
                ) : (
                  filteredMessages.map((msg, idx) => {
                    const isSelf = isAdmin ? msg.isAdminReply : !msg.isAdminReply;
                    return (
                      <div key={idx} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed shadow-lg ${
                          isSelf 
                            ? (isAdmin ? 'bg-purple-600 text-white rounded-tr-none shadow-purple-600/10' : 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/10')
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                        }`}>
                          {msg.text}
                        </div>
                        <span className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-tighter">
                          {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {(currentChatUserId) && (
            <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-slate-800">
              <div className="relative">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type message..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-xs text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                />
                <button 
                  type="submit" 
                  disabled={!inputText.trim() || isSending}
                  className={`absolute right-2 top-2 p-1.5 text-white rounded-lg transition-all ${isAdmin ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 border-4 border-slate-950 ${
          isOpen 
            ? 'bg-slate-800 text-white rotate-90 border-slate-700' 
            : (isAdmin ? 'bg-purple-600 text-white shadow-purple-600/30' : 'bg-blue-600 text-white shadow-blue-600/30')
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && hasNewAdminMessages && (
           <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 border-2 border-slate-950 rounded-full animate-bounce flex items-center justify-center text-[8px] font-black text-white">!</span>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;
