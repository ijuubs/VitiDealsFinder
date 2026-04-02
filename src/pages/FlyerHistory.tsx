import React, { useEffect } from 'react';
import { useAppStore } from '../store';
import { FileImage, Calendar, Tag, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function FlyerHistory() {
  const uploadedFlyers = useAppStore(state => state.uploadedFlyers);
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

  return (
    <div className="pb-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/savings" className="p-2 bg-white rounded-full shadow-sm text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 font-display">Flyer History</h1>
          <p className="text-slate-500 mt-1 font-medium">View your previously uploaded and processed flyers.</p>
        </div>
      </div>

      {uploadedFlyers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileImage className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No flyers yet</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            You haven't uploaded any flyers yet. Upload a flyer to extract deals and save them to your list.
          </p>
          <Link 
            to="/upload" 
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Upload Flyer
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
