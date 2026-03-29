import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Trash2, Plus, Minus, ShoppingBag, Tag, MapPin, TrendingDown, Share2, Copy, CheckCircle2 } from 'lucide-react';
import { getEffectivePrice, isBasicNeed, getStoreCoordinates, getDistanceFromLatLonInKm } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

export default function ShoppingList() {
  const { shoppingList, removeFromShoppingList, clearShoppingList, updateQuantity, optimizeShoppingList, deals: allDeals, userLocation, selectedRegion, addSavings } = useAppStore();
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const navigate = useNavigate();

  // Filter deals based on selected region
  const localDeals = useMemo(() => {
    const regionCoords = selectedRegion !== 'all' && selectedRegion !== 'current' ? getStoreCoordinates(selectedRegion) : null;

    return allDeals.filter(d => {
      let distance = Infinity;
      const coords = getStoreCoordinates(d.location);
      if (coords) {
        if (selectedRegion === 'current' && userLocation) {
          distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
        } else if (regionCoords) {
          distance = getDistanceFromLatLonInKm(regionCoords.lat, regionCoords.lon, coords.lat, coords.lon);
        }
      }

      if (selectedRegion === 'all') return true;
      if (selectedRegion === 'current' && !userLocation) return true;
      return distance <= 50 || distance === Infinity;
    });
  }, [allDeals, userLocation, selectedRegion]);

  // Calculate savings per item and total
  const { totalSavings, totalPrice, itemSavings } = useMemo(() => {
    let savings = 0;
    let price = 0;
    const itemSavingsMap = new Map<string, number>();
    const now = new Date();

    shoppingList.forEach(item => {
      const currentPrice = getEffectivePrice(item.deal);
      const isExpired = new Date(item.deal.end_date) < now;
      
      price += currentPrice * item.quantity;

      // Find comparable deals to calculate average
      const comparableDeals = localDeals.filter(d => 
        d?.name?.toLowerCase().trim() === item.deal?.name?.toLowerCase().trim() &&
        new Date(d.end_date) >= now // Only compare against active deals
      );
      
      if (!isExpired && comparableDeals.length > 1) {
        const avgPrice = comparableDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0) / comparableDeals.length;
        const itemSaving = avgPrice - currentPrice;
        if (itemSaving > 0) {
          savings += itemSaving * item.quantity;
          itemSavingsMap.set(item.product_id, itemSaving);
        }
      }
    });

    return { totalSavings: savings, totalPrice: price, itemSavings: itemSavingsMap };
  }, [shoppingList, localDeals]);

  // Trip Optimizer Logic
  const tripOptimizer = useMemo(() => {
    const now = new Date();
    const activeItems = shoppingList.filter(item => new Date(item.deal.end_date) >= now);
    
    if (activeItems.length === 0) return null;

    let currentTotal = 0;
    let optimizedTotal = 0;
    let isOptimized = true;
    const optimizedItems: typeof shoppingList = [];
    const storeGroups = new Map<string, number>();

    activeItems.forEach(item => {
      const currentPrice = getEffectivePrice(item.deal);
      currentTotal += currentPrice * item.quantity;

      const normalizedName = item.deal?.name?.toLowerCase().trim() || '';
      const comparableDeals = allDeals.filter(d => 
        d?.name?.toLowerCase().trim() === normalizedName &&
        new Date(d.end_date) >= now
      );

      let bestDeal = item.deal;
      let bestPrice = currentPrice;

      if (comparableDeals.length > 0) {
        const cheapest = comparableDeals.reduce((best, current) => 
          getEffectivePrice(current) < getEffectivePrice(best) ? current : best
        );
        const cheapestPrice = getEffectivePrice(cheapest);
        
        if (cheapestPrice < currentPrice) {
          bestDeal = cheapest;
          bestPrice = cheapestPrice;
          isOptimized = false;
        }
      }

      optimizedTotal += bestPrice * item.quantity;
      optimizedItems.push({ ...item, deal: bestDeal, product_id: bestDeal.product_id });
      
      storeGroups.set(bestDeal.store, (storeGroups.get(bestDeal.store) || 0) + item.quantity);
    });

    const savings = currentTotal - optimizedTotal;

    return {
      isOptimized,
      currentTotal,
      optimizedTotal,
      savings,
      optimizedItems,
      storeGroups: Array.from(storeGroups.entries()).sort((a, b) => b[1] - a[1])
    };
  }, [shoppingList, allDeals]);

  const generateExportText = () => {
    let text = `🛒 My Smart Shopping List\n`;
    text += `========================\n\n`;
    
    shoppingList.forEach(item => {
      const price = getEffectivePrice(item.deal);
      text += `[ ] ${item.quantity}x ${item.deal.name}\n`;
      text += `    @ ${item.deal.store}${item.deal.location && item.deal.location !== 'Unknown Location' ? ` (${item.deal.location})` : ''} - $${(price * item.quantity).toFixed(2)}\n`;
    });
    
    text += `\n========================\n`;
    text += `Estimated Total: $${totalPrice.toFixed(2)}\n`;
    if (totalSavings > 0) {
      text += `Total Savings: $${totalSavings.toFixed(2)}\n`;
    }
    
    if (tripOptimizer && tripOptimizer.storeGroups.length > 0) {
      text += `\n📍 Best Stores to Visit:\n`;
      tripOptimizer.storeGroups.forEach(([store, count], idx) => {
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

  const handleCheckout = () => {
    if (totalSavings > 0) {
      addSavings(totalSavings);
    }
    clearShoppingList();
    setShowCheckoutConfirm(false);
    navigate('/savings');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 font-display">Your Shopping List</h1>
        <p className="text-slate-500 mt-2 font-medium">
          Track your items and see how much you're saving across different stores.
        </p>
      </div>

      {shoppingList.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2 font-display">Your list is empty</h2>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto font-medium">
            Start adding items from the deals page to track your savings.
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-md"
          >
            Browse Deals
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {shoppingList.map((item, index) => {
              const savingPerItem = itemSavings.get(item.product_id) || 0;
              const totalItemSaving = savingPerItem * item.quantity;
              const currentPrice = getEffectivePrice(item.deal);
              const isExpired = new Date(item.deal.end_date) < new Date();

              return (
                <div key={`${item.product_id}-${index}`} className={`bg-white border ${isExpired ? 'border-red-200 opacity-90' : 'border-slate-100 shadow-sm hover:shadow-md transition-shadow'} rounded-3xl p-4 flex gap-4 items-center relative overflow-hidden`}>
                  {/* Savings Indicator Strip */}
                  {totalItemSaving > 0 && !isExpired && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
                  )}
                  {isExpired && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
                  )}
                  
                  {item.deal.image_url ? (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center p-2 flex-shrink-0">
                      <img 
                        src={item.deal.image_url} 
                        alt={item.deal.name} 
                        className={`max-w-full max-h-full object-contain mix-blend-multiply ${isExpired ? 'grayscale' : ''}`}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 border border-slate-100">
                      <ShoppingBag className="w-8 h-8 text-slate-300" />
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
                        <h4 className="font-bold text-slate-900 truncate flex items-center gap-2 font-display" title={item.deal.name}>
                          {item.deal.name}
                          {isExpired && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                              Expired
                            </span>
                          )}
                          {isBasicNeed(item.deal) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 uppercase tracking-wider">
                              Basic Need
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 font-medium">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{item.deal.store}{item.deal.location && item.deal.location !== 'Unknown Location' ? ` • ${item.deal.location}` : ''}</span>
                        </div>
                      </div>
                      
                      <div className="text-left sm:text-right flex-shrink-0">
                        <div className={`font-black text-lg font-display ${isExpired ? 'text-red-600 line-through opacity-70' : 'text-slate-900'}`}>
                          ${(currentPrice * item.quantity).toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          ${currentPrice.toFixed(2)} each
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-3 mt-3">
                      <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1 border border-slate-100">
                        <button
                          onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors shadow-sm"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4">
                        {totalItemSaving > 0 && !isExpired && (
                          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                            <TrendingDown className="w-3 h-3" />
                            Save ${totalItemSaving.toFixed(2)}
                          </div>
                        )}
                        {isExpired && (
                          <div className="text-xs font-medium text-red-500">
                            Price no longer valid
                          </div>
                        )}
                        <button
                          onClick={() => setItemToDelete(item.product_id)}
                          className="text-slate-400 hover:text-red-500 p-2 transition-colors bg-slate-50 hover:bg-red-50 rounded-xl"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-1 space-y-6">
            {/* Trip Optimizer */}
            {tripOptimizer && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-6 relative overflow-hidden shadow-sm">
                <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-200 rounded-full opacity-20 blur-3xl"></div>
                <h3 className="text-emerald-900 font-bold mb-3 flex items-center gap-2 relative z-10 font-display">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  Smart Trip Optimizer
                </h3>
                
                {!tripOptimizer.isOptimized ? (
                  <>
                    <p className="text-emerald-800 text-sm mb-4 relative z-10 leading-relaxed font-medium">
                      We found better deals for some of your items! You can save an additional <strong className="font-black text-emerald-900">${tripOptimizer.savings.toFixed(2)}</strong> by optimizing your list.
                    </p>
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 relative z-10 space-y-3 mb-5 border border-emerald-100/50">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="text-slate-600">Current Total:</span>
                        <span className="font-bold text-slate-900 line-through">${tripOptimizer.currentTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-emerald-700 font-bold">Optimized Total:</span>
                        <span className="font-black text-emerald-700 text-lg">${tripOptimizer.optimizedTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => optimizeShoppingList(tripOptimizer.optimizedItems)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm hover:shadow-md relative z-10 flex items-center justify-center gap-2"
                    >
                      Apply Optimization
                    </button>
                  </>
                ) : (
                  <p className="text-emerald-800 text-sm relative z-10 leading-relaxed font-medium bg-white/60 p-4 rounded-2xl border border-emerald-100/50">
                    ✨ Your list is fully optimized! You have the best possible prices for all active items.
                  </p>
                )}
              </div>
            )}

            {/* Store Recommendations */}
            {tripOptimizer && tripOptimizer.storeGroups.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 shadow-sm">
                <h3 className="text-blue-900 font-bold mb-3 flex items-center gap-2 font-display">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Stores to Visit
                </h3>
                <p className="text-blue-800 text-sm mb-4 font-medium">Based on your {tripOptimizer.isOptimized ? 'optimized' : 'current'} list:</p>
                <div className="space-y-2">
                  {tripOptimizer.storeGroups.map(([store, count], index) => (
                    <div key={store} className="flex justify-between items-center bg-white/80 backdrop-blur-sm rounded-2xl p-3 border border-blue-100/50 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <span className="font-bold text-slate-900">{store}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">{count} item{count > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Card */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 sticky top-24 shadow-xl border border-slate-800">
              <h3 className="text-lg font-bold mb-6 font-display">List Summary</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-slate-400 font-medium">
                  <span>Items</span>
                  <span className="text-white font-bold">{shoppingList.reduce((acc, item) => acc + item.quantity, 0)}</span>
                </div>
                <div className="flex justify-between text-slate-400 font-medium">
                  <span>Subtotal</span>
                  <span className="text-white font-bold">${totalPrice.toFixed(2)}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium bg-emerald-400/10 p-3 rounded-xl -mx-3 border border-emerald-400/20">
                    <span className="flex items-center gap-1.5"><Tag className="w-4 h-4" /> Total Savings</span>
                    <span className="font-bold">${totalSavings.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-5 mb-6">
                <div className="flex justify-between items-end">
                  <span className="text-slate-400 font-medium mb-1">Estimated Total</span>
                  <span className="text-4xl font-black font-display tracking-tight">${totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowCheckoutConfirm(true)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md mb-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Checkout & Save
                </button>
                <button 
                  onClick={handleShare}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                >
                  <Share2 className="w-5 h-5" />
                  Share List
                </button>
                <button 
                  onClick={handleCopy}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Copy className="w-5 h-5" />
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCheckoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">Complete Shopping?</h3>
            <p className="text-slate-500 mb-6 font-medium">
              Are you done shopping? This will clear your list and add <strong className="text-emerald-600">${totalSavings.toFixed(2)}</strong> to your savings history.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowCheckoutConfirm(false)} 
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleCheckout} 
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">Remove Item?</h3>
            <p className="text-slate-500 mb-8 font-medium">Are you sure you want to remove this item from your shopping list?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)} 
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                  removeFromShoppingList(itemToDelete); 
                  setItemToDelete(null); 
                }} 
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
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
