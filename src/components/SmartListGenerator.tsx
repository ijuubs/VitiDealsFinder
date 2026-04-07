import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { X, Sparkles, Plus, CheckCircle2, ShoppingBag, Users, DollarSign, Leaf, Loader2, Car, Bus, Navigation } from 'lucide-react';
import { getEffectivePrice, isBasicNeed, BASIC_NEED_KEYWORDS, getStoreCoordinates, getDistanceFromLatLonInKm, getNormalizedPrice, parseWeightToKg } from '../utils/helpers';
import { Deal } from '../types';

const TARGET_WEIGHTS: Record<string, number> = {
  'rice': 1.5,
  'flour': 1.0,
  'sugar': 0.5,
  'potato': 1.0,
  'potatoes': 1.0,
  'onion': 0.5,
  'onions': 0.5,
  'chicken': 1.0,
  'dhal': 0.5,
  'cooking oil': 0.5,
  'milk': 1.0,
  'soap': 0.2,
  'toilet paper': 0.5,
};

export default function SmartListGenerator({ onClose }: { onClose: () => void }) {
  const allDeals = useAppStore(state => state.deals);
  const userLocation = useAppStore(state => state.userLocation);
  const selectedRegion = useAppStore(state => state.selectedRegion);
  const transportMode = useAppStore(state => state.transportMode);
  const setTransportMode = useAppStore(state => state.setTransportMode);
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  
  const [familySize, setFamilySize] = useState<number>(2);
  const [budget, setBudget] = useState<number>(100);
  const [diet, setDiet] = useState<string>('any');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedList, setGeneratedList] = useState<{deal: Deal, quantity: number}[] | null>(null);

  // Get reference location for distance calculation
  const refLocation = useMemo(() => {
    if (userLocation) return userLocation;
    if (selectedRegion !== 'all' && selectedRegion !== 'current') {
      return getStoreCoordinates(selectedRegion);
    }
    return null;
  }, [userLocation, selectedRegion]);

  const handleGenerate = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const now = new Date();
      let activeDeals = allDeals.filter(d => !d.is_archived && new Date(d.end_date) >= now);
      if (activeDeals.length === 0) activeDeals = allDeals.filter(d => !d.is_archived);
      
      let basicNeeds = activeDeals.filter(d => isBasicNeed(d));
      
      if (diet === 'vegetarian') {
        basicNeeds = basicNeeds.filter(d => {
          const name = d.name.toLowerCase();
          return !name.includes('chicken') && !name.includes('meat') && !name.includes('beef') && !name.includes('lamb') && !name.includes('fish') && !name.includes('sardine') && !name.includes('mackerel');
        });
      }
      
      // Calculate scores for each deal
      const scoredDeals = basicNeeds.map(d => {
        const price = getEffectivePrice(d);
        const { pricePerKg } = getNormalizedPrice(d);
        const coords = getStoreCoordinates(d.location);
        let distance = 0;
        
        if (refLocation && coords) {
          distance = getDistanceFromLatLonInKm(refLocation.lat, refLocation.lon, coords.lat, coords.lon);
        } else if (refLocation && !coords) {
          // If we have a user location but don't know the store location, 
          // assume it's at least 20km away to avoid prioritizing it over known close stores
          distance = 20;
        }

        // SIGNIFICANTLY increase penalty for distance
        // Walking: 5 points per km (very high)
        // Bus: 2 points per km
        // Driving: 1 point per km
        const distancePenalty = transportMode === 'walking' ? 5 : transportMode === 'bus' ? 2 : 1;
        
        // Score: Higher is better
        // Use price per kg if available, otherwise absolute price
        const valuePrice = pricePerKg || price;
        let score = (100 / valuePrice);
        
        // Subtract distance penalty
        score -= (distance * distancePenalty);

        // Hard penalty for very long distances (e.g., > 40km)
        if (distance > 40) score -= 100;
        if (distance > 80) score -= 500;

        // Bonus for "dropping" price trend
        if (d.price_trend === 'dropping') score += 5;
        
        return { deal: d, score, distance, price, pricePerKg };
      }).filter(sd => sd.distance <= 60); // Hard filter for distance to ensure "Smart" choices

      const grouped = new Map<string, typeof scoredDeals>();
      scoredDeals.forEach(sd => {
        const textToSearch = `${sd.deal.name} ${sd.deal.category} ${sd.deal.subcategory} ${sd.deal.brand}`.toLowerCase();
        
        // Find which keyword matched
        const matchedKeyword = BASIC_NEED_KEYWORDS.find(kw => textToSearch.includes(kw)) || sd.deal.name.toLowerCase().trim();
        
        if (!grouped.has(matchedKeyword)) grouped.set(matchedKeyword, []);
        grouped.get(matchedKeyword)!.push(sd);
      });
      
      const bestOptions: typeof scoredDeals = [];
      grouped.forEach(group => {
        // Pick the one with the highest score in each group
        const best = group.reduce((prev, curr) => curr.score > prev.score ? curr : prev);
        bestOptions.push(best);
      });
      
      // Sort by score (highest first)
      bestOptions.sort((a, b) => b.score - a.score);
      
      let currentTotal = 0;
      const newList: {deal: Deal, quantity: number}[] = [];
      
      // Prioritize these essential keywords first
      const priorityKeywords = ['rice', 'flour', 'chicken', 'dhal', 'milk', 'cooking oil', 'soap', 'toilet paper'];
      
      const getRequiredQty = (deal: Deal, keyword: string) => {
        const targetWeight = TARGET_WEIGHTS[keyword] || 1.0;
        const requiredWeight = targetWeight * familySize;
        const itemWeight = parseWeightToKg(deal.weight) || 1.0;
        return Math.max(1, Math.ceil(requiredWeight / itemWeight));
      };

      // First pass: Add one of each priority item if it fits the budget
      for (const kw of priorityKeywords) {
        const option = bestOptions.find(sd => {
          const textToSearch = `${sd.deal.name} ${sd.deal.category} ${sd.deal.subcategory} ${sd.deal.brand}`.toLowerCase();
          return textToSearch.includes(kw);
        });
        
        if (option && !newList.some(i => i.deal.product_id === option.deal.product_id)) {
          const qty = getRequiredQty(option.deal, kw);
          if (currentTotal + (option.price * qty) <= budget) {
            newList.push({ deal: option.deal, quantity: qty });
            currentTotal += option.price * qty;
          }
        }
      }
      
      // Second pass: Fill the rest of the budget with other best options
      for (const option of bestOptions) {
        if (currentTotal >= budget * 0.95) break;
        if (!newList.some(i => i.deal.product_id === option.deal.product_id)) {
          const textToSearch = `${option.deal.name} ${option.deal.category} ${option.deal.subcategory} ${option.deal.brand}`.toLowerCase();
          const kw = BASIC_NEED_KEYWORDS.find(k => textToSearch.includes(k)) || 'other';
          const qty = getRequiredQty(option.deal, kw);
          
          if (currentTotal + (option.price * qty) <= budget) {
            newList.push({ deal: option.deal, quantity: qty });
            currentTotal += option.price * qty;
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
        addToShoppingList(item.deal, item.quantity);
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
            <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
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
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
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
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
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
                  <Navigation className="w-4 h-4 text-emerald-500" />
                  Transport Mode
                </label>
                <div className="flex gap-3">
                  {[
                    { id: 'driving', icon: Car, label: 'Driving' },
                    { id: 'bus', icon: Bus, label: 'Bus' },
                    { id: 'walking', icon: Navigation, label: 'Walking' }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setTransportMode(mode.id as any)}
                      className={`flex-1 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        transportMode === mode.id 
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <mode.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{mode.label}</span>
                    </button>
                  ))}
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
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
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
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-lg transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-70"
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
              <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-emerald-900 text-lg">Your Smart List</h3>
                  <p className="text-emerald-700 text-sm font-medium">{generatedList.length} essential items for {familySize} people</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-emerald-600 font-bold uppercase tracking-wider mb-1">Total Est. Cost</div>
                  <div className="text-3xl font-black text-emerald-700">${totalCost.toFixed(2)}</div>
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
                        {refLocation && getStoreCoordinates(item.deal.location) && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600 font-bold">
                              {getDistanceFromLatLonInKm(
                                refLocation.lat, 
                                refLocation.lon, 
                                getStoreCoordinates(item.deal.location)!.lat, 
                                getStoreCoordinates(item.deal.location)!.lon
                              ).toFixed(1)}km
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-slate-900">${(getEffectivePrice(item.deal) * item.quantity).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                
                {generatedList.length === 0 && (
                  <div className="text-center py-12 px-6">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingBag className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No matching deals found</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">
                      Could not find enough deals within 60km that match your budget and criteria. 
                      Try increasing your budget or checking your location settings.
                    </p>
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
              className="flex-[2] py-3.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50"
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
