import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import ProductCard from '../components/ProductCard';
import { 
  Search, SlidersHorizontal, Upload, MapPin, TrendingDown, Trophy, 
  ShoppingBasket, ScanLine, ListTodo, Droplets, Wheat, Database, 
  Apple, Bell, Sparkles, Zap, Flame, ChevronRight, Store, ArrowRight
} from 'lucide-react';
import { Deal } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { getEffectivePrice, getNormalizedPrice, getStoreCoordinates, getDistanceFromLatLonInKm, isBasicNeed } from '../utils/helpers';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { motion, AnimatePresence } from 'motion/react';

export default function Home() {
  const allDeals = useAppStore(state => state.deals);
  const userLocation = useAppStore(state => state.userLocation);
  const setUserLocation = useAppStore(state => state.setUserLocation);
  const selectedRegion = useAppStore(state => state.selectedRegion);
  const setSelectedRegion = useAppStore(state => state.setSelectedRegion);
  const isAdmin = useAppStore(state => state.isAdmin);
  const navigate = useNavigate();
  
  // Filter out expired deals for the main view, but fallback to all if none are active
  const deals = useMemo(() => {
    const now = new Date();
    const activeDeals = allDeals.filter(d => new Date(d.end_date) >= now);
    return activeDeals.length > 0 ? activeDeals : allDeals;
  }, [allDeals]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const allDealsRef = useRef<HTMLDivElement>(null);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(selectedCategory === category ? null : category);
    if (selectedCategory !== category) {
      setTimeout(() => {
        allDealsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };
  const [activeFilter, setActiveFilter] = useState<'all' | 'basic_needs' | 'best_value' | 'cheapest_kg' | 'highest_savings' | 'nearby'>('all');

  const locationRequested = React.useRef(false);

  useEffect(() => {
    if ('geolocation' in navigator && !userLocation && !locationRequested.current) {
      locationRequested.current = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Location access denied or unavailable.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  const { visibleItems, hasMore, observerTarget } = useInfiniteScroll(filteredDeals, 20);

  const stats = useMemo(() => ({
    activeDeals: deals.length,
    stores: new Set(deals.map(d => d.store)).size,
    avgSavings: dealsWithMetrics.reduce((acc, d) => acc + (d.savings > 0 ? d.savings : 0), 0) / deals.length
  }), [deals, dealsWithMetrics]);

  return (
    <div className="space-y-10 pb-12">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-cyan-900/20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0097b2] via-[#007b99] to-[#005f73]"></div>
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl"></div>
        
        <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 text-center md:text-left">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-xl px-4 py-1.5 rounded-full mb-6 border border-white/20"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-white text-xs font-bold tracking-widest uppercase">Fiji's #1 Deal Finder</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-black text-white leading-[1.05] mb-6 font-display"
            >
              Save Big on <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400">Everyday Essentials</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-cyan-50 text-lg mb-8 max-w-lg font-medium opacity-90"
            >
              Instantly compare prices from RB Patel, MH, New World, and more. 
              Smart shopping for every Fijian family.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#0097b2] transition-colors" />
                <input 
                  type="text"
                  placeholder="Search for milk, rice, chicken..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white pl-12 pr-4 py-4 rounded-2xl text-slate-900 font-bold shadow-xl shadow-black/10 focus:outline-none focus:ring-4 focus:ring-white/20 transition-all placeholder:text-slate-400"
                />
              </div>
              {isAdmin && (
                <button 
                  onClick={() => navigate('/upload')}
                  className="bg-amber-400 hover:bg-amber-500 text-amber-950 px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-amber-900/20 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Upload className="w-5 h-5" />
                  Scan Flyer
                </button>
              )}
            </motion.div>
          </div>

          {/* Hero Visual */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.6, type: 'spring' }}
            className="hidden lg:block w-72 h-96 relative"
          >
            <div className="absolute inset-0 bg-white/10 backdrop-blur-2xl rounded-[3rem] border border-white/20 rotate-6 translate-x-4 translate-y-4"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent backdrop-blur-md rounded-[3rem] border border-white/30 flex flex-col p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <TrendingDown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Top Saving</p>
                  <p className="text-white font-black">Chicken #14</p>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <ShoppingBasket className="w-32 h-32 text-white/20" />
              </div>
              <div className="mt-auto pt-4 border-t border-white/10">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Best Price</p>
                    <p className="text-2xl font-black text-white">$14.50</p>
                  </div>
                  <div className="bg-amber-400 text-amber-950 text-[10px] font-black px-2 py-1 rounded-lg">
                    -22% OFF
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Deals', value: stats.activeDeals, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Supermarkets', value: stats.stores, icon: Store, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Avg. Savings', value: `$${stats.avgSavings.toFixed(2)}`, icon: TrendingDown, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Verified', value: '100%', icon: Trophy, color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.1 }}
            className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4"
          >
            <div className={`w-10 h-10 ${stat.bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
              <p className="text-lg font-black text-slate-900 leading-none">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Featured Collections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setActiveFilter('basic_needs');
            allDealsRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="group relative h-48 rounded-[2.5rem] overflow-hidden cursor-pointer shadow-lg"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500 to-pink-600"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 p-8 h-full flex flex-col">
            <div className="bg-white/20 backdrop-blur-md w-fit px-3 py-1 rounded-full mb-auto border border-white/20">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Top 10 Basic Needs</h3>
            <p className="text-rose-100 font-medium flex items-center gap-2">
              Save on everyday essentials <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </p>
          </div>
          <ShoppingBasket className="absolute -right-8 -bottom-8 w-48 h-48 text-white/10 -rotate-12" />
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/savings#smart-watchlist')}
          className="group relative h-48 rounded-[2.5rem] overflow-hidden cursor-pointer shadow-lg"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 p-8 h-full flex flex-col">
            <div className="bg-white/20 backdrop-blur-md w-fit px-3 py-1 rounded-full mb-auto border border-white/20">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Smart Watchlist</h3>
            <p className="text-amber-50 font-medium flex items-center gap-2">
              Track your favorite items <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </p>
          </div>
          <ListTodo className="absolute -right-8 -bottom-8 w-48 h-48 text-white/10 -rotate-12" />
        </motion.div>
      </div>

      {/* Categories Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-slate-900 font-display">Browse Categories</h2>
          <div className="h-px flex-1 bg-slate-100 mx-6 hidden sm:block"></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { id: 'Dairy', icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { id: 'Bakery', icon: Wheat, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
            { id: 'Canned Goods', icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { id: 'Produce', icon: Apple, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
          ].map((cat) => (
            <motion.button
              key={cat.id}
              whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCategoryClick(cat.id)}
              className={`relative p-6 rounded-[2rem] border-2 transition-all text-center flex flex-col items-center gap-4 ${
                selectedCategory === cat.id 
                  ? 'bg-white border-slate-900 shadow-xl' 
                  : `bg-white ${cat.border} hover:border-slate-300`
              }`}
            >
              <div className={`w-16 h-16 ${cat.bg} rounded-2xl flex items-center justify-center`}>
                <cat.icon className={`w-8 h-8 ${cat.color} stroke-[1.5]`} />
              </div>
              <span className="font-black text-slate-800">{cat.id}</span>
              {selectedCategory === cat.id && (
                <div className="absolute top-3 right-3 w-2 h-2 bg-slate-900 rounded-full"></div>
              )}
            </motion.button>
          ))}
        </div>
      </section>

      {/* Main Deals Area */}
      <section id="all-deals-section" ref={allDealsRef} className="pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <h2 className="text-3xl font-black text-slate-900 font-display">
            {activeFilter === 'all' ? 'All Deals' : activeFilter.replace('_', ' ').toUpperCase()}
          </h2>
          
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {[
              { id: 'all', label: 'All', icon: Zap },
              { id: 'basic_needs', label: 'Essentials', icon: ShoppingBasket },
              { id: 'best_value', label: 'Best Value', icon: Trophy },
              { id: 'nearby', label: 'Nearby', icon: MapPin },
              { id: 'highest_savings', label: 'Big Savings', icon: TrendingDown },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl whitespace-nowrap font-bold text-sm transition-all ${
                  activeFilter === filter.id
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <filter.icon className="w-4 h-4" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          <motion.div 
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {visibleItems.map((deal, idx) => (
              <motion.div
                key={deal.product_id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <ProductCard 
                  deal={deal} 
                  isBestValue={bestValueIds.has(deal.product_id)}
                  userLocation={userLocation}
                />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredDeals.length === 0 && (
          <div className="text-slate-500 py-20 text-center w-full bg-white rounded-[2.5rem] border border-slate-100 shadow-inner">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-xl font-bold text-slate-900">No deals found</p>
            <p className="text-slate-500">Try adjusting your search or filters</p>
          </div>
        )}

        {hasMore && (
          <div ref={observerTarget} className="w-full py-12 flex items-center justify-center">
            <div className="flex items-center gap-2 text-slate-400 font-bold">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading more deals...</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
