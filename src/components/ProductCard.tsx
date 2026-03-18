import React, { useState, useMemo } from 'react';
import { Deal } from '../types';
import { useAppStore } from '../store';
import CompareModal from './CompareModal';
import { getEffectivePrice, getNormalizedPrice, getStoreCoordinates, getDistanceFromLatLonInKm, isBasicNeed } from '../utils/helpers';

const ProductCard: React.FC<{ deal: Deal, isBestValue?: boolean, userLocation?: {lat: number, lon: number} | null }> = ({ deal, isBestValue, userLocation }) => {
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  const allDeals = useAppStore(state => state.deals);
  const [showCompare, setShowCompare] = useState(false);

  const currentPrice = getEffectivePrice(deal);
  const { pricePerKg, unit } = getNormalizedPrice(deal);

  const comparableDeals = useMemo(() => {
    return allDeals.filter(d => d.name.toLowerCase().trim() === deal.name.toLowerCase().trim());
  }, [allDeals, deal.name]);

  const averageMarketPrice = useMemo(() => {
    if (comparableDeals.length <= 1) return null;
    const sum = comparableDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0);
    return sum / comparableDeals.length;
  }, [comparableDeals]);

  const savingsValue = averageMarketPrice ? averageMarketPrice - currentPrice : 0;
  const savingsPercentage = averageMarketPrice && averageMarketPrice > 0 ? (savingsValue / averageMarketPrice) * 100 : 0;

  const distance = useMemo(() => {
    if (!userLocation) return null;
    const coords = getStoreCoordinates(deal.location);
    if (!coords) return null;
    return getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
  }, [userLocation, deal.location]);

  const isExpired = useMemo(() => new Date(deal.end_date) < new Date(), [deal.end_date]);

  return (
    <main className={`bg-white rounded-2xl shadow-lg relative flex flex-col overflow-hidden border ${isExpired ? 'border-red-200 opacity-80' : 'border-gray-200'} h-full`}>
      {/* Header */}
      <header className="relative bg-white" data-purpose="product-header">
        {/* Product Image */}
        <div className="w-full h-48 bg-slate-50 flex items-center justify-center overflow-hidden relative p-4">
          {deal.image_url ? (
            <img alt={deal.name} className={`max-w-full max-h-full object-contain mix-blend-multiply ${isExpired ? 'grayscale' : ''}`} src={deal.image_url} referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">No Image</div>
          )}
          
          {/* Stock Status & Community Verification */}
          <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
            {isExpired && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white border border-red-600 shadow-sm">
                <span className="material-symbols-outlined text-[12px] mr-1">warning</span>
                Expired Deal
              </span>
            )}
            {!isExpired && deal.in_stock !== false && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 border border-green-200 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                In Stock
              </span>
            )}
            {deal.verified && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
                <span className="material-symbols-outlined text-[12px] mr-1">verified</span>
                Verified Deal
              </span>
            )}
            {isBestValue && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/90 text-white border border-emerald-400 shadow-sm backdrop-blur-sm">
                <span className="material-symbols-outlined text-[12px] mr-1">trending_up</span>
                Top Pick
              </span>
            )}
            {isBasicNeed(deal) && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/90 text-white border border-rose-400 shadow-sm backdrop-blur-sm">
                <span className="material-symbols-outlined text-[12px] mr-1">shopping_basket</span>
                Basic Need
              </span>
            )}
          </div>
        </div>

        {/* Title & Category */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight line-clamp-2" title={deal.name}>{deal.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {deal.brand && <span className="text-xs font-medium text-gray-500">Brand: <span className="text-emerald-600">{deal.brand}</span></span>}
                {deal.brand && deal.category && <span className="w-1 h-1 bg-gray-300 rounded-full"></span>}
                {deal.category && <span className="text-xs font-medium text-gray-500">{deal.category}</span>}
              </div>
              
              {/* Health & Origin */}
              {(deal.is_local || deal.nutri_score || deal.origin === 'Fiji') && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {deal.is_local && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <span className="material-symbols-outlined text-[12px] mr-1">eco</span>
                      Local Fiji Produce
                    </span>
                  )}
                  {deal.nutri_score && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      <span className="material-symbols-outlined text-[12px] mr-1">health_and_safety</span>
                      Nutri-Score {deal.nutri_score}
                    </span>
                  )}
                  {deal.origin === 'Fiji' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                      <span className="material-symbols-outlined text-[12px] mr-1">location_on</span>
                      Grown in Fiji
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
              {isBestValue && (
                <div className="bg-emerald-500/10 px-2 py-1 rounded-lg">
                  <span className="text-emerald-700 font-bold text-[10px] uppercase tracking-wider">🏆 Best Value</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Price & Savings Section */}
      <section className="px-5 py-3 border-b border-gray-100" data-purpose="price-and-savings">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-gray-900">${currentPrice.toFixed(2)}<span className="text-sm font-normal text-gray-500 ml-1">/{unit || deal.unit || 'ea'}</span></span>
          {averageMarketPrice && averageMarketPrice > currentPrice && (
            <span className="text-gray-400 line-through text-sm">Avg ${averageMarketPrice.toFixed(2)}</span>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          {savingsValue > 0 && (
            <div className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-semibold">
              Save ${savingsValue.toFixed(2)} ({savingsPercentage.toFixed(1)}%)
            </div>
          )}
          {deal.end_date && (
            <div className="inline-flex items-center px-2 py-1 rounded-md bg-red-50 text-red-700 text-xs font-semibold">
              <span className="material-symbols-outlined text-[14px] mr-1">event</span>
              Ends: {new Date(deal.end_date).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Price Predictor */}
        {deal.price_trend && (
          <div className="mt-3 flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[16px]">monitoring</span>
              <span className="text-xs font-medium text-slate-600">Price Predictor</span>
            </div>
            <span className={`text-xs font-bold ${
              deal.price_trend === 'dropping' ? 'text-emerald-600' : 
              deal.price_trend === 'rising' ? 'text-red-600' : 'text-blue-600'
            }`}>
              {deal.price_trend === 'dropping' ? 'Price Dropping' : 
               deal.price_trend === 'rising' ? 'Price Rising' : 'Stable'}
            </span>
          </div>
        )}
      </section>

      {/* Smart Insights & Logistics */}
      <section className="px-5 py-3 border-b border-gray-100 bg-slate-50/50" data-purpose="smart-insights">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Smart Insights</h3>
        <div className="space-y-2">
          {savingsValue > 2 && distance && distance > 5 && (
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-[16px] mt-0.5">directions_car</span>
              <div>
                <p className="text-xs font-bold text-gray-900">Worth the drive</p>
                <p className="text-[10px] text-gray-500">Savings cover estimated fuel cost.</p>
              </div>
            </div>
          )}
          {isBestValue && (
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-[16px] mt-0.5">storefront</span>
              <div>
                <p className="text-xs font-bold text-gray-900">Best nearby</p>
                <p className="text-[10px] text-gray-500">Lowest price within 10km.</p>
              </div>
            </div>
          )}
          {/* Fallback Insight if none apply */}
          {!(savingsValue > 2 && distance && distance > 5) && !isBestValue && (
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">lightbulb</span>
              <div>
                <p className="text-xs font-bold text-gray-900">Standard Deal</p>
                <p className="text-[10px] text-gray-500">Good price for everyday shopping.</p>
              </div>
            </div>
          )}
        </div>
        
        {(deal.store_hours || deal.traffic_status) && (
          <>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-2">Store Logistics</h3>
            <div className="grid grid-cols-2 gap-2">
              {deal.store_hours && (
                <div className="bg-white p-2 rounded-lg border border-gray-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500 text-[16px]">schedule</span>
                  <div>
                    <p className="text-[10px] font-bold text-gray-900 line-clamp-1" title={deal.store_hours}>{deal.store_hours}</p>
                    <p className="text-[9px] text-gray-500">Hours</p>
                  </div>
                </div>
              )}
              {deal.traffic_status && (
                <div className="bg-white p-2 rounded-lg border border-gray-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-[16px]">group</span>
                  <div>
                    <p className="text-[10px] font-bold text-gray-900 line-clamp-1" title={deal.traffic_status}>{deal.traffic_status}</p>
                    <p className="text-[9px] text-gray-500">Traffic</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Best Store Info */}
      <section className="px-5 py-3 border-b border-gray-100" data-purpose="best-nearby-store">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-400 text-[20px]">storefront</span>
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-gray-900">{deal.store}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{deal.location}</span>
                {distance !== null && (
                  <>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="text-xs text-gray-500">{distance.toFixed(1)}km away</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Store Comparison */}
      {comparableDeals.length > 1 && (
        <section className="px-5 py-3 border-b border-gray-100" data-purpose="store-comparison-list">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Compare Stores</h3>
          <div className="space-y-2">
            {comparableDeals
              .filter(d => d.product_id !== deal.product_id)
              .sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b))
              .slice(0, 3)
              .map((compDeal, idx) => {
              const compPrice = getEffectivePrice(compDeal);
              const isBetter = compPrice < currentPrice;
              const diff = Math.abs(compPrice - currentPrice);
              
              return (
                <div key={idx} className={`flex justify-between items-center p-2 rounded-lg ${isBetter ? 'border border-emerald-200 bg-emerald-50' : 'border border-gray-100'}`}>
                  <div>
                    <span className="block text-sm font-bold text-gray-900">{compDeal.store}</span>
                    <div className="flex items-center gap-2">
                      {isBetter && <span className="text-[10px] text-emerald-600 font-bold">Better Price</span>}
                      <span className="text-[10px] text-gray-500">{compDeal.location}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-bold text-gray-900">${compPrice.toFixed(2)}</span>
                    <span className={`text-[10px] ${isBetter ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isBetter ? '-' : '+'}${diff.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Variants */}
      {deal.variants && deal.variants.length > 0 && (
        <section className="px-5 py-3 border-b border-gray-100" data-purpose="product-variants">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Available Options</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {deal.variants.map((v, idx) => (
              <div key={idx} className="flex-none px-3 py-2 border border-gray-200 rounded-lg text-center min-w-[80px]">
                <span className="block text-[10px] text-gray-500 uppercase">{v.label || v.weight_estimate}</span>
                <span className="block text-sm font-bold text-gray-900">${v.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Basket Impact */}
      <section className="px-5 py-3 border-b border-gray-100" data-purpose="basket-impact">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-500 text-[18px]">shopping_basket</span>
            <span className="text-xs font-bold text-gray-900">Total Trip Savings</span>
          </div>
          <span className="text-sm font-black text-emerald-600">+${savingsValue.toFixed(2)}</span>
        </div>
        <p className="text-[10px] text-gray-500 mt-1">If added to your current shopping list.</p>
      </section>

      {/* Action Buttons */}
      <footer className="px-5 py-4 mt-auto bg-gray-50" data-purpose="actions">
        <button 
          onClick={() => !isExpired && addToShoppingList(deal)}
          disabled={isExpired}
          className={`w-full py-3 ${isExpired ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-[0.98]'} font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2`}
        >
          <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
          {isExpired ? 'Deal Expired' : 'Add to List'}
        </button>
        <div className="mt-2">
          <button 
            onClick={() => setShowCompare(true)}
            disabled={comparableDeals.length <= 1}
            className={`w-full py-2 border border-gray-200 bg-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-colors ${
              comparableDeals.length <= 1 ? 'text-gray-400 cursor-not-allowed opacity-70' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
            {comparableDeals.length <= 1 ? 'No Comparisons Available' : `Compare (${comparableDeals.length - 1} other stores)`}
          </button>
        </div>
      </footer>
      {showCompare && <CompareModal deal={deal} onClose={() => setShowCompare(false)} />}
    </main>
  );
};

export default ProductCard;
