import React, { useState, useMemo } from 'react';
import { Deal } from '../types';
import { useAppStore } from '../store';
import CompareModal from './CompareModal';
import { getEffectivePrice, getNormalizedPrice, getStoreCoordinates, getDistanceFromLatLonInKm, isBasicNeed } from '../utils/helpers';
import { BadgeCheck, ShoppingBasket, Leaf, MapPin, TrendingDown, Calendar, LineChart, Lightbulb, Car, Clock, Store, ShoppingCart, ArrowRightLeft } from 'lucide-react';

const ProductCard: React.FC<{ deal: Deal, isBestValue?: boolean, userLocation?: {lat: number, lon: number} | null }> = ({ deal, isBestValue, userLocation }) => {
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  const shoppingList = useAppStore(state => state.shoppingList);
  const allDeals = useAppStore(state => state.deals);
  const compareList = useAppStore(state => state.compareList);
  const addToCompareList = useAppStore(state => state.addToCompareList);
  const removeFromCompareList = useAppStore(state => state.removeFromCompareList);
  const [showCompare, setShowCompare] = useState(false);

  const isComparing = compareList.some(d => d.product_id === deal.product_id);

  const handleCompareToggle = () => {
    if (isComparing) {
      removeFromCompareList(deal.product_id);
    } else {
      addToCompareList(deal);
    }
  };

  const currentPrice = getEffectivePrice(deal);
  const { pricePerKg, unit } = getNormalizedPrice(deal);

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

  const distance = useMemo(() => {
    if (!userLocation) return null;
    const coords = getStoreCoordinates(deal.location);
    if (!coords) return null;
    return getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
  }, [userLocation, deal.location]);

  return (
    <main className={`rounded-2xl relative flex flex-col overflow-hidden transition-all duration-200 h-full ${
      isExpired ? 'bg-white border border-red-200 opacity-80 shadow-sm' : 
      isBestValue ? 'bg-emerald-50/50 border-2 border-emerald-500 shadow-lg shadow-emerald-500/20 scale-[1.01]' : 
      'bg-white border border-gray-200 shadow-sm hover:shadow-md'
    }`}>
      {/* Top Section: Badges & Image */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex flex-col gap-1.5 items-start z-10 max-w-[50%]">
          {isBestValue && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm mb-1">
              🔥 Best Deal
            </span>
          )}
          {isExpired && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
              Expired
            </span>
          )}
          {!isExpired && deal.in_stock !== false && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              In Stock
            </span>
          )}
          {deal.verified && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
              <BadgeCheck className="w-3 h-3 mr-1 text-blue-500" />
              Verified Deal
            </span>
          )}
          {isBasicNeed(deal) && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-100">
              <ShoppingBasket className="w-3 h-3 mr-1 text-rose-500" />
              Basic Need
            </span>
          )}
        </div>
        <div className="w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0 relative flex items-center justify-center">
          <button
            onClick={handleCompareToggle}
            className={`absolute top-0 right-0 z-20 p-1.5 rounded-lg border-2 transition-all ${
              isComparing 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : 'bg-white/80 backdrop-blur-sm border-gray-200 text-gray-400 hover:border-emerald-500 hover:text-emerald-500'
            }`}
            title={isComparing ? "Remove from compare" : "Add to compare"}
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          {deal.image_url ? (
            <img alt={deal.name} className={`max-w-full max-h-full object-contain mix-blend-multiply ${isExpired ? 'grayscale' : ''}`} src={deal.image_url} referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 bg-slate-50 rounded-xl">No Image</div>
          )}
        </div>
      </div>

      {/* Title & Category */}
      <div className="px-4 pb-2">
        <h2 className="text-lg font-bold text-gray-900 leading-tight line-clamp-2" title={deal.name}>{deal.name}</h2>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 flex-wrap">
          {deal.brand && <span>Brand: <span className="text-emerald-600 font-medium">{deal.brand}</span></span>}
          {deal.brand && deal.category && <span>•</span>}
          {deal.category && <span>{deal.category}</span>}
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {deal.is_local && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Leaf className="w-3 h-3 mr-1" />
              Local Fiji Produce
            </span>
          )}
          {deal.origin === 'Fiji' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
              <MapPin className="w-3 h-3 mr-1" />
              Grown in Fiji
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
              <span key={idx} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${colorClass}`}>
                {tag}
              </span>
            );
          })}
        </div>
      </div>

      {/* Price */}
      <div className="px-4 py-2">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-gray-900">${currentPrice.toFixed(2)}</span>
          <span className="text-sm font-medium text-gray-500">/{unit || deal.unit || 'ea'}</span>
        </div>
        {isBestValue && savingsValue > 0 && (
          <div className="text-sm font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
            <TrendingDown className="w-4 h-4" />
            Save ${savingsValue.toFixed(2)} vs average
          </div>
        )}
        {deal.end_date && (
          <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-bold border border-red-100">
            <Calendar className="w-3.5 h-3.5" />
            Ends: {new Date(deal.end_date).toLocaleDateString('en-GB')}
          </div>
        )}
      </div>

      {/* Price Predictor */}
      <div className="px-4 py-2">
        <div className={`flex items-center justify-between p-2 rounded-lg border ${
          isBestValue ? 'bg-white/60 border-emerald-100' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <LineChart className={`w-4 h-4 ${isBestValue ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span className={`text-xs font-medium ${isBestValue ? 'text-emerald-800' : 'text-slate-600'}`}>Price Predictor</span>
          </div>
          <span className={`text-xs font-bold ${
            deal.price_trend === 'dropping' ? 'text-emerald-600' : 
            deal.price_trend === 'rising' ? 'text-red-600' : 'text-blue-600'
          }`}>
            {deal.price_trend === 'dropping' ? 'Dropping' : 
             deal.price_trend === 'rising' ? 'Rising' : 'Stable'}
          </span>
        </div>
      </div>

      {/* Smart Insights */}
      <div className="px-4 py-3 border-t border-gray-50">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Smart Insights</h3>
        <div className="flex items-start gap-2">
          {isBestValue ? (
            <>
              <BadgeCheck className="w-4 h-4 text-emerald-500 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-900">Top Pick</p>
                <p className="text-[10px] text-gray-500">Highly competitive price for this item.</p>
              </div>
            </>
          ) : savingsValue > 2 && distance && distance > 5 ? (
            <>
              <Car className="w-4 h-4 text-emerald-500 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-900">Worth the drive</p>
                <p className="text-[10px] text-gray-500">Savings cover estimated fuel cost.</p>
              </div>
            </>
          ) : (
            <>
              <Lightbulb className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-900">Standard Deal</p>
                <p className="text-[10px] text-gray-500">Good price for everyday shopping.</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Store Logistics */}
      <div className="px-4 py-3 border-t border-gray-50">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Store Logistics</h3>
        {deal.store_hours && (
          <div className="flex items-center gap-2 mb-3">
            <div className={`${isBestValue ? 'bg-white/60 border-emerald-100' : 'bg-white border-gray-100'} p-1.5 rounded border flex items-center gap-2`}>
              <Clock className="w-4 h-4 text-emerald-500" />
              <div>
                <p className="text-[10px] font-bold text-gray-900 line-clamp-1" title={deal.store_hours}>{deal.store_hours}</p>
                <p className="text-[9px] text-gray-500">Hours</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Store className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-gray-900">{deal.store}</p>
            {deal.location && deal.location !== 'Unknown Location' && (
              <p className="text-[10px] text-gray-500 leading-tight">{deal.location}</p>
            )}
            {distance !== null && (
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">{distance.toFixed(1)}km away</p>
            )}
          </div>
        </div>
      </div>

      {/* Total Trip Savings */}
      <div className="px-4 py-3 flex items-center justify-between border-t border-gray-50">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="w-4 h-4 text-emerald-500" />
          <div>
            <p className="text-xs font-bold text-gray-900">Total Trip Savings</p>
            <p className="text-[9px] text-gray-500">If added to your current shopping list.</p>
          </div>
        </div>
        <span className="text-sm font-black text-emerald-600">+{totalTripSavings > 0 ? '$' + totalTripSavings.toFixed(2) : '$0.00'}</span>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4 pt-2 mt-auto">
        <button 
          onClick={() => !isExpired && addToShoppingList(deal)}
          disabled={isExpired}
          className={`w-full py-2.5 ${isExpired ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-[0.98]'} font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm`}
        >
          <ShoppingCart className="w-4 h-4" />
          {isExpired ? 'Deal Expired' : 'Add to List'}
        </button>
        <button 
          onClick={() => setShowCompare(true)}
          disabled={comparableDeals.length <= 1}
          className={`w-full py-2 mt-2 border border-gray-200 bg-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-colors ${
            comparableDeals.length <= 1 ? 'text-gray-400 cursor-not-allowed opacity-70' : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          {comparableDeals.length <= 1 ? 'No Comparisons Available' : `Compare (${comparableDeals.length - 1} other stores)`}
        </button>
      </div>
      
      {showCompare && <CompareModal deal={deal} onClose={() => setShowCompare(false)} />}
    </main>
  );
};

export default ProductCard;
