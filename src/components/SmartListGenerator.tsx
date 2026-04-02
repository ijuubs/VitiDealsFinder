import React, { useState } from 'react';
import { useAppStore } from '../store';
import { X, Sparkles, Plus, CheckCircle2, ShoppingBag, Users, DollarSign, Leaf, Loader2 } from 'lucide-react';
import { getEffectivePrice, isBasicNeed, BASIC_NEED_KEYWORDS } from '../utils/helpers';
import { Deal } from '../types';

export default function SmartListGenerator({ onClose }: { onClose: () => void }) {
  const allDeals = useAppStore(state => state.deals);
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  
  const [familySize, setFamilySize] = useState<number>(2);
  const [budget, setBudget] = useState<number>(100);
  const [diet, setDiet] = useState<string>('any');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedList, setGeneratedList] = useState<{deal: Deal, quantity: number}[] | null>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const now = new Date();
      let activeDeals = allDeals.filter(d => new Date(d.end_date) >= now);
      if (activeDeals.length === 0) activeDeals = allDeals; // Fallback to all deals if none are active
      
      let basicNeeds = activeDeals.filter(d => isBasicNeed(d));
      
      if (diet === 'vegetarian') {
        basicNeeds = basicNeeds.filter(d => {
          const name = d.name.toLowerCase();
          return !name.includes('chicken') && !name.includes('meat') && !name.includes('beef') && !name.includes('lamb') && !name.includes('fish') && !name.includes('sardine') && !name.includes('mackerel');
        });
      }
      
      const grouped = new Map<string, Deal[]>();
      basicNeeds.forEach(d => {
        const textToSearch = `${d.name} ${d.category} ${d.subcategory} ${d.brand}`.toLowerCase();
        
        // Find which keyword matched
        const matchedKeyword = BASIC_NEED_KEYWORDS.find(kw => textToSearch.includes(kw)) || d.name.toLowerCase().trim();
        
        if (!grouped.has(matchedKeyword)) grouped.set(matchedKeyword, []);
        grouped.get(matchedKeyword)!.push(d);
      });
      
      const cheapestOptions: Deal[] = [];
      grouped.forEach(group => {
        const cheapest = group.reduce((best, curr) => 
          getEffectivePrice(curr) < getEffectivePrice(best) ? curr : best
        );
        cheapestOptions.push(cheapest);
      });
      
      // Sort by price (lowest first) to fit more items in budget
      cheapestOptions.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
      
      const multiplier = Math.max(1, Math.ceil(familySize / 2));
      
      let currentTotal = 0;
      const newList: {deal: Deal, quantity: number}[] = [];
      
      // Prioritize these essential keywords first
      const priorityKeywords = ['rice', 'flour', 'chicken', 'dhal', 'milk', 'cooking oil', 'soap', 'toilet paper'];
      
      // First pass: Add one of each priority item if it fits the budget
      for (const kw of priorityKeywords) {
        const item = cheapestOptions.find(d => {
          const textToSearch = `${d.name} ${d.category} ${d.subcategory} ${d.brand}`.toLowerCase();
          return textToSearch.includes(kw);
        });
        
        if (item && !newList.some(i => i.deal.product_id === item.product_id)) {
          const price = getEffectivePrice(item);
          const qty = multiplier;
          if (currentTotal + (price * qty) <= budget) {
            newList.push({ deal: item, quantity: qty });
            currentTotal += price * qty;
          }
        }
      }
      
      // Second pass: Fill the rest of the budget with other cheapest options
      for (const item of cheapestOptions) {
        if (currentTotal >= budget * 0.95) break;
        if (!newList.some(i => i.deal.product_id === item.product_id)) {
          const price = getEffectivePrice(item);
          const qty = multiplier;
          if (currentTotal + (price * qty) <= budget) {
            newList.push({ deal: item, quantity: qty });
            currentTotal += price * qty;
          }
        }
      }
      
      setGeneratedList(newList);
      setIsGenerating(false);
    }, 1500);
  };

  const handleAddToList = () => {
    if (generatedList) {
      generatedList.forEach(item => {
        for(let i = 0; i < item.quantity; i++) {
            addToShoppingList(item.deal);
        }
      });
      onClose();
    }
  };

  const totalCost = generatedList?.reduce((acc, item) => acc + (getEffectivePrice(item.deal) * item.quantity), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 font-display">Smart List Generator</h2>
              <p className="text-sm text-slate-500 font-medium">Auto-build a budget-friendly essentials list</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-grow hide-scrollbar">
          {!generatedList ? (
            <div className="space-y-8">
              {/* Configuration Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Weekly Budget ($)
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder="Enter amount"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Family Size
                  </label>
                  <div className="flex items-center gap-3">
                    {[1, 2, 4, 6].map(size => (
                      <button
                        key={size}
                        onClick={() => setFamilySize(size)}
                        className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                          familySize === size 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {size}{size === 6 ? '+' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-emerald-500" />
                  Dietary Preference
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDiet('any')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${
                      diet === 'any' 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Any
                  </button>
                  <button
                    onClick={() => setDiet('vegetarian')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${
                      diet === 'vegetarian' 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Vegetarian
                  </button>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Generating Smart List...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Generate Shopping List
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-indigo-900 text-lg">Your Smart List</h3>
                  <p className="text-indigo-700 text-sm font-medium">{generatedList.length} essential items for {familySize} people</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-indigo-600 font-bold uppercase tracking-wider mb-1">Total Est. Cost</div>
                  <div className="text-3xl font-black text-indigo-700">${totalCost.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-3">
                {generatedList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0 p-1 border border-slate-100">
                      {item.deal.image_url ? (
                        <img src={item.deal.image_url} alt={item.deal.name} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{item.deal.name}</h4>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                        <span>{item.deal.store}</span>
                        <span>•</span>
                        <span>Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-slate-900">${(getEffectivePrice(item.deal) * item.quantity).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                
                {generatedList.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    Could not find enough deals to match your criteria. Try increasing your budget.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {generatedList && (
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
            <button
              onClick={() => setGeneratedList(null)}
              className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleAddToList}
              disabled={generatedList.length === 0}
              className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              Add All to My List
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
