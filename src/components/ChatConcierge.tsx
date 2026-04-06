import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, ListPlus, Plus, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store';
import { askConcierge } from '../services/geminiService';
import { Deal } from '../types';
import Markdown from 'react-markdown';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestedDeals?: Deal[];
};

export default function ChatConcierge() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Bula! I'm your Smart Shopping Concierge. How can I help you save money today? You can ask me things like:\n\n- *\"Where is the cheapest #14 chicken near Suva?\"*\n- *\"I need to buy groceries for a BBQ for 10 people this weekend, what's on sale?\"*\n- *\"What are the best deals on fresh produce?\"*"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiHistory, setApiHistory] = useState<{ role: string; parts: { text: string }[] }[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const allDeals = useAppStore(state => state.deals);
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  const shoppingList = useAppStore(state => state.shoppingList);

  // Filter out expired deals
  const activeDeals = allDeals.filter(d => new Date(d.end_date) >= new Date());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      const response = await askConcierge(userText, apiHistory, activeDeals);
      
      // Match suggested IDs back to actual Deal objects
      const suggestedIds = response.suggested_product_ids || [];
      const suggestedDeals = suggestedIds
        .map(id => activeDeals.find(d => d.product_id === id))
        .filter((d): d is Deal => d !== undefined);

      const newAssistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.message || "I found some deals for you.",
        suggestedDeals: suggestedDeals.length > 0 ? suggestedDeals : undefined
      };

      setMessages(prev => [...prev, newAssistantMsg]);
      
      // Update API history
      setApiHistory(prev => {
        const newHistory = [
          ...prev,
          { role: 'user', parts: [{ text: userText }] },
          { role: 'model', parts: [{ text: JSON.stringify(response) }] }
        ];
        // Keep only the last 10 messages (5 turns) to prevent token overflow
        return newHistory.slice(-10);
      });
      
    } catch (error) {
      console.error("Concierge Error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: "Sorry, I'm having trouble connecting right now. Please try again later."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddAll = (deals: Deal[]) => {
    deals.forEach(deal => {
      // Check if already in list to avoid duplicates if possible, 
      // though addToShoppingList handles quantity increments.
      addToShoppingList(deal);
    });
  };

  const isDealInList = (dealId: string) => {
    return shoppingList.some(item => item.deal.product_id === dealId);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 bg-emerald-600 text-white p-4 rounded-full shadow-xl hover:bg-emerald-700 hover:scale-105 transition-all flex items-center justify-center ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        aria-label="Open Shopping Concierge"
      >
        <Bot className="w-7 h-7" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
        </span>
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[400px] h-[600px] max-h-[calc(100vh-100px)] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight font-display">Shopping Concierge</h3>
              <p className="text-emerald-100 text-xs font-medium">AI-Powered Savings Assistant</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-emerald-100 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                <div 
                  className={`p-3.5 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-sm shadow-sm' 
                      : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
                  }`}
                >
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>

                {/* Suggested Deals UI */}
                {msg.suggestedDeals && msg.suggestedDeals.length > 0 && (
                  <div className="mt-2 bg-white border border-emerald-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-emerald-50/50 px-3 py-2.5 border-b border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                        <ListPlus className="w-3.5 h-3.5" />
                        Suggested Items ({msg.suggestedDeals.length})
                      </div>
                      <button 
                        onClick={() => handleAddAll(msg.suggestedDeals!)}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-sm flex items-center gap-1 transition-colors hover:shadow-md"
                      >
                        <Plus className="w-3 h-3" /> Add All
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                      {msg.suggestedDeals.map((deal, idx) => {
                        const inList = isDealInList(deal.product_id);
                        const price = deal.price || (deal.variants && deal.variants[0]?.price) || 0;
                        return (
                          <div key={`${deal.product_id}-${idx}`} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors group">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors" title={deal.name}>{deal.name}</div>
                              <div className="text-[11px] text-slate-500 truncate font-medium">{deal.store}{deal.location && deal.location !== 'Unknown Location' ? ` • ${deal.location}` : ''}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-black text-emerald-600">${price.toFixed(2)}</div>
                            </div>
                            <button
                              onClick={() => addToShoppingList(deal)}
                              disabled={inList}
                              className={`ml-1 p-2 rounded-xl flex-shrink-0 transition-all ${
                                inList 
                                  ? 'bg-slate-100 text-emerald-600 cursor-default' 
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:scale-105 active:scale-95'
                              }`}
                              title={inList ? "In List" : "Add to List"}
                            >
                              {inList ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Concierge is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all shadow-sm">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about deals, recipes, or planning..."
              className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none resize-none px-3 py-2.5 text-sm focus:outline-none placeholder:text-slate-400"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`p-3 rounded-xl flex-shrink-0 transition-all mb-0.5 mr-0.5 ${
                !input.trim() || isLoading 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[11px] text-center text-slate-400 mt-3 font-medium">
            AI can make mistakes. Verify deals before shopping.
          </div>
        </div>
      </div>
    </>
  );
}
