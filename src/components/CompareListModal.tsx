import React, { useMemo, useEffect } from 'react';
import { X, Trophy, MapPin, CheckCircle2, ListPlus, Calendar } from 'lucide-react';
import { Deal } from '../types';
import { useAppStore } from '../store';
import { getStoreCoordinates, getDistanceFromLatLonInKm, getEffectivePrice, getNormalizedPrice } from '../utils/helpers';

export default function CompareListModal({ onClose }: { onClose: () => void }) {
  const compareList = useAppStore(state => state.compareList);
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  const userLocation = useAppStore(state => state.userLocation);
  const selectedRegion = useAppStore(state => state.selectedRegion);

  useEffect(() => {
    if (compareList.length < 2) {
      onClose();
    }
  }, [compareList.length, onClose]);

  const sortedDeals = useMemo(() => {
    return [...compareList].sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
  }, [compareList]);

  const bestDeal = sortedDeals[0];
  const averagePrice = useMemo(() => {
    if (sortedDeals.length === 0) return 0;
    const sum = sortedDeals.reduce((acc, d) => acc + getEffectivePrice(d), 0);
    return sum / sortedDeals.length;
  }, [sortedDeals]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-20">
          <div>
            <h2 className="text-xl font-black text-gray-900">Compare Items</h2>
            <p className="text-sm text-gray-500">Comparing {compareList.length} selected items</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {dealsWithDistance.map((deal, index) => {
              const currentPrice = getEffectivePrice(deal);
              const { pricePerKg, unit } = getNormalizedPrice(deal);
              const isBest = deal.product_id === bestDeal?.product_id;
              const isExpired = new Date(deal.end_date) < new Date();

              return (
                <div 
                  key={deal.product_id} 
                  className={`bg-white rounded-2xl p-4 flex flex-col border-2 transition-all relative ${
                    isBest ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-transparent shadow-sm'
                  }`}
                >
                  <button 
                    onClick={() => useAppStore.getState().removeFromCompareList(deal.product_id)}
                    className="absolute top-2 right-2 p-1.5 bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded-full transition-colors z-10"
                    title="Remove from comparison"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {isBest && (
                    <div className="bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full self-start mb-3 flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      Lowest Price
                    </div>
                  )}

                  <div className="w-full aspect-square mb-4 relative flex items-center justify-center bg-slate-50 rounded-xl p-2">
                    {deal.image_url ? (
                      <img src={deal.image_url} alt={deal.name} className="max-w-full max-h-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-gray-400 text-xs">No Image</span>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 text-sm line-clamp-2 mb-1" title={deal.name}>{deal.name}</h3>
                  <p className="text-xs text-gray-500 mb-3">{deal.brand || 'No Brand'}</p>

                  <div className="mt-auto">
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-2xl font-black text-gray-900">${currentPrice.toFixed(2)}</span>
                      <span className="text-xs font-medium text-gray-500">/{unit || deal.unit || 'ea'}</span>
                    </div>

                    {pricePerKg && (
                      <p className="text-[10px] text-gray-500 mb-1">
                        ${pricePerKg.toFixed(2)}/kg
                      </p>
                    )}

                    {currentPrice < averagePrice && (
                      <p className="text-xs font-bold text-emerald-600 mb-3">
                        Save ${(averagePrice - currentPrice).toFixed(2)} vs avg
                      </p>
                    )}
                    {currentPrice >= averagePrice && (
                      <div className="h-4 mb-3"></div>
                    )}

                    <div className="space-y-2 mb-4">
                      <div className="flex items-start gap-2 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-gray-900">{deal.store}</p>
                          {deal.location && deal.location !== 'Unknown Location' && (
                            <p className="text-gray-500 line-clamp-1">{deal.location}</p>
                          )}
                          {deal.distance !== Infinity && (
                            <p className="text-emerald-600 font-medium">{deal.distance.toFixed(1)}km away</p>
                          )}
                        </div>
                      </div>
                      
                      {deal.end_date && (
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className={isExpired ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {isExpired ? 'Expired' : `Ends ${new Date(deal.end_date).toLocaleDateString('en-GB')}`}
                          </span>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => !isExpired && addToShoppingList(deal)}
                      disabled={isExpired}
                      className={`w-full py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-colors ${
                        isExpired 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : isBest 
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      {isExpired ? 'Expired' : 'Add to List'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
