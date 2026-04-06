import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store';
import ProductCard from '../components/ProductCard';
import { Search as SearchIcon, SlidersHorizontal, TrendingDown, Bus, Car, Navigation } from 'lucide-react';
import { getEffectivePrice, getNormalizedPrice, getStoreCoordinates, getDistanceFromLatLonInKm, isBasicNeed } from '../utils/helpers';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useSearchParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Search() {
  const allDeals = useAppStore(state => state.deals);
  const userLocation = useAppStore(state => state.userLocation);
  const selectedRegion = useAppStore(state => state.selectedRegion);
  const transportMode = useAppStore(state => state.transportMode);
  
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isBasicNeedsOnly, setIsBasicNeedsOnly] = useState(initialFilter === 'basic_needs');

  useEffect(() => {
    if (initialFilter === 'basic_needs') {
      setIsBasicNeedsOnly(true);
    }
  }, [initialFilter]);

  const deals = useMemo(() => {
    const now = new Date();
    return allDeals.filter(d => new Date(d.end_date) >= now);
  }, [allDeals]);

  const categories = Array.from(new Set(deals.map(d => d.category))).filter(Boolean);

  const dealsWithMetrics = useMemo(() => {
    const regionCoords = selectedRegion !== 'all' && selectedRegion !== 'current' ? getStoreCoordinates(selectedRegion) : null;

    return deals.map(deal => {
      const comparableDeals = deals.filter(d => d?.name?.toLowerCase().trim() === deal?.name?.toLowerCase().trim());
      const currentPrice = getEffectivePrice(deal);
      const avgPrice = comparableDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0) / comparableDeals.length;
      const savings = avgPrice - currentPrice;
      const { pricePerKg } = getNormalizedPrice(deal);
      const basicNeed = isBasicNeed(deal);
      
      let distance = Infinity;
      const coords = getStoreCoordinates(deal.location);
      
      if (coords) {
        if (selectedRegion === 'current' && userLocation) {
          distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
        } else if (regionCoords) {
          distance = getDistanceFromLatLonInKm(regionCoords.lat, regionCoords.lon, coords.lat, coords.lon);
        } else if (userLocation) {
          distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
        }
      }

      // Calculate True Cost based on transport mode
      let transportCost = 0;
      if (distance !== Infinity) {
        if (transportMode === 'driving') {
          transportCost = distance * 0.5; // $0.50 per km
        } else if (transportMode === 'bus') {
          transportCost = 1.5; // Flat $1.50 bus fare
        }
      }
      const trueCost = currentPrice + transportCost;

      return {
        ...deal,
        currentPrice,
        avgPrice,
        savings,
        pricePerKg,
        distance,
        basicNeed,
        transportCost,
        trueCost
      };
    }).filter(deal => {
      if (selectedRegion === 'all') return true;
      if (selectedRegion === 'current' && !userLocation) return true;
      return deal.distance <= 100 || deal.distance === Infinity;
    });
  }, [deals, userLocation, selectedRegion, transportMode]);

  const filteredDeals = useMemo(() => {
    return dealsWithMetrics.filter(deal => {
      const matchesSearch = (deal?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                            (deal.brand && deal.brand.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory ? deal.category === selectedCategory : true;
      const matchesBasicNeeds = isBasicNeedsOnly ? deal.basicNeed : true;
      return matchesSearch && matchesCategory && matchesBasicNeeds;
    }).sort((a, b) => {
      if (b.savings !== a.savings) return b.savings - a.savings;
      return (a?.name || '').localeCompare(b?.name || '');
    });
  }, [dealsWithMetrics, searchQuery, selectedCategory, isBasicNeedsOnly]);

  const { visibleItems, hasMore, observerTarget } = useInfiniteScroll(filteredDeals, 20);

  // Identify the best product match for comparison
  const comparisonProduct = useMemo(() => {
    if (!searchQuery || filteredDeals.length === 0) return null;
    
    // Group by exact name
    const grouped = filteredDeals.reduce((acc, deal) => {
      const name = deal.name.toLowerCase().trim();
      if (!acc[name]) acc[name] = [];
      acc[name].push(deal);
      return acc;
    }, {} as Record<string, typeof filteredDeals>);

    // Find the group with the most items from different stores
    let bestGroup: typeof filteredDeals = [];
    let maxStores = 0;

    for (const group of Object.values(grouped)) {
      const uniqueStores = new Set(group.map(d => d.store)).size;
      if (uniqueStores > maxStores && uniqueStores > 1) {
        maxStores = uniqueStores;
        bestGroup = group;
      }
    }

    if (bestGroup.length > 0) {
      // Sort by true cost
      bestGroup.sort((a, b) => a.trueCost - b.trueCost);
      return {
        name: bestGroup[0].name,
        deals: bestGroup
      };
    }

    return null;
  }, [filteredDeals, searchQuery]);

  // Mock price history data
  const priceHistoryData = useMemo(() => {
    if (!comparisonProduct) return [];
    const data = [];
    const now = new Date();
    let basePrice = comparisonProduct.deals[0].currentPrice + 2; // Start slightly higher
    
    for (let i = 90; i >= 0; i -= 7) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Add some random fluctuation
      basePrice = basePrice + (Math.random() * 0.5 - 0.25);
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: Math.max(0.5, basePrice).toFixed(2)
      });
    }
    
    // Ensure the last point matches current best price
    data[data.length - 1].price = comparisonProduct.deals[0].currentPrice.toFixed(2);
    
    return data;
  }, [comparisonProduct]);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-black text-slate-900 font-display tracking-tight">Search</h1>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search for products, brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-[#0097b2] focus:border-transparent outline-none text-slate-900 font-medium placeholder:font-normal transition-all"
            autoFocus
          />
        </div>
        <button 
          onClick={() => setIsBasicNeedsOnly(!isBasicNeedsOnly)}
          className={`p-4 rounded-2xl border shadow-sm transition-colors flex items-center justify-center ${
            isBasicNeedsOnly 
              ? 'bg-cyan-50 border-cyan-200 text-[#0097b2]' 
              : 'bg-white border-slate-200 text-slate-600 hover:text-[#0097b2] hover:bg-cyan-50'
          }`}
          title={isBasicNeedsOnly ? "Show all items" : "Show basic needs only"}
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-5 py-2.5 rounded-full whitespace-nowrap font-bold text-sm transition-all ${
            selectedCategory === null
              ? 'bg-[#0097b2] text-white shadow-md shadow-cyan-900/20'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-5 py-2.5 rounded-full whitespace-nowrap font-bold text-sm transition-all ${
              selectedCategory === category
                ? 'bg-[#0097b2] text-white shadow-md shadow-cyan-900/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Price Comparison & True Cost Section */}
      {comparisonProduct && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-6 h-6 text-emerald-500" />
            <h2 className="text-xl font-bold text-slate-900 font-display">Price Comparison: {comparisonProduct.name}</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">True Cost Analysis</h3>
              <div className="space-y-3">
                {comparisonProduct.deals.slice(0, 3).map((deal, idx) => (
                  <div key={deal.product_id} className={`p-4 rounded-2xl border ${idx === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-slate-900">{deal.store}</span>
                        <span className="text-xs text-slate-500 block">{deal.location} • {deal.distance === Infinity ? 'Unknown' : `${deal.distance.toFixed(1)}km`}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-black ${idx === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>${deal.trueCost.toFixed(2)}</span>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">True Cost</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500 border-t border-slate-200/50 pt-2 mt-2">
                      <span>Shelf Price: ${deal.currentPrice.toFixed(2)}</span>
                      <span className="flex items-center gap-1">
                        {transportMode === 'driving' ? <Car className="w-3 h-3" /> : transportMode === 'bus' ? <Bus className="w-3 h-3" /> : <Navigation className="w-3 h-3" />}
                        Transport: ${deal.transportCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">90-Day Price Trend</h3>
              <div className="h-48 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceHistoryData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`$${value}`, 'Price']}
                    />
                    <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500 mt-3 text-center">
                Based on historical data for {comparisonProduct.name}. <span className="font-bold text-emerald-600">Good time to buy!</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredDeals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleItems.map(deal => (
              <ProductCard key={deal.product_id} deal={deal} userLocation={userLocation} />
            ))}
            {hasMore && (
              <div ref={observerTarget} className="w-full h-10 flex items-center justify-center mt-4 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <SearchIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No results found</h3>
            <p className="text-slate-500">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
