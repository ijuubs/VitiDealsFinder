import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Trash2, Plus, Minus, ShoppingBag, Tag, MapPin, TrendingDown, Share2, Copy } from 'lucide-react';
import { getEffectivePrice } from '../utils/helpers';

export default function ShoppingList() {
  const { shoppingList, removeFromShoppingList, updateQuantity, deals: allDeals } = useAppStore();
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Calculate savings per item and total
  const { totalSavings, totalPrice, itemSavings } = useMemo(() => {
    let savings = 0;
    let price = 0;
    const itemSavingsMap = new Map<string, number>();

    shoppingList.forEach(item => {
      const currentPrice = getEffectivePrice(item.deal);
      price += currentPrice * item.quantity;

      // Find comparable deals to calculate average
      const comparableDeals = allDeals.filter(d => d.name.toLowerCase().trim() === item.deal.name.toLowerCase().trim());
      if (comparableDeals.length > 1) {
        const avgPrice = comparableDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0) / comparableDeals.length;
        const itemSaving = avgPrice - currentPrice;
        if (itemSaving > 0) {
          savings += itemSaving * item.quantity;
          itemSavingsMap.set(item.product_id, itemSaving);
        }
      }
    });

    return { totalSavings: savings, totalPrice: price, itemSavings: itemSavingsMap };
  }, [shoppingList, allDeals]);

  // Group by cheapest store
  const storeRecommendations = useMemo(() => {
    const storeCounts = new Map<string, number>();
    
    shoppingList.forEach(item => {
      // Find the absolute best deal for this item
      const comparableDeals = allDeals.filter(d => d.name.toLowerCase().trim() === item.deal.name.toLowerCase().trim());
      if (comparableDeals.length > 0) {
        const bestDeal = comparableDeals.reduce((best, current) => 
          getEffectivePrice(current) < getEffectivePrice(best) ? current : best
        );
        
        const storeName = bestDeal.store;
        storeCounts.set(storeName, (storeCounts.get(storeName) || 0) + 1);
      }
    });

    // Sort stores by number of cheapest items
    return Array.from(storeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Top 3 stores
  }, [shoppingList, allDeals]);

  const generateExportText = () => {
    let text = `🛒 My Smart Shopping List\n`;
    text += `========================\n\n`;
    
    shoppingList.forEach(item => {
      const price = getEffectivePrice(item.deal);
      text += `[ ] ${item.quantity}x ${item.deal.name}\n`;
      text += `    @ ${item.deal.store} (${item.deal.location}) - $${(price * item.quantity).toFixed(2)}\n`;
    });
    
    text += `\n========================\n`;
    text += `Estimated Total: $${totalPrice.toFixed(2)}\n`;
    if (totalSavings > 0) {
      text += `Total Savings: $${totalSavings.toFixed(2)}\n`;
    }
    
    if (storeRecommendations.length > 0) {
      text += `\n📍 Best Stores to Visit:\n`;
      storeRecommendations.forEach(([store, count], idx) => {
        text += `${idx + 1}. ${store} (${count} items)\n`;
      });
    }
    
    return text;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateExportText());
      alert('List copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleShare = async () => {
    const text = generateExportText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Smart Shopping List',
          text: text,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Your Shopping List</h1>
        <p className="text-slate-500 mt-2">
          Track your items and see how much you're saving across different stores.
        </p>
      </div>

      {shoppingList.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Your list is empty</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Browse the deals and add items to your shopping list to start saving.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {shoppingList.map((item) => {
              const savingPerItem = itemSavings.get(item.product_id) || 0;
              const totalItemSaving = savingPerItem * item.quantity;
              const currentPrice = getEffectivePrice(item.deal);

              return (
                <div key={item.product_id} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 items-center relative overflow-hidden">
                  {/* Savings Indicator Strip */}
                  {totalItemSaving > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
                  )}
                  
                  {item.deal.image_url ? (
                    <div className="w-20 h-20 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center p-2 flex-shrink-0">
                      <img 
                        src={item.deal.image_url} 
                        alt={item.deal.name} 
                        className="max-w-full max-h-full object-contain mix-blend-multiply"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  
                  <div className="flex-grow min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        {item.deal.brand && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            {item.deal.brand}
                          </span>
                        )}
                        <h4 className="font-bold text-slate-900 truncate" title={item.deal.name}>{item.deal.name}</h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{item.deal.store} • {item.deal.location}</span>
                        </div>
                      </div>
                      
                      <div className="text-left sm:text-right flex-shrink-0">
                        <div className="font-black text-lg text-slate-900">
                          ${(currentPrice * item.quantity).toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500">
                          ${currentPrice.toFixed(2)} each
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-3 mt-3">
                      <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1 border border-slate-200">
                        <button
                          onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4">
                        {totalItemSaving > 0 && (
                          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                            <TrendingDown className="w-3 h-3" />
                            Save ${totalItemSaving.toFixed(2)}
                          </div>
                        )}
                        <button
                          onClick={() => setItemToDelete(item.product_id)}
                          className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-1 space-y-6">
            {/* Store Recommendations */}
            {storeRecommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                <h3 className="text-blue-900 font-black mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Best Stores to Visit
                </h3>
                <p className="text-blue-800 text-sm mb-4">Based on the cheapest prices for your items:</p>
                <div className="space-y-2">
                  {storeRecommendations.map(([store, count], index) => (
                    <div key={store} className="flex justify-between items-center bg-white/60 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <span className="font-bold text-slate-900">{store}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-600">{count} item{count > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Card */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 sticky top-24 shadow-xl">
              <h3 className="text-lg font-bold mb-6">List Summary</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-slate-300">
                  <span>Items</span>
                  <span>{shoppingList.reduce((acc, item) => acc + item.quantity, 0)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium bg-emerald-400/10 p-2 rounded-lg -mx-2">
                    <span className="flex items-center gap-1"><Tag className="w-4 h-4" /> Total Savings</span>
                    <span>${totalSavings.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-700 pt-4 mb-6">
                <div className="flex justify-between items-end">
                  <span className="text-slate-300 font-medium">Estimated Total</span>
                  <span className="text-3xl font-black">${totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleShare}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  Share List
                </button>
                <button 
                  onClick={handleCopy}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-5 h-5" />
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-2">Remove Item?</h3>
            <p className="text-slate-500 mb-6 font-medium">Are you sure you want to remove this item from your shopping list?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                  removeFromShoppingList(itemToDelete); 
                  setItemToDelete(null); 
                }} 
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
