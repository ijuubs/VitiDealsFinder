import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store';
import ProductCard from '../components/ProductCard';
import { Search, SlidersHorizontal, Upload, MapPin, TrendingDown, Trophy } from 'lucide-react';
import { Deal } from '../types';
import { Link } from 'react-router-dom';
import { getEffectivePrice, getNormalizedPrice, getStoreCoordinates, getDistanceFromLatLonInKm } from '../utils/helpers';

export default function Home() {
  const deals = useAppStore(state => state.deals);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'best_value' | 'cheapest_kg' | 'highest_savings' | 'nearby'>('all');
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);

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

  const categories = Array.from(new Set(deals.map(d => d.category))).filter(Boolean);

  // Pre-calculate deal metrics for filtering
  const dealsWithMetrics = useMemo(() => {
    return deals.map(deal => {
      const comparableDeals = deals.filter(d => d.name.toLowerCase().trim() === deal.name.toLowerCase().trim());
      const currentPrice = getEffectivePrice(deal);
      const avgPrice = comparableDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0) / comparableDeals.length;
      const savings = avgPrice - currentPrice;
      const { pricePerKg } = getNormalizedPrice(deal);
      
      let distance = Infinity;
      if (userLocation) {
        const coords = getStoreCoordinates(deal.location);
        if (coords) {
          distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
        }
      }

      return {
        ...deal,
        currentPrice,
        avgPrice,
        savings,
        pricePerKg,
        distance
      };
    });
  }, [deals, userLocation]);

  const bestValueIds = useMemo(() => {
    const bestIds = new Set<string>();
    const grouped = dealsWithMetrics.reduce((acc, deal) => {
      const key = deal.name.toLowerCase().trim();
      if (!acc[key]) acc[key] = [];
      acc[key].push(deal);
      return acc;
    }, {} as Record<string, typeof dealsWithMetrics>);

    Object.values(grouped).forEach((group: any) => {
      if (group.length > 1) {
        // Best value = lowest price AND lowest price per kg (if available)
        let bestDeal = group[0];
        for (let i = 1; i < group.length; i++) {
          const current = group[i];
          const currentPrice = current.pricePerKg || current.currentPrice;
          const bestPrice = bestDeal.pricePerKg || bestDeal.currentPrice;
          if (currentPrice < bestPrice) {
            bestDeal = current;
          }
        }
        bestIds.add(bestDeal.product_id);
      }
    });
    return bestIds;
  }, [dealsWithMetrics]);

  const filteredDeals = useMemo(() => {
    let result = dealsWithMetrics.filter(deal => {
      const matchesSearch = deal.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (deal.brand && deal.brand.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory ? deal.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });

    switch (activeFilter) {
      case 'best_value':
        result = result.filter(d => bestValueIds.has(d.product_id));
        break;
      case 'cheapest_kg':
        result = result.filter(d => d.pricePerKg !== null).sort((a, b) => (a.pricePerKg || Infinity) - (b.pricePerKg || Infinity));
        break;
      case 'highest_savings':
        result = result.filter(d => d.savings > 0).sort((a, b) => b.savings - a.savings);
        break;
      case 'nearby':
        result = result.filter(d => d.distance < 20).sort((a, b) => a.distance - b.distance);
        break;
      default:
        // Default sort: highest savings first, then alphabetical
        result.sort((a, b) => {
          if (b.savings !== a.savings) return b.savings - a.savings;
          return a.name.localeCompare(b.name);
        });
    }

    return result;
  }, [dealsWithMetrics, searchQuery, selectedCategory, activeFilter, bestValueIds]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Smart Shopping Assistant</h1>
          <p className="text-slate-500 mt-1">Found {deals.length} deals. Maximizing your savings.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Search and Categories */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products, brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                selectedCategory === null 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              All Categories
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  selectedCategory === category 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Smart Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeFilter === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Deals
          </button>
          <button
            onClick={() => setActiveFilter('best_value')}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeFilter === 'best_value' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Trophy className="w-4 h-4" /> Best Value
          </button>
          <button
            onClick={() => setActiveFilter('highest_savings')}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeFilter === 'highest_savings' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <TrendingDown className="w-4 h-4" /> Highest Savings
          </button>
          <button
            onClick={() => setActiveFilter('cheapest_kg')}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeFilter === 'cheapest_kg' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Cheapest per kg
          </button>
          {userLocation && (
            <button
              onClick={() => setActiveFilter('nearby')}
              className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeFilter === 'nearby' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <MapPin className="w-4 h-4" /> Nearby Stores
            </button>
          )}
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No deals found</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            You haven't uploaded any flyers yet, or no deals match your search. Upload a flyer to start finding savings.
          </p>
          <Link 
            to="/upload" 
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            <Upload className="w-5 h-5" />
            Upload Flyer
          </Link>
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No deals match your current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDeals.map((deal, idx) => (
            <ProductCard key={`${deal.product_id}-${idx}`} deal={deal} isBestValue={bestValueIds.has(deal.product_id)} />
          ))}
        </div>
      )}
    </div>
  );
}
