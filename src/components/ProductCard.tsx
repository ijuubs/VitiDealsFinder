import React, { useState, useMemo } from 'react';
import { Deal } from '../types';
import { useAppStore } from '../store';
import CompareModal from './CompareModal';
import ProductDetailsModal from './ProductDetailsModal';
import { getEffectivePrice, getNormalizedPrice, getStoreCoordinates, getDistanceFromLatLonInKm, isBasicNeed, isFoodItem } from '../utils/helpers';
import { BadgeCheck, ShoppingBasket, Leaf, MapPin, TrendingDown, Calendar, LineChart, Lightbulb, Car, Clock, Store, ListPlus, ArrowRightLeft, Star, Trash2, ThumbsUp, ThumbsDown, AlertTriangle, Share2, Zap, Trophy, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const ProductCard: React.FC<{ deal: Deal, isBestValue?: boolean, userLocation?: {lat: number, lon: number} | null }> = ({ deal, isBestValue, userLocation }) => {
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  const shoppingList = useAppStore(state => state.shoppingList);
  const allDeals = useAppStore(state => state.deals);
  const compareList = useAppStore(state => state.compareList);
  const addToCompareList = useAppStore(state => state.addToCompareList);
  const removeFromCompareList = useAppStore(state => state.removeFromCompareList);
  const removeDeal = useAppStore(state => state.removeDeal);
  const upvoteDeal = useAppStore(state => state.upvoteDeal);
  const downvoteDeal = useAppStore(state => state.downvoteDeal);
  const flagOutOfStock = useAppStore(state => state.flagOutOfStock);
  const isAdmin = useAppStore(state => state.isAdmin);
  const transportMode = useAppStore(state => state.transportMode);
  const [showCompare, setShowCompare] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isComparing = compareList.some(d => d.product_id === deal.product_id);

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isComparing) {
      removeFromCompareList(deal.product_id);
    } else {
      addToCompareList(deal);
    }
  };

  const currentPrice = getEffectivePrice(deal);
  const { pricePerKg, unit } = getNormalizedPrice(deal);

  const distance = useMemo(() => {
    if (!userLocation) return null;
    const coords = getStoreCoordinates(deal.location);
    if (!coords) return null;
    return getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
  }, [userLocation, deal.location]);

  const transportCost = useMemo(() => {
    if (transportMode === 'walking' || !distance) return 0;
    if (transportMode === 'driving') return distance * 0.5;
    if (transportMode === 'bus') return 1.50;
    return 0;
  }, [transportMode, distance]);

  const realPrice = currentPrice + transportCost;

  const comparableDeals = useMemo(() => {
    if (!deal?.name) return [];
    return allDeals.filter(d => d?.name?.toLowerCase().trim() === deal?.name?.toLowerCase().trim());
  }, [allDeals, deal?.name]);

  const averageMarketPrice = useMemo(() => {
    if (comparableDeals.length <= 1) return null;
    const sum = comparableDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0);
    return sum / comparableDeals.length;
  }, [comparableDeals]);

  const savingsValue = averageMarketPrice ? averageMarketPrice - currentPrice : 0;
  const savingsPercentage = averageMarketPrice && averageMarketPrice > 0 ? (savingsValue / averageMarketPrice) * 100 : 0;

  const isExpired = useMemo(() => new Date(deal.end_date) < new Date(), [deal.end_date]);

  const daysLeft = useMemo(() => {
    const diffTime = Math.abs(new Date(deal.end_date).getTime() - new Date().getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [deal.end_date]);

  const currentListSavings = useMemo(() => {
    let savings = 0;
    const now = new Date();
    shoppingList.forEach(item => {
      const itemPrice = getEffectivePrice(item.deal);
      const itemIsExpired = new Date(item.deal.end_date) < now;
      
      const itemComparableDeals = allDeals.filter(d => 
        d?.name?.toLowerCase().trim() === item.deal?.name?.toLowerCase().trim() &&
        new Date(d.end_date) >= now
      );
      
      if (!itemIsExpired && itemComparableDeals.length > 1) {
        const avgPrice = itemComparableDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0) / itemComparableDeals.length;
        const itemSaving = avgPrice - itemPrice;
        if (itemSaving > 0) {
          savings += itemSaving * item.quantity;
        }
      }
    });
    return savings;
  }, [shoppingList, allDeals]);

  const totalTripSavings = currentListSavings + (savingsValue > 0 && !isExpired ? savingsValue : 0);

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
    const width = 60;
    const height = 20;
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

  const handleShare = () => {
    const text = `Check out this deal: ${deal.name} for $${currentPrice.toFixed(2)} at ${deal.store}!`;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: 'Great Deal!', text, url }).catch(console.error);
    } else {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  return (
    <>
    <article 
      role="button"
      tabIndex={0}
      onClick={() => setShowDetails(true)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDetails(true); }}
      className={`rounded-[2.5rem] relative flex flex-col overflow-hidden transition-all duration-300 h-full cursor-pointer group ${
      isExpired ? 'bg-white border border-red-100 opacity-80 shadow-sm' : 
      isBestValue ? 'bg-white border-2 border-emerald-500 shadow-[0_20px_50px_rgba(16,185,129,0.15)] scale-[1.01]' : 
      'bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1'
    }`}>
      {/* Top Section: Badges & Image */}
      <div className="p-5 flex items-start justify-between relative">
        <div className="flex flex-col gap-2 items-start z-10 max-w-[55%]">
          {isBestValue && (
            <motion.span 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-black bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white shadow-lg shadow-red-500/20 mb-1 uppercase tracking-wider"
            >
              <Zap className="w-3 h-3 mr-1 fill-current" />
              Best Value
            </motion.span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {isExpired && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-red-50 text-red-600 border border-red-100 uppercase tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse"></span>
                Expired
              </span>
            )}
            {!isExpired && deal.in_stock !== false && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                In Stock
              </span>
            )}
            {!isExpired && daysLeft > 0 && daysLeft <= 3 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-orange-50 text-orange-600 border border-orange-100 uppercase tracking-tight">
                <Clock className="w-3 h-3 mr-1 text-orange-500" />
                {daysLeft}d Left
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1.5 mt-1">
            {deal.verified && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-tight">
                <BadgeCheck className="w-3 h-3 mr-1 text-blue-500" />
                Verified
              </span>
            )}
            {isBasicNeed(deal) && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-tight">
                <ShoppingBasket className="w-3 h-3 mr-1 text-rose-500" />
                Essential
              </span>
            )}
          </div>
        </div>

        <div className="w-32 h-32 sm:w-44 sm:h-44 flex-shrink-0 relative flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
          {/* Image Glow Background */}
          <div className={`absolute inset-0 rounded-full blur-3xl opacity-20 ${isBestValue ? 'bg-emerald-400' : 'bg-slate-200'}`}></div>
          
          <div className="absolute top-0 right-0 z-20 flex flex-col gap-2">
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); removeDeal(deal.product_id); }}
                className="p-2 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 text-slate-400 hover:border-red-500 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
                title="Delete deal"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleCompareToggle}
              className={`p-2 rounded-xl border transition-all shadow-sm ${
                isComparing 
                  ? 'bg-slate-900 border-slate-900 text-white' 
                  : 'bg-white/90 backdrop-blur-md border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900'
              }`}
              title={isComparing ? "Remove from compare" : "Add to compare"}
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>
          {deal.image_url ? (
            <img alt={deal.name} className={`max-w-full max-h-full object-contain mix-blend-multiply relative z-10 ${isExpired ? 'grayscale' : ''}`} src={deal.image_url} referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50 rounded-3xl border border-dashed border-slate-200">No Image</div>
          )}
        </div>
      </div>

      {/* Title & Category */}
      <div className="px-6 pb-2">
        <h2 className="text-xl font-black text-slate-900 leading-[1.2] line-clamp-2 font-display group-hover:text-[#0097b2] transition-colors" title={deal.name}>{deal.name}</h2>
        <div className="flex items-center gap-2 mt-2.5 text-sm text-slate-500 flex-wrap font-medium">
          {deal.brand && <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-slate-700 font-bold">{deal.brand}</span>}
          {deal.category && <span className="text-slate-400">{deal.category}</span>}
          {deal.weight && (
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-bold">
              {deal.weight}
            </span>
          )}
        </div>
        
        {/* Reviews and Nutri-Score */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100">
            <div className="flex items-center text-amber-400">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-sm font-black text-slate-900 ml-1.5">{rating}</span>
            </div>
            <div className="w-px h-3 bg-slate-200"></div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{reviewCount} reviews</span>
          </div>
          
          {isBasicNeed(deal) && isFoodItem(deal) && (
            <div className="flex items-center gap-2" title="Nutritional Score">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nutri-Score</span>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md ${nutriColor} ring-2 ring-white`}>
                {nutriScore}
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {deal.is_local && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-tight">
              <Leaf className="w-3 h-3 mr-1.5" />
              Local Fiji
            </span>
          )}
          {deal.origin === 'Fiji' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-tight">
              <MapPin className="w-3 h-3 mr-1.5" />
              Fiji Grown
            </span>
          )}
          {deal.tags?.map((tag, idx) => {
            let colorClass = "bg-slate-50 text-slate-700 border-slate-200";
            const lowerTag = tag.toLowerCase();
            if (lowerTag.includes('halal')) colorClass = "bg-blue-50 text-blue-700 border-blue-200";
            else if (lowerTag.includes('veg') || lowerTag.includes('plant')) colorClass = "bg-green-50 text-green-700 border-green-200";
            else if (lowerTag.includes('sugar')) colorClass = "bg-red-50 text-red-700 border-red-200";
            else if (lowerTag.includes('free')) colorClass = "bg-purple-50 text-purple-700 border-purple-200";
            
            return (
              <span key={idx} className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-tight ${colorClass}`}>
                {tag}
              </span>
            );
          })}
        </div>
      </div>

      {/* Price */}
      <div className="px-6 py-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-slate-900 tracking-tighter font-display">${currentPrice.toFixed(2)}</span>
          <span className="text-lg font-bold text-slate-300">/{unit || deal.unit || 'ea'}</span>
        </div>
        {transportCost > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">True Cost</div>
            <div className="bg-slate-900 text-white px-2.5 py-1 rounded-xl text-sm font-black shadow-lg shadow-slate-900/10">
              ${realPrice.toFixed(2)}
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">via {transportMode}</span>
          </div>
        )}
        {isBestValue && savingsValue > 0 && (
          <motion.div 
            animate={{ x: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-base font-black text-emerald-600 mt-3 flex items-center gap-2"
          >
            <TrendingDown className="w-5 h-5" />
            Save ${savingsValue.toFixed(2)} today
          </motion.div>
        )}
      </div>

      {/* Price Predictor & History */}
      <div className="px-6 py-2 space-y-2">
        <div className={`flex items-center justify-between p-4 rounded-[1.5rem] border transition-colors ${
          isBestValue ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50/50 border-slate-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isBestValue ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
              <LineChart className="w-4 h-4" />
            </div>
            <span className="text-sm font-black text-slate-700">Price Trend</span>
          </div>
          <div className="flex items-center gap-4">
            <svg width="60" height="24" className="overflow-visible">
              <path d={sparklinePath} fill="none" stroke={deal.price_trend === 'dropping' ? '#10b981' : deal.price_trend === 'rising' ? '#ef4444' : '#3b82f6'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
              deal.price_trend === 'dropping' ? 'bg-emerald-100 text-emerald-700' : 
              deal.price_trend === 'rising' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {deal.price_trend}
            </div>
          </div>
        </div>

        {deal.price_history && deal.price_history.length > 0 && (
          <div className="p-4 rounded-[1.5rem] bg-slate-50/50 border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price History</span>
              <span className="text-[10px] font-bold text-slate-400">{deal.price_history.length} records</span>
            </div>
            <div className="space-y-2">
              {deal.price_history.slice(-3).reverse().map((point, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">{new Date(point.date).toLocaleDateString('en-FJ', { month: 'short', day: 'numeric' })}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900">${point.price.toFixed(2)}</span>
                    {idx === 0 && deal.price && point.price > deal.price && (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        -${(point.price - deal.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Smart Insights & Logistics Combined */}
      <div className="px-6 py-5 space-y-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${isBestValue ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
            {isBestValue ? <Trophy className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">{isBestValue ? 'Premium Deal' : 'Market Insight'}</p>
            <p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed">
              {isBestValue 
                ? 'This is currently the best price for this item in your region.' 
                : savingsValue > 2 ? 'Significant savings detected compared to other stores.' : 'A solid choice for your weekly grocery run.'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-slate-500">
            <Store className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-slate-900 truncate">{deal.store}</p>
              {distance !== null && (
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg uppercase">
                  {distance.toFixed(1)}km
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{deal.location}</p>
            {deal.store_hours && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Clock className="w-3 h-3" />
                <span>{deal.store_hours}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trip Savings - Premium Highlight */}
      <div className="mx-4 mb-4 p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 shadow-xl shadow-slate-900/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Trip Savings</p>
              <p className="text-[10px] text-slate-500 font-medium">Potential list impact</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-white font-display">
              +{totalTripSavings > 0 ? '$' + totalTripSavings.toFixed(2) : '$0.00'}
            </p>
          </div>
        </div>
      </div>

      {/* Community & Share */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-slate-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); upvoteDeal(deal.product_id); }}
            className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 transition-all group"
          >
            <div className="p-2 rounded-xl group-hover:bg-emerald-50 transition-colors">
              <ThumbsUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-sm font-black text-slate-700">{deal.upvotes || 0}</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); downvoteDeal(deal.product_id); }}
            className="flex items-center gap-2 text-slate-400 hover:text-rose-500 transition-all group"
          >
            <div className="p-2 rounded-xl group-hover:bg-rose-50 transition-colors">
              <ThumbsDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-sm font-black text-slate-700">{deal.downvotes || 0}</span>
          </button>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
          className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
          title="Share Deal"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="px-6 pb-6 pt-2">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => { e.stopPropagation(); !isExpired && addToShoppingList(deal); }}
          disabled={isExpired}
          className={`w-full py-4 ${isExpired ? 'bg-slate-200 cursor-not-allowed text-slate-400' : 'bg-[#0097b2] hover:bg-[#007b99] text-white shadow-xl shadow-cyan-900/20'} font-black rounded-[1.5rem] transition-all flex items-center justify-center gap-3 text-lg font-display`}
        >
          <ListPlus className="w-6 h-6" />
          {isExpired ? 'Expired' : 'Add to List'}
        </motion.button>
        
        <button 
          onClick={(e) => { e.stopPropagation(); setShowCompare(true); }}
          disabled={comparableDeals.length <= 1}
          className={`w-full py-3 mt-3 border-2 border-slate-100 bg-white text-sm font-black rounded-[1.5rem] flex items-center justify-center gap-2 transition-all ${
            comparableDeals.length <= 1 ? 'text-slate-200 cursor-not-allowed opacity-50' : 'text-slate-600 hover:bg-slate-50 hover:border-slate-200'
          }`}
        >
          <ArrowRightLeft className="w-4.5 h-4.5" />
          {comparableDeals.length <= 1 ? 'No other stores' : `Compare ${comparableDeals.length - 1} stores`}
        </button>
      </div>
      
      {showCompare && <CompareModal deal={deal} onClose={() => setShowCompare(false)} />}
    </article>
    <ProductDetailsModal 
      deal={deal}
      isOpen={showDetails}
      onClose={() => setShowDetails(false)}
      distance={distance}
      daysLeft={daysLeft}
      isExpired={isExpired}
    />
    </>
  );
};

export default ProductCard;
