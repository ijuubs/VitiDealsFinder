import React, { useMemo, useState, useEffect } from 'react';
import { X, Trophy, TrendingDown, AlertCircle, ShoppingBag, Tag, MapPin, Info, CheckCircle2, ShoppingCart, Navigation, SlidersHorizontal, Maximize2, Layers, History, Bell, ListPlus, PackageSearch } from 'lucide-react';
import { Deal } from '../types';
import { useAppStore } from '../store';
import { getStoreCoordinates, getDistanceFromLatLonInKm, getEffectivePrice, getNormalizedPrice, isBasicNeed } from '../utils/helpers';

export default function CompareModal({ deal, onClose }: { deal: Deal, onClose: () => void }) {
  const allDeals = useAppStore(state => state.deals);
  const shoppingList = useAppStore(state => state.shoppingList);
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [showAlertSet, setShowAlertSet] = useState(false);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  const comparableDeals = useMemo(() => {
    return allDeals.filter(d => d.name.toLowerCase().trim() === deal.name.toLowerCase().trim());
  }, [allDeals, deal.name]);

  const sortedDeals = [...comparableDeals].sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
  
  const bestDeal = sortedDeals[0];
  const bestPrice = getEffectivePrice(bestDeal);
  const currentPrice = getEffectivePrice(deal);
  
  const averagePrice = sortedDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0) / sortedDeals.length;
  
  const absoluteSavings = averagePrice - currentPrice;
  const percentageSavings = averagePrice > 0 ? (absoluteSavings / averagePrice) * 100 : 0;

  const hasMultipleStores = sortedDeals.length > 1;

  // Add distance to all sorted deals
  const dealsWithDistance = useMemo(() => {
    return sortedDeals.map(d => {
      let distance = Infinity;
      if (userLocation) {
        const coords = getStoreCoordinates(d.location);
        if (coords) {
          distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
        }
      }
      return { ...d, distance };
    });
  }, [sortedDeals, userLocation]);

  // Find Closest Best Deal
  const closestBestDeal = useMemo(() => {
    const minPrice = Math.min(...dealsWithDistance.map(d => getEffectivePrice(d)));
    const bestPriceDeals = dealsWithDistance.filter(d => getEffectivePrice(d) === minPrice);
    if (bestPriceDeals.length === 0) return null;
    return bestPriceDeals.reduce((prev, curr) => (prev.distance < curr.distance ? prev : curr), bestPriceDeals[0]);
  }, [dealsWithDistance]);

  // Find Best Local Deal (within 20km)
  const bestLocalDeal = useMemo(() => {
    if (!userLocation) return null;
    const localDeals = dealsWithDistance.filter(d => d.distance < 20);
    if (localDeals.length === 0) return null;
    
    localDeals.sort((a, b) => {
      const priceA = getEffectivePrice(a);
      const priceB = getEffectivePrice(b);
      if (priceA !== priceB) return priceA - priceB;
      return a.distance - b.distance;
    });
    
    return localDeals[0];
  }, [dealsWithDistance, userLocation]);

  // Similar Products (Same category, different name, nearby)
  const similarProducts = useMemo(() => {
    if (!deal.category) return [];
    
    const similar = allDeals
      .filter(d => d.category === deal.category && d.name.toLowerCase().trim() !== deal.name.toLowerCase().trim())
      .map(d => {
        let distance = Infinity;
        if (userLocation) {
          const coords = getStoreCoordinates(d.location);
          if (coords) {
            distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
          }
        }
        return { ...d, distance };
      })
      .filter(d => d.distance < 20) // Only nearby
      .sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));

    // Deduplicate by name to show variety
    const uniqueSimilar = [];
    const seenNames = new Set();
    for (const item of similar) {
      if (!seenNames.has(item.name)) {
        seenNames.add(item.name);
        uniqueSimilar.push(item);
        if (uniqueSimilar.length >= 3) break;
      }
    }
    return uniqueSimilar;
  }, [allDeals, deal, userLocation]);

  // Smart Insight Engine
  const smartInsight = useMemo(() => {
    if (currentPrice === bestPrice && hasMultipleStores) {
      return { type: 'success', text: "This is the cheapest price available. Good time to stock up." };
    } else if (currentPrice > bestPrice) {
      return { type: 'warning', text: `Cheaper at ${bestDeal.store} by $${(currentPrice - bestPrice).toFixed(2)}` };
    } else if (absoluteSavings > 0) {
      return { type: 'success', text: "Price is lower than usual. Consider stocking up." };
    } else {
      return { type: 'neutral', text: "Not the best deal right now." };
    }
  }, [currentPrice, bestPrice, hasMultipleStores, absoluteSavings, bestDeal.store]);

  // Mock Price History
  const priceHistory = useMemo(() => {
    const avg30Days = averagePrice * 1.05; // mock
    const minPrice = bestPrice * 0.9; // mock
    const maxPrice = averagePrice * 1.2; // mock
    return { avg30Days, minPrice, maxPrice };
  }, [averagePrice, bestPrice]);

  const { pricePerKg, unit } = getNormalizedPrice(deal);

  // Calculate Total Savings Potential
  const totalSavingsPotential = useMemo(() => {
    let potential = 0;
    const processedProductNames = new Set<string>();

    // Calculate potential savings for items already in the list
    shoppingList.forEach(item => {
      const normalizedName = item.deal.name.toLowerCase().trim();
      processedProductNames.add(normalizedName);

      const itemDeals = allDeals.filter(d => d.name.toLowerCase().trim() === normalizedName);
      if (itemDeals.length > 1) {
        const avg = itemDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0) / itemDeals.length;
        const cheapest = Math.min(...itemDeals.map(d => getEffectivePrice(d)));
        const maxSavings = avg - cheapest;
        if (maxSavings > 0) {
          potential += maxSavings * item.quantity;
        }
      }
    });

    // Add potential savings for the current item if it's not in the list
    const currentNormalizedName = deal.name.toLowerCase().trim();
    if (!processedProductNames.has(currentNormalizedName)) {
      if (hasMultipleStores) {
        const maxSavingsForCurrent = averagePrice - bestPrice;
        if (maxSavingsForCurrent > 0) {
          potential += maxSavingsForCurrent; // Assuming quantity 1
        }
      }
    }

    return potential;
  }, [shoppingList, allDeals, deal.name, hasMultipleStores, averagePrice, bestPrice]);

  const handleAddToList = () => {
    addToShoppingList(bestDeal);
    onClose();
  };

  return (
    <>
      {isImageZoomed && deal.image_url && (
        <div 
          className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-md"
          onClick={() => setIsImageZoomed(false)}
        >
          <button className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 p-2 rounded-full transition-colors">
            <X className="w-8 h-8" />
          </button>
          <img 
            src={deal.image_url} 
            alt={deal.name} 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm sm:p-6">
        <div className="bg-slate-50 rounded-3xl max-w-2xl w-full relative max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
          {/* Header Actions */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button onClick={() => setShowAlertSet(true)} className="w-8 h-8 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm" title="Set Price Alert">
              <Bell className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="w-8 h-8 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all shadow-sm">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-grow hide-scrollbar">
            {/* 1. Product Name + Image */}
            <div className="bg-white p-6 sm:p-8 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {deal.image_url ? (
                  <div 
                    className="w-32 h-32 sm:w-40 sm:h-40 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center p-4 flex-shrink-0 cursor-zoom-in group relative overflow-hidden"
                    onClick={() => setIsImageZoomed(true)}
                  >
                    <img 
                      src={deal.image_url} 
                      alt={deal.name} 
                      className="max-w-full max-h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                      <Maximize2 className="w-6 h-6 text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                    </div>
                  </div>
                ) : (
                  <div className="w-32 h-32 sm:w-40 sm:h-40 bg-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                
                <div className="flex-grow">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {deal.brand && (
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {deal.brand}
                      </span>
                    )}
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      {deal.category}
                    </span>
                    {isBasicNeed(deal) && (
                      <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" /> Basic Need
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-2">{deal.name}</h2>
                  {deal.weight && <p className="text-slate-500 font-medium">{deal.weight}</p>}
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-8">
              {/* 2. Price + Savings (PRIMARY FOCUS) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-4xl font-black text-slate-900">${currentPrice.toFixed(2)}</span>
                      {pricePerKg ? (
                        <span className="text-slate-500 font-medium mb-1">/ {unit}</span>
                      ) : (
                        deal.unit && <span className="text-slate-500 font-medium mb-1">/ {deal.unit}</span>
                      )}
                    </div>
                    {pricePerKg && pricePerKg !== currentPrice && (
                      <div className="text-sm font-medium text-slate-500">
                        ≈ ${pricePerKg.toFixed(2)} / kg
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-slate-500 mb-1">Avg: ${averagePrice.toFixed(2)}</div>
                    {absoluteSavings > 0 ? (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-sm font-bold">
                        <TrendingDown className="w-4 h-4" />
                        Save ${absoluteSavings.toFixed(2)} ({percentageSavings.toFixed(1)}%)
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl text-sm font-bold">
                        <Info className="w-4 h-4" />
                        Standard Price
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Best Store Recommendation */}
              {userLocation && bestLocalDeal && (
                <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-800 p-2 rounded-xl text-emerald-400">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Best option near you</h4>
                      <p className="text-slate-300 text-sm mt-0.5">
                        {bestLocalDeal.store} ({bestLocalDeal.distance.toFixed(1)}km)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-lg text-emerald-400">${getEffectivePrice(bestLocalDeal).toFixed(2)}</div>
                  </div>
                </div>
              )}

              {/* 4. Smart Insight Message */}
              <div className={`rounded-2xl p-4 flex items-start gap-3 border ${
                smartInsight.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                smartInsight.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <div className={`p-2 rounded-xl flex-shrink-0 ${
                  smartInsight.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                  smartInsight.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                  'bg-slate-200 text-slate-600'
                }`}>
                  {smartInsight.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                   smartInsight.type === 'warning' ? <AlertCircle className="w-5 h-5" /> :
                   <Info className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold">Smart Insight</h4>
                  <p className="text-sm mt-0.5 font-medium">{smartInsight.text}</p>
                </div>
              </div>

              {/* Smart Recommendation */}
              {hasMultipleStores && absoluteSavings > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-xl text-blue-600 flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900">Smart Recommendation: Top Pick</h4>
                    <p className="text-blue-800 text-sm mt-0.5">
                      Shopping at <strong>{bestDeal.store}</strong> saves you <strong>${absoluteSavings.toFixed(2)}</strong> compared to the market average. This is a highly competitive price.
                    </p>
                  </div>
                </div>
              )}

              {/* Total Savings Potential */}
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="bg-purple-100 p-2 rounded-xl text-purple-600 flex-shrink-0">
                  <ListPlus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-purple-900">Total Savings Potential</h4>
                  <p className="text-purple-800 text-sm mt-0.5">
                    If you buy all items on your list (plus this one) at their cheapest stores, you could save a total of <strong>${totalSavingsPotential.toFixed(2)}</strong>!
                  </p>
                </div>
              </div>

              {/* 5. Store Comparison */}
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-slate-400" />
                  Store Comparison
                </h3>
                <div className="space-y-3">
                  {dealsWithDistance.map((d, idx) => {
                    const price = getEffectivePrice(d);
                    const diff = price - bestPrice;
                    const isBest = idx === 0;
                    const isCurrent = d.product_id === deal.product_id;
                    const isClosestBest = closestBestDeal?.product_id === d.product_id;

                    let distanceStr = '';
                    if (d.distance !== Infinity) {
                      distanceStr = `${d.distance.toFixed(1)} km`;
                    }

                    return (
                      <div key={d.product_id} className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isCurrent ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500 ring-opacity-50' : isClosestBest ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500 ring-opacity-50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${isClosestBest ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                              {d.store}
                              {isClosestBest && (
                                <span className="bg-emerald-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                  Closest & Best
                                </span>
                              )}
                              {isBest && !isClosestBest && (
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                  Best Price
                                </span>
                              )}
                              {isCurrent && !isClosestBest && (
                                <span className="bg-blue-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-500 flex items-center gap-1">
                              {d.location}
                              {distanceStr && (
                                <>
                                  <span>•</span>
                                  <Navigation className="w-3 h-3" />
                                  {distanceStr}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/3">
                          <div className="text-left sm:text-right">
                            <div className="font-black text-lg text-slate-900">
                              ${price.toFixed(2)}
                            </div>
                          </div>
                          
                          <div className="w-20 text-right">
                            {diff > 0 ? (
                              <span className="text-sm font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                                +${diff.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-sm font-bold text-emerald-500">
                                Lowest
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Similar Products Comparison */}
              {similarProducts.length > 0 && (
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                    <PackageSearch className="w-5 h-5 text-slate-400" />
                    Similar Products Nearby
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {similarProducts.map((simDeal, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">{simDeal.brand || simDeal.category}</div>
                          <h4 className="font-bold text-slate-900 text-sm mb-2 line-clamp-2" title={simDeal.name}>{simDeal.name}</h4>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                            <MapPin className="w-3 h-3" />
                            {simDeal.store} ({simDeal.distance !== Infinity ? `${simDeal.distance.toFixed(1)}km` : simDeal.location})
                          </div>
                        </div>
                        <div className="flex items-end justify-between mt-auto">
                          <div className="font-black text-lg text-slate-900">${getEffectivePrice(simDeal).toFixed(2)}</div>
                          {getEffectivePrice(simDeal) < currentPrice && (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                              Cheaper
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Variants (if any) */}
              {deal.variants && deal.variants.length > 0 && (
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-slate-400" />
                    Available Options
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {deal.variants.map((v, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                        <div className="font-bold text-slate-900 mb-1">{v.label}</div>
                        <div className="text-sm text-slate-500 mb-2">{v.weight_estimate}</div>
                        <div className="font-black text-emerald-600">${v.price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. Price History */}
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-400" />
                  Price History Insight
                </h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-slate-500">Usually:</div>
                    <div className="font-bold text-slate-900">${priceHistory.minPrice.toFixed(2)} – ${priceHistory.maxPrice.toFixed(2)}</div>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-slate-500">Today:</div>
                    <div className="font-black text-lg text-slate-900">${currentPrice.toFixed(2)}</div>
                  </div>
                  <div className={`text-sm font-bold px-3 py-2 rounded-xl inline-block ${
                    currentPrice < priceHistory.avg30Days ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    → {currentPrice < priceHistory.avg30Days ? 'Below average price' : 'Above average price'}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 8. Add to List Button */}
          <div className="bg-white border-t border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={handleAddToList}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              Add to Shopping List
            </button>
          </div>
        </div>
      </div>

      {/* Price Alert Mock Modal */}
      {showAlertSet && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-2">Set Price Alert</h3>
            <p className="text-slate-500 text-sm mb-4">Notify me when {deal.name} drops below:</p>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xl font-black text-slate-400">$</span>
              <input type="number" defaultValue={(currentPrice * 0.9).toFixed(2)} className="w-full text-2xl font-black text-slate-900 border-b-2 border-slate-200 focus:border-emerald-500 focus:outline-none pb-1" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAlertSet(false)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl">Cancel</button>
              <button onClick={() => setShowAlertSet(false)} className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl">Set Alert</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
