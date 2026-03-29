import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import ProductCard from '../components/ProductCard';
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react';
import { getEffectivePrice, getNormalizedPrice, getStoreCoordinates, getDistanceFromLatLonInKm, isBasicNeed } from '../utils/helpers';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export default function Search() {
  const allDeals = useAppStore(state => state.deals);
  const userLocation = useAppStore(state => state.userLocation);
  const selectedRegion = useAppStore(state => state.selectedRegion);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

      return {
        ...deal,
        currentPrice,
        avgPrice,
        savings,
        pricePerKg,
        distance,
        basicNeed
      };
    }).filter(deal => {
      if (selectedRegion === 'all') return true;
      if (selectedRegion === 'current' && !userLocation) return true;
      return deal.distance <= 100 || deal.distance === Infinity;
    });
  }, [deals, userLocation, selectedRegion]);

  const filteredDeals = useMemo(() => {
    if (!searchQuery && !selectedCategory) return [];

    return dealsWithMetrics.filter(deal => {
      const matchesSearch = (deal?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                            (deal.brand && deal.brand.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory ? deal.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => {
      if (b.savings !== a.savings) return b.savings - a.savings;
      return (a?.name || '').localeCompare(b?.name || '');
    });
  }, [dealsWithMetrics, searchQuery, selectedCategory]);

  const { visibleItems, hasMore, observerTarget } = useInfiniteScroll(filteredDeals, 20);

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
        <button className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-slate-600 hover:text-[#0097b2] hover:bg-cyan-50 transition-colors">
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

      <div className="space-y-4">
        {searchQuery || selectedCategory ? (
          filteredDeals.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {visibleItems.map(deal => (
                <ProductCard key={deal.product_id} deal={deal} userLocation={userLocation} />
              ))}
              {hasMore && (
                <div ref={observerTarget} className="w-full h-10 flex items-center justify-center mt-4">
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
          )
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-bold text-slate-900 mb-1">What are you looking for?</h3>
            <p className="text-slate-500">Search for products, brands, or categories to find the best deals.</p>
          </div>
        )}
      </div>
    </div>
  );
}
