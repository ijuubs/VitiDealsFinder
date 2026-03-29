import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store';
import ProductCard from '../components/ProductCard';
import { Search, SlidersHorizontal, Upload, MapPin, TrendingDown, Trophy, ShoppingBasket, ScanLine, ShoppingCart, Droplets, Wheat, Database, Apple } from 'lucide-react';
import { Deal } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { getEffectivePrice, getNormalizedPrice, getStoreCoordinates, getDistanceFromLatLonInKm, isBasicNeed } from '../utils/helpers';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export default function Home() {
  const allDeals = useAppStore(state => state.deals);
  const userLocation = useAppStore(state => state.userLocation);
  const setUserLocation = useAppStore(state => state.setUserLocation);
  const selectedRegion = useAppStore(state => state.selectedRegion);
  const setSelectedRegion = useAppStore(state => state.setSelectedRegion);
  const navigate = useNavigate();
  
  // Filter out expired deals for the main view, but fallback to all if none are active
  const deals = useMemo(() => {
    const now = new Date();
    const activeDeals = allDeals.filter(d => new Date(d.end_date) >= now);
    return activeDeals.length > 0 ? activeDeals : allDeals;
  }, [allDeals]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'basic_needs' | 'best_value' | 'cheapest_kg' | 'highest_savings' | 'nearby'>('all');

  useEffect(() => {
    if ('geolocation' in navigator && !userLocation) {
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
  }, [userLocation, setUserLocation]);

  const categories = Array.from(new Set(deals.map(d => d.category))).filter(Boolean);

  // Pre-calculate deal metrics for filtering
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
          // Calculate distance anyway for sorting if 'all' is selected
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
      // Strict location filtering
      if (selectedRegion === 'all') return true;
      if (selectedRegion === 'current' && !userLocation) return true; // Fallback to all if no location
      return deal.distance <= 100 || deal.distance === Infinity; // 100km radius or unknown location
    });
  }, [deals, userLocation, selectedRegion]);

  const bestValueIds = useMemo(() => {
    const bestIds = new Set<string>();
    const grouped = dealsWithMetrics.reduce((acc, deal) => {
      const key = deal?.name?.toLowerCase().trim() || 'unknown';
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
      const matchesSearch = (deal?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                            (deal.brand && deal.brand.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory ? deal.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });

    switch (activeFilter) {
      case 'basic_needs':
        result = result.filter(d => d.basicNeed);
        break;
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
        // Default sort: basic needs first, then highest savings, then alphabetical
        result.sort((a, b) => {
          if (a.basicNeed && !b.basicNeed) return -1;
          if (!a.basicNeed && b.basicNeed) return 1;
          if (b.savings !== a.savings) return b.savings - a.savings;
          return (a?.name || '').localeCompare(b?.name || '');
        });
    }

    return result;
  }, [dealsWithMetrics, searchQuery, selectedCategory, activeFilter, bestValueIds]);

  const topDeals = useMemo(() => {
    // For top deals, we strictly want basic needs items, sorted by highest savings or lowest price
    const basicNeedsDeals = dealsWithMetrics
      .filter(d => d.basicNeed)
      .sort((a, b) => {
        if (b.savings !== a.savings) return b.savings - a.savings;
        return (a.pricePerKg || a.currentPrice) - (b.pricePerKg || b.currentPrice);
      });

    // Get unique items by name
    const uniqueDeals = [];
    const seenNames = new Set();
    
    for (const deal of basicNeedsDeals) {
      const nameKey = (deal.name || '').toLowerCase().trim();
      if (!seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        uniqueDeals.push(deal);
        if (uniqueDeals.length === 10) break;
      }
    }
    
    return uniqueDeals;
  }, [dealsWithMetrics]);

  const { visibleItems, hasMore, observerTarget } = useInfiniteScroll(filteredDeals, 20);

  return (
    <div className="space-y-8 pb-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#0097b2] to-[#007b99] rounded-[2rem] p-8 relative overflow-hidden shadow-lg shadow-cyan-900/20">
        <div className="relative z-10 w-3/4">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full mb-4">
            <ScanLine className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-bold tracking-wider uppercase">Smart Shopper</span>
          </div>
          <h1 className="text-3xl font-black text-white leading-[1.1] mb-3 font-display">
            Digital Flyers<br />at Your Fingertips
          </h1>
          <p className="text-cyan-50 text-sm mb-6 leading-relaxed font-medium">
            Scan any physical flyer to instantly compare prices across your region.
          </p>
          <button 
            onClick={() => navigate('/upload')}
            className="bg-white text-[#0097b2] px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-black/10 hover:bg-cyan-50 transition-all active:scale-95"
          >
            <ScanLine className="w-5 h-5" />
            Scan Now
          </button>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-32 h-40 opacity-20 transform rotate-12">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M16 6V4C16 1.79086 14.2091 0 12 0C9.79086 0 8 1.79086 8 4V6H3C2.44772 6 2 6.44772 2 7V20C2 22.2091 3.79086 24 6 24H18C20.2091 24 22 22.2091 22 20V7C22 6.44772 21.5523 6 21 6H16ZM10 4C10 2.89543 10.8954 2 12 2C13.1046 2 14 2.89543 14 4V6H10V4ZM20 20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V8H20V20Z" />
          </svg>
        </div>
      </div>

      {/* Top Deals */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 font-display">Today's Top 10 Basic Needs Deals</h2>
            <p className="text-sm text-slate-500">Verified 2 hours ago</p>
          </div>
          <button className="text-[#0097b2] font-bold text-sm">See all</button>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar -mx-4 px-4">
          {topDeals.map(deal => (
            <div key={deal.product_id} className="min-w-[240px] w-[240px] flex-shrink-0">
              <ProductCard deal={deal} isBestValue={true} userLocation={userLocation} />
            </div>
          ))}
          {topDeals.length === 0 && (
            <div className="text-slate-500 py-8 text-center w-full">No basic needs deals found for your current location.</div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-2xl font-bold text-slate-900 font-display">Browse Categories</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div 
            onClick={() => setSelectedCategory(selectedCategory === 'Dairy' ? null : 'Dairy')}
            className={`bg-white border rounded-[2rem] p-5 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group ${selectedCategory === 'Dairy' ? 'border-cyan-500 shadow-lg shadow-cyan-100/50' : 'border-slate-100 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-100/50'}`}
          >
            <div className="w-16 h-16 bg-cyan-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Droplets className="w-8 h-8 text-[#0097b2] stroke-[1.5]" />
            </div>
            <span className="font-bold text-slate-700">Dairy</span>
          </div>
          <div 
            onClick={() => setSelectedCategory(selectedCategory === 'Bakery' ? null : 'Bakery')}
            className={`bg-white border rounded-[2rem] p-5 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group ${selectedCategory === 'Bakery' ? 'border-amber-500 shadow-lg shadow-amber-100/50' : 'border-slate-100 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-100/50'}`}
          >
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Wheat className="w-8 h-8 text-amber-600 stroke-[1.5]" />
            </div>
            <span className="font-bold text-slate-700">Bakery</span>
          </div>
          <div 
            onClick={() => setSelectedCategory(selectedCategory === 'Canned Goods' ? null : 'Canned Goods')}
            className={`bg-white border rounded-[2rem] p-5 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group ${selectedCategory === 'Canned Goods' ? 'border-indigo-500 shadow-lg shadow-indigo-100/50' : 'border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50'}`}
          >
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Database className="w-8 h-8 text-indigo-600 stroke-[1.5]" />
            </div>
            <span className="font-bold text-slate-700">Canned Goods</span>
          </div>
          <div 
            onClick={() => setSelectedCategory(selectedCategory === 'Produce' ? null : 'Produce')}
            className={`bg-white border rounded-[2rem] p-5 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group ${selectedCategory === 'Produce' ? 'border-emerald-500 shadow-lg shadow-emerald-100/50' : 'border-slate-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50'}`}
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Apple className="w-8 h-8 text-emerald-600 stroke-[1.5]" />
            </div>
            <span className="font-bold text-slate-700">Produce</span>
          </div>
        </div>
      </div>

      {/* Smart Watchlist Banner */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-[2rem] p-6 relative overflow-hidden shadow-sm flex items-center justify-between">
        <div className="relative z-10 w-2/3">
          <h3 className="text-xl font-bold text-slate-900 mb-1">Smart Watchlist</h3>
          <p className="text-slate-800 text-sm opacity-90">Get alerts when butter drops below $5.00</p>
        </div>
        <div className="relative z-10 w-14 h-14 bg-[#0097b2] rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
          <ShoppingCart className="w-6 h-6 text-white" />
        </div>
        
        {/* Decorative circle */}
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/20 rounded-full blur-xl"></div>
      </div>

      {/* All Deals Section */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-2xl font-bold text-slate-900 font-display">All Deals</h2>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar -mx-4 px-4">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-all ${
              activeFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('basic_needs')}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-all ${
              activeFilter === 'basic_needs'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            Basic Needs
          </button>
          <button
            onClick={() => setActiveFilter('best_value')}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-all ${
              activeFilter === 'best_value'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            Best Value
          </button>
          <button
            onClick={() => setActiveFilter('cheapest_kg')}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-all ${
              activeFilter === 'cheapest_kg'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-purple-50 hover:text-purple-700'
            }`}
          >
            Cheapest per kg
          </button>
          <button
            onClick={() => setActiveFilter('highest_savings')}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-all ${
              activeFilter === 'highest_savings'
                ? 'bg-amber-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-700'
            }`}
          >
            Highest Savings
          </button>
          <button
            onClick={() => setActiveFilter('nearby')}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-all ${
              activeFilter === 'nearby'
                ? 'bg-rose-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            Nearby
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {visibleItems.map(deal => (
            <ProductCard 
              key={deal.product_id} 
              deal={deal} 
              isBestValue={bestValueIds.has(deal.product_id)}
              userLocation={userLocation}
            />
          ))}
          {filteredDeals.length === 0 && (
            <div className="text-slate-500 py-8 text-center w-full bg-white rounded-2xl border border-slate-100">
              No deals match your current filters.
            </div>
          )}
          {hasMore && (
            <div ref={observerTarget} className="w-full h-10 flex items-center justify-center mt-4">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
