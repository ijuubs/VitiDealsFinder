import React, { useMemo, useState, useEffect } from 'react';
import { X, Trophy, TrendingDown, AlertCircle, ShoppingBag, Tag, MapPin, Info, CheckCircle2, Navigation, SlidersHorizontal, Maximize2, Layers, History, Bell, ListPlus, PackageSearch, Star, Leaf } from 'lucide-react';
import { Deal } from '../types';
import { useAppStore } from '../store';
import { getStoreCoordinates, getDistanceFromLatLonInKm, getEffectivePrice, getNormalizedPrice, isBasicNeed, isFoodItem } from '../utils/helpers';

export default function CompareModal({ deal, onClose }: { deal: Deal, onClose: () => void }) {
  const allDeals = useAppStore(state => state.deals);
  const shoppingList = useAppStore(state => state.shoppingList);
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  const userLocation = useAppStore(state => state.userLocation);
  const selectedRegion = useAppStore(state => state.selectedRegion);
  const priceAlerts = useAppStore(state => state.priceAlerts);
  const addPriceAlert = useAppStore(state => state.addPriceAlert);
  const removePriceAlert = useAppStore(state => state.removePriceAlert);
  
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [showAlertSet, setShowAlertSet] = useState(false);
  const [alertPriceInput, setAlertPriceInput] = useState('');

  const currentPrice = getEffectivePrice(deal);

  const existingAlert = priceAlerts.find(a => a.productId === deal.product_id);

  useEffect(() => {
    if (showAlertSet) {
      setAlertPriceInput(existingAlert ? existingAlert.targetPrice.toFixed(2) : (currentPrice * 0.9).toFixed(2));
    }
  }, [showAlertSet, existingAlert, currentPrice]);

  const handleSetAlert = () => {
    const targetPrice = parseFloat(alertPriceInput);
    if (!isNaN(targetPrice) && targetPrice > 0) {
      addPriceAlert(deal.product_id, targetPrice);
      setShowAlertSet(false);
    }
  };

  const handleRemoveAlert = () => {
    removePriceAlert(deal.product_id);
    setShowAlertSet(false);
  };

  const comparableDeals = useMemo(() => {
    const regionCoords = selectedRegion !== 'all' && selectedRegion !== 'current' ? getStoreCoordinates(selectedRegion) : null;

    return allDeals.filter(d => {
      if (d?.name?.toLowerCase().trim() !== deal?.name?.toLowerCase().trim()) return false;
      if (d.product_id === deal.product_id) return true; // Always include the current deal
      
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
  }, [allDeals, deal.name, deal.product_id, selectedRegion, userLocation]);

  const sortedDeals = [...comparableDeals].sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
  
  const bestDeal = sortedDeals[0];
  const bestPrice = getEffectivePrice(bestDeal);
  
  const averagePrice = sortedDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0) / sortedDeals.length;
  
  const absoluteSavings = averagePrice - currentPrice;
  const percentageSavings = averagePrice > 0 ? (absoluteSavings / averagePrice) * 100 : 0;

  const hasMultipleStores = sortedDeals.length > 1;

  // Add distance to all sorted deals
  const dealsWithDistance = useMemo(() => {
    const regionCoords = selectedRegion !== 'all' && selectedRegion !== 'current' ? getStoreCoordinates(selectedRegion) : null;

    return sortedDeals.map(d => {
      let distance = Infinity;
      const coords = getStoreCoordinates(d.location);
      if (coords) {
        if (selectedRegion === 'current' && userLocation) {
          distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
        } else if (regionCoords) {
          distance = getDistanceFromLatLonInKm(regionCoords.lat, regionCoords.lon, coords.lat, coords.lon);
        } else if (userLocation) {
          distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
        }
      }
      return { ...d, distance };
    });
  }, [sortedDeals, userLocation, selectedRegion]);

  // Find Closest Best Deal
  const closestBestDeal = useMemo(() => {
    const minPrice = Math.min(...dealsWithDistance.map(d => getEffectivePrice(d)));
    const bestPriceDeals = dealsWithDistance.filter(d => getEffectivePrice(d) === minPrice);
    if (bestPriceDeals.length === 0) return null;
    return bestPriceDeals.reduce((prev, curr) => (prev.distance < curr.distance ? prev : curr), bestPriceDeals[0]);
  }, [dealsWithDistance]);

  // Find Best Local Deal (within 20km)
  const bestLocalDeal = useMemo(() => {
    if (selectedRegion === 'current' && !userLocation) return null;
    if (selectedRegion === 'all' && !userLocation) return null;
    
    const localDeals = dealsWithDistance.filter(d => d.distance < 20);
    if (localDeals.length === 0) return null;
    
    localDeals.sort((a, b) => {
      const priceA = getEffectivePrice(a);
      const priceB = getEffectivePrice(b);
      if (priceA !== priceB) return priceA - priceB;
      return a.distance - b.distance;
    });
    
    return localDeals[0];
  }, [dealsWithDistance, userLocation, selectedRegion]);

  // Similar Products (Same category, different name, nearby)
  const similarProducts = useMemo(() => {
    if (!deal.category) return [];
    
    const regionCoords = selectedRegion !== 'all' && selectedRegion !== 'current' ? getStoreCoordinates(selectedRegion) : null;

    const similar = allDeals
      .filter(d => d.category === deal.category && d?.name?.toLowerCase().trim() !== deal?.name?.toLowerCase().trim())
      .map(d => {
        let distance = Infinity;
        const coords = getStoreCoordinates(d.location);
        if (coords) {
          if (selectedRegion === 'current' && userLocation) {
            distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
          } else if (regionCoords) {
            distance = getDistanceFromLatLonInKm(regionCoords.lat, regionCoords.lon, coords.lat, coords.lon);
          } else if (userLocation) {
            distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
          }
        }
        return { ...d, distance };
      })
      .filter(d => {
        if (selectedRegion === 'all') return true;
        if (selectedRegion === 'current' && !userLocation) return true;
        return d.distance <= 50 || d.distance === Infinity; // Use 50km to match the main view
      })
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
  }, [allDeals, deal, userLocation, selectedRegion]);

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

  // Real Price History Insight
  const priceHistory = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const historicalDeals = allDeals.filter(d => {
      if (d?.name?.toLowerCase().trim() !== deal?.name?.toLowerCase().trim()) return false;
      if (!d.start_date) return true;
      const dealDate = new Date(d.start_date);
      return dealDate >= thirtyDaysAgo;
    });

    if (historicalDeals.length === 0) {
      return { avg30Days: currentPrice, minPrice: currentPrice, maxPrice: currentPrice, count: 1 };
    }

    const prices = historicalDeals.map(d => getEffectivePrice(d));
    const avg30Days = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return { avg30Days, minPrice, maxPrice, count: historicalDeals.length };
  }, [allDeals, deal.name, currentPrice]);

  const { pricePerKg, unit } = getNormalizedPrice(deal);

  // Mock data generators for enhanced UI
  const rating = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < deal.name.length; i++) {
      hash = deal.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const r = (Math.abs(hash) % 20) / 10 + 3.5; // 3.5 to 5.0
    return Math.min(5, Math.max(1, r)).toFixed(1);
  }, [deal.name]);

  const reviewCount = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < deal.name.length; i++) {
      hash = deal.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 500 + 10;
  }, [deal.name]);

  const sparklineData = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < deal.name.length; i++) {
      hash = deal.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const basePrice = currentPrice;
    const points = [];
    for (let i = 0; i < 10; i++) {
      const variance = ((Math.abs(hash + i * 10) % 20) - 10) / 100; // -10% to +10%
      points.push(basePrice * (1 + variance));
    }
    points.push(currentPrice); // Last point is current price
    return points;
  }, [deal.name, currentPrice]);

  const sparklinePath = useMemo(() => {
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;
    const width = 120;
    const height = 40;
    const step = width / (sparklineData.length - 1);
    
    return sparklineData.map((val, i) => {
      const x = i * step;
      const y = height - ((val - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [sparklineData]);

  const nutriScore = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < deal.name.length; i++) {
      hash = deal.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const scores = ['A', 'B', 'C', 'D', 'E'];
    return scores[Math.abs(hash) % 5];
  }, [deal.name]);
  
  const nutriColor = {
    'A': 'bg-emerald-600',
    'B': 'bg-emerald-400',
    'C': 'bg-yellow-400',
    'D': 'bg-orange-500',
    'E': 'bg-red-600'
  }[nutriScore];

  // Calculate Total Savings Potential
  const totalSavingsPotential = useMemo(() => {
    let potential = 0;
    const processedProductNames = new Set<string>();

    // Calculate potential savings for items already in the list
    shoppingList.forEach(item => {
      const normalizedName = item.deal?.name?.toLowerCase().trim() || '';
      processedProductNames.add(normalizedName);

      const itemDeals = allDeals.filter(d => d?.name?.toLowerCase().trim() === normalizedName);
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
    const currentNormalizedName = deal?.name?.toLowerCase().trim() || '';
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
            <button 
              onClick={() => setShowAlertSet(true)} 
              className={`w-8 h-8 backdrop-blur-md rounded-full flex items-center justify-center transition-all shadow-sm ${
                existingAlert 
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                  : 'bg-white/80 text-slate-500 hover:text-blue-600 hover:bg-blue-50'
              }`} 
              title={existingAlert ? 'Update Price Alert' : 'Set Price Alert'}
            >
              <Bell className={`w-4 h-4 ${existingAlert ? 'fill-current' : ''}`} />
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
                    {deal.tags?.map((tag, idx) => {
                      let colorClass = "bg-slate-100 text-slate-700";
                      const lowerTag = tag.toLowerCase();
                      if (lowerTag.includes('halal')) colorClass = "bg-blue-100 text-blue-700";
                      else if (lowerTag.includes('veg') || lowerTag.includes('plant')) colorClass = "bg-green-100 text-green-700";
                      else if (lowerTag.includes('sugar')) colorClass = "bg-red-100 text-red-700";
                      else if (lowerTag.includes('free')) colorClass = "bg-purple-100 text-purple-700";
                      
                      return (
                        <span key={idx} className={`${colorClass} text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider`}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-2">{deal.name}</h2>
                  {deal.weight && <p className="text-slate-500 font-medium mb-3">Size: {deal.weight}</p>}
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center text-amber-400">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-bold text-slate-700 ml-1">{rating}</span>
                      </div>
                      <span className="text-xs text-slate-400">({reviewCount} reviews)</span>
                    </div>
                    
                    {isBasicNeed(deal) && isFoodItem(deal) && (
                      <div className="flex items-center gap-1.5" title="Nutritional Score">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Nutri-Score</span>
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-white font-black text-xs ${nutriColor}`}>
                          {nutriScore}
                        </div>
                      </div>
                    )}
                  </div>
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

              {/* Price History & Nutritional Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Price History */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-400" />
                    Price History (30 Days)
                  </h4>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Current vs Avg</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-slate-900">${currentPrice.toFixed(2)}</span>
                        <span className="text-sm text-slate-400 line-through">${priceHistory.avg30Days.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <svg width="120" height="40" className="overflow-visible">
                        <path d={sparklinePath} fill="none" stroke={deal.price_trend === 'dropping' ? '#10b981' : deal.price_trend === 'rising' ? '#ef4444' : '#3b82f6'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${
                        deal.price_trend === 'dropping' ? 'text-emerald-600' : 
                        deal.price_trend === 'rising' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {deal.price_trend === 'dropping' ? 'Trending Down' : 
                         deal.price_trend === 'rising' ? 'Trending Up' : 'Price Stable'}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-3 mt-3">
                    <span>Min: ${priceHistory.minPrice.toFixed(2)}</span>
                    <span>Max: ${priceHistory.maxPrice.toFixed(2)}</span>
                  </div>
                </div>

                {/* Nutritional Info (Mock) */}
                {isBasicNeed(deal) && isFoodItem(deal) && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Leaf className="w-4 h-4 text-slate-400" />
                      Nutritional Info (Est.)
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Calories</div>
                        <div className="font-black text-slate-900">{(Math.abs(deal.name.length * 15) % 300 + 50)} kcal</div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Protein</div>
                        <div className="font-black text-slate-900">{(Math.abs(deal.name.length * 3) % 20 + 1)}g</div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Carbs</div>
                        <div className="font-black text-slate-900">{(Math.abs(deal.name.length * 8) % 50 + 5)}g</div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Fat</div>
                        <div className="font-black text-slate-900">{(Math.abs(deal.name.length * 2) % 15 + 0.5).toFixed(1)}g</div>
                      </div>
                    </div>
                  </div>
                )}
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
              {totalSavingsPotential > 0 && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-200 rounded-full opacity-30 blur-2xl"></div>
                  <h3 className="text-emerald-900 font-black mb-2 flex items-center gap-2 relative z-10">
                    <Trophy className="w-5 h-5 text-emerald-600" />
                    Total Savings Potential
                  </h3>
                  <p className="text-emerald-800 text-sm mb-3 relative z-10">
                    If you buy this item and all items on your current shopping list at their cheapest stores, you could save:
                  </p>
                  <div className="flex items-baseline gap-2 relative z-10">
                    <span className="text-3xl font-black text-emerald-700">${totalSavingsPotential.toFixed(2)}</span>
                    <span className="text-sm font-bold text-emerald-500 uppercase tracking-wider">Total</span>
                  </div>
                </div>
              )}

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
                      <div key={`${d.product_id}-${idx}`} className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isCurrent ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500 ring-opacity-50' : isClosestBest ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500 ring-opacity-50' : 'border-slate-200 bg-white'}`}>
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
                              {d.location && d.location !== 'Unknown Location' ? d.location : null}
                              {distanceStr && (
                                <>
                                  {d.location && d.location !== 'Unknown Location' ? <span>•</span> : null}
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
                            {simDeal.store} {simDeal.distance !== Infinity ? `(${simDeal.distance.toFixed(1)}km)` : (simDeal.location && simDeal.location !== 'Unknown Location' ? `(${simDeal.location})` : '')}
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
                  Price History Insight (30 Days)
                </h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Average</span>
                      <span className="text-lg font-black text-slate-900">${priceHistory.avg30Days.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Lowest</span>
                      <span className="text-lg font-black text-emerald-700">${priceHistory.minPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 bg-red-50 rounded-xl border border-red-100">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Highest</span>
                      <span className="text-lg font-black text-red-700">${priceHistory.maxPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-slate-500">Today's Price:</div>
                    <div className="font-black text-xl text-slate-900">${currentPrice.toFixed(2)}</div>
                  </div>
                  
                  <div className={`w-full text-center text-sm font-bold px-4 py-3 rounded-xl ${
                    currentPrice < priceHistory.avg30Days ? 'bg-emerald-100 text-emerald-700' : 
                    currentPrice > priceHistory.avg30Days ? 'bg-amber-100 text-amber-700' : 
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {currentPrice < priceHistory.avg30Days ? '↓ Below average price' : 
                     currentPrice > priceHistory.avg30Days ? '↑ Above average price' : 
                     '→ Exactly average price'}
                  </div>
                  
                  <p className="text-[10px] text-slate-400 mt-4 text-center font-medium uppercase tracking-wider">
                    Based on {priceHistory.count} recorded price{priceHistory.count !== 1 ? 's' : ''}
                  </p>
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
              <ListPlus className="w-5 h-5" />
              Add to Shopping List
            </button>
          </div>
        </div>
      </div>

      {/* Price Alert Modal */}
      {showAlertSet && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-2">
              {existingAlert ? 'Update Price Alert' : 'Set Price Alert'}
            </h3>
            <p className="text-slate-500 text-sm mb-4">Notify me when {deal.name} drops below:</p>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xl font-black text-slate-400">$</span>
              <input 
                type="number" 
                value={alertPriceInput}
                onChange={(e) => setAlertPriceInput(e.target.value)}
                className="w-full text-2xl font-black text-slate-900 border-b-2 border-slate-200 focus:border-emerald-500 focus:outline-none pb-1" 
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAlertSet(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors">Cancel</button>
              {existingAlert && (
                <button onClick={handleRemoveAlert} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2.5 rounded-xl transition-colors">Remove</button>
              )}
              <button onClick={handleSetAlert} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-colors">
                {existingAlert ? 'Update' : 'Set Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
