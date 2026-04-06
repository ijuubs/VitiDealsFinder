import React, { useState } from 'react';
import { Deal } from '../types';
import { X, Clock, MapPin, TrendingDown, ThumbsUp, ThumbsDown, AlertTriangle, Share2, ListPlus, Info } from 'lucide-react';
import { getEffectivePrice, getNormalizedPrice } from '../utils/helpers';
import { useAppStore } from '../store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ProductDetailsModalProps {
  deal: Deal;
  isOpen: boolean;
  onClose: () => void;
  distance: number | null;
  daysLeft: number;
  isExpired: boolean;
}

export default function ProductDetailsModal({ deal, isOpen, onClose, distance, daysLeft, isExpired }: ProductDetailsModalProps) {
  const addToShoppingList = useAppStore(state => state.addToShoppingList);
  const upvoteDeal = useAppStore(state => state.upvoteDeal);
  const downvoteDeal = useAppStore(state => state.downvoteDeal);
  const flagOutOfStock = useAppStore(state => state.flagOutOfStock);
  
  const [hasVoted, setHasVoted] = useState<'up' | 'down' | null>(null);
  const [hasFlagged, setHasFlagged] = useState(false);

  if (!isOpen) return null;

  const currentPrice = getEffectivePrice(deal);
  const { pricePerKg, unit } = getNormalizedPrice(deal);

  const handleUpvote = () => {
    if (hasVoted === 'up') return;
    upvoteDeal(deal.product_id);
    setHasVoted('up');
  };

  const handleDownvote = () => {
    if (hasVoted === 'down') return;
    downvoteDeal(deal.product_id);
    setHasVoted('down');
  };

  const handleFlag = () => {
    if (hasFlagged) return;
    flagOutOfStock(deal.product_id);
    setHasFlagged(true);
  };

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

  // Mock price history data
  const priceHistoryData = [];
  const now = new Date();
  let basePrice = currentPrice + 2;
  for (let i = 90; i >= 0; i -= 7) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    basePrice = basePrice + (Math.random() * 0.5 - 0.25);
    priceHistoryData.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: Math.max(0.5, basePrice).toFixed(2)
    });
  }
  priceHistoryData[priceHistoryData.length - 1].price = currentPrice.toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6">
      <div 
        className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative h-48 sm:h-64 bg-slate-100 flex-shrink-0">
          {deal.image_url ? (
            <img 
              src={deal.image_url} 
              alt={deal.name} 
              className="w-full h-full object-contain p-4"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <span className="font-display font-bold text-2xl">No Image</span>
            </div>
          )}
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 hover:bg-white transition-colors shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Large Countdown Timer */}
          {!isExpired && daysLeft > 0 && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/50 flex items-center justify-between sm:justify-start gap-4">
              <div className="flex items-center gap-2 text-orange-600">
                <Clock className="w-5 h-5" />
                <span className="font-bold font-display">Ends in</span>
              </div>
              <div className="flex gap-2">
                <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg font-black text-lg">
                  {daysLeft} <span className="text-xs font-bold uppercase">Days</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-2xl font-black text-slate-900 font-display leading-tight">{deal.name}</h2>
              <p className="text-slate-500 font-medium">{deal.brand}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-emerald-600">${currentPrice.toFixed(2)}</div>
              {deal.original_price && deal.original_price > currentPrice && (
                <div className="text-sm text-slate-400 line-through font-medium">${deal.original_price.toFixed(2)}</div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {deal.store}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              <MapPin className="w-3 h-3 mr-1" />
              {deal.location} {distance !== null ? `(${distance.toFixed(1)}km)` : ''}
            </span>
            {pricePerKg > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                ${pricePerKg.toFixed(2)}/{unit}
              </span>
            )}
          </div>

          {/* Community Stock Status */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              Community Stock Status
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <button 
                  onClick={handleUpvote}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${
                    hasVoted === 'up' ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ThumbsUp className="w-5 h-5" />
                  In Stock ({deal.upvotes || 0})
                </button>
                <button 
                  onClick={handleDownvote}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${
                    hasVoted === 'down' ? 'bg-orange-100 text-orange-700 border-2 border-orange-500' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ThumbsDown className="w-5 h-5" />
                  Low Stock ({deal.downvotes || 0})
                </button>
              </div>
              <button 
                onClick={handleFlag}
                className={`sm:w-auto w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors ${
                  hasFlagged ? 'bg-red-100 text-red-700 border-2 border-red-500' : 'bg-white border border-slate-200 text-red-600 hover:bg-red-50'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
                {hasFlagged ? 'Flagged' : 'Report Sold Out'}
              </button>
            </div>
          </div>

          {/* Price History */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-500" />
              90-Day Price Trend
            </h3>
            <div className="h-48 w-full bg-white rounded-2xl p-4 border border-slate-100">
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
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-white flex gap-3 flex-shrink-0">
          <button 
            onClick={handleShare}
            className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
          >
            <Share2 className="w-6 h-6" />
          </button>
          <button 
            onClick={() => {
              addToShoppingList(deal);
              onClose();
            }}
            className="flex-1 h-14 rounded-2xl bg-[#0097b2] text-white font-black text-lg flex items-center justify-center gap-2 hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/30"
          >
            <ListPlus className="w-6 h-6" />
            Add to List
          </button>
        </div>
      </div>
    </div>
  );
}
