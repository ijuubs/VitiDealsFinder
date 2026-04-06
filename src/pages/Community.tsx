import React, { useState } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, AlertTriangle, Clock, MapPin, Search, Filter } from 'lucide-react';
import { useAppStore } from '../store';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

export default function Community() {
  const deals = useAppStore(state => state.deals);
  const [filter, setFilter] = useState<'all' | 'verified' | 'out_of_stock'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock community feed data based on deals
  const feedItems = deals.slice(0, 15).map((deal, index) => {
    const isVerified = index % 3 === 0;
    const isOutOfStock = index % 5 === 0;
    const timestamp = new Date(Date.now() - Math.random() * 86400000 * 2); // Random time within last 2 days
    
    return {
      id: `feed-${deal.product_id}-${index}`,
      deal,
      user: `User${Math.floor(Math.random() * 1000)}`,
      action: isOutOfStock ? 'reported out of stock' : isVerified ? 'verified in stock' : 'commented on',
      type: isOutOfStock ? 'out_of_stock' : isVerified ? 'verified' : 'comment',
      timestamp,
      comment: isOutOfStock ? 'Shelves are completely empty here.' : isVerified ? 'Plenty left as of this morning!' : 'Great deal, just picked some up.',
      likes: Math.floor(Math.random() * 20)
    };
  }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const filteredFeed = feedItems.filter(item => {
    if (filter === 'verified' && item.type !== 'verified') return false;
    if (filter === 'out_of_stock' && item.type !== 'out_of_stock') return false;
    if (searchQuery && !item.deal.name.toLowerCase().includes(searchQuery.toLowerCase()) && !item.deal.store.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 font-display">Community Feed</h1>
          <p className="text-slate-500 mt-2 font-medium">
            Live updates and stock verification from shoppers across Fiji.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search updates by product or store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 text-slate-900 font-medium placeholder:text-slate-400"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 sm:pb-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            All Updates
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${filter === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            <ThumbsUp className="w-4 h-4" /> Verified
          </button>
          <button
            onClick={() => setFilter('out_of_stock')}
            className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${filter === 'out_of_stock' ? 'bg-red-100 text-red-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            <AlertTriangle className="w-4 h-4" /> Out of Stock
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredFeed.length > 0 ? (
          filteredFeed.map(item => (
            <div key={item.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 font-bold text-slate-500">
                  {item.user.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm text-slate-600">
                      <span className="font-bold text-slate-900">{item.user}</span> {item.action}
                    </p>
                    <span className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap ml-2">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  
                  <Link to={`/search?q=${encodeURIComponent(item.deal.name)}`} className="block mt-2 mb-3 bg-slate-50 rounded-2xl p-3 border border-slate-100 hover:border-emerald-200 transition-colors group">
                    <div className="flex items-center gap-3">
                      {item.deal.image_url ? (
                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center p-1 flex-shrink-0">
                          <img src={item.deal.image_url} alt={item.deal.name} className="max-w-full max-h-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-slate-300">No Img</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">{item.deal.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="font-bold text-emerald-600">${item.deal.price?.toFixed(2)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" /> {item.deal.store} {item.deal.location && `- ${item.deal.location}`}</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {item.comment && (
                    <p className="text-slate-700 text-sm bg-slate-50/50 p-3 rounded-xl border border-slate-100/50 italic">
                      "{item.comment}"
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-4">
                    <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors">
                      <ThumbsUp className="w-4 h-4" /> {item.likes} Helpful
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
                      <MessageSquare className="w-4 h-4" /> Reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">No updates found</h3>
            <p className="text-slate-500">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
