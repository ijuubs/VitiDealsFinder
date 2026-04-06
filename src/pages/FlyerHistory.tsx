import React, { useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { FileImage, Calendar, Tag, ArrowLeft, TrendingUp, Store, ListTodo } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function FlyerHistory() {
  const uploadedFlyers = useAppStore(state => state.uploadedFlyers);
  const deals = useAppStore(state => state.deals);
  const isAdmin = useAppStore(state => state.isAdmin);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const analytics = useMemo(() => {
    const now = new Date();
    const activeDeals = deals.filter(d => new Date(d.end_date) >= now).length;
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const flyersThisWeek = uploadedFlyers.filter(f => new Date(f.uploadDate) >= oneWeekAgo).length;

    const storeCounts = deals.reduce((acc, deal) => {
      acc[deal.store] = (acc[deal.store] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let topStore = 'N/A';
    let maxCount = 0;
    for (const [store, count] of Object.entries(storeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topStore = store;
      }
    }

    return { activeDeals, flyersThisWeek, topStore };
  }, [deals, uploadedFlyers]);

  return (
    <div className="pb-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/savings" className="p-2 bg-white rounded-full shadow-sm text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 font-display">Flyer History</h1>
          <p className="text-slate-500 mt-1 font-medium">View your previously uploaded and processed flyers.</p>
        </div>
      </div>

      {/* Analytics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Tag className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Deals Active</p>
            <p className="text-2xl font-black text-slate-900 font-display">{analytics.activeDeals}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Flyers This Week</p>
            <p className="text-2xl font-black text-slate-900 font-display">{analytics.flyersThisWeek}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Store className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Top Store</p>
            <p className="text-xl font-black text-slate-900 font-display truncate max-w-[150px]">{analytics.topStore}</p>
          </div>
        </div>
      </div>

      {uploadedFlyers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center">
          <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center mb-6 relative">
            <ListTodo className="w-16 h-16 text-emerald-500" />
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-sm">
              <FileImage className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-3 font-display">No flyers processed yet</h3>
          <p className="text-slate-500 mb-8 max-w-md mx-auto font-medium text-lg">
            Upload your first supermarket flyer to let our AI extract the best deals and populate your database.
          </p>
          <Link 
            to="/upload" 
            className="inline-flex items-center justify-center px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all hover:shadow-lg hover:-translate-y-1"
          >
            Upload Your First Flyer
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {uploadedFlyers.map((flyer) => (
            <div key={flyer.id} className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-[3/4] relative bg-slate-100">
                {flyer.thumbnail ? (
                  <img 
                    src={flyer.thumbnail} 
                    alt={`Flyer from ${flyer.store}`} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileImage className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-700 shadow-sm">
                  {flyer.status === 'processed' ? 'Processed' : 'Failed'}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-slate-900 mb-3 truncate">{flyer.store}</h3>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(flyer.uploadDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Tag className="w-4 h-4" />
                    <span>{flyer.dealsExtracted} deals extracted</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
