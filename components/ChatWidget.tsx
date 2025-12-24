
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, User, ShieldCheck, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatWidgetProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<boolean>;
  userId: string;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ messages, onSendMessage, userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredMessages = messages.filter(m => m.userId === userId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [filteredMessages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    const success = await onSendMessage(inputText.trim());
    if (success) {
      setInputText('');
    }
    setIsSending(false);
  };

  return (
    <div className="fixed bottom-24 md:bottom-20 right-4 z-[70] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 md:w-96 h-[450px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/20">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Support Desk</h3>
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Online Now</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-500 hover:text-white rounded-lg">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/30">
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <MessageSquare size={40} className="text-slate-800 mb-3 opacity-20" />
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
                  How can we help you today?<br/>Ask anything about your terminal or signals.
                </p>
              </div>
            ) : (
              filteredMessages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.isAdminReply ? 'items-start' : 'items-end'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed shadow-lg ${
                    msg.isAdminReply 
                      ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700' 
                      : 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/10'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-tighter">
                    {msg.isAdminReply ? 'Libra Support' : 'You'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-slate-800">
            <div className="relative">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message..." 
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-xs text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
              />
              <button 
                type="submit" 
                disabled={!inputText.trim() || isSending}
                className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all"
              >
                {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </form>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
          isOpen ? 'bg-slate-800 text-white rotate-90 border border-slate-700' : 'bg-blue-600 text-white shadow-blue-600/30'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && filteredMessages.length > 0 && filteredMessages[filteredMessages.length-1].isAdminReply && (
           <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 border-2 border-slate-950 rounded-full animate-bounce"></span>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;
