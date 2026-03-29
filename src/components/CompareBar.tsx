import React, { useState } from 'react';
import { useAppStore } from '../store';
import { X, ArrowRightLeft } from 'lucide-react';
import CompareListModal from './CompareListModal';

export default function CompareBar() {
  const { compareList, removeFromCompareList, clearCompareList } = useAppStore();
  const [showModal, setShowModal] = useState(false);

  if (compareList.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-slate-900 text-white rounded-2xl shadow-2xl z-40 overflow-hidden border border-slate-700">
        <div className="p-3 flex items-center justify-between bg-slate-800">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {compareList.length}/4
            </div>
            <span className="text-sm font-medium">Items to compare</span>
          </div>
          <button 
            onClick={clearCompareList}
            className="text-slate-400 hover:text-white text-xs font-medium transition-colors"
          >
            Clear All
          </button>
        </div>
        
        <div className="p-3 flex items-center gap-3 overflow-x-auto">
          {compareList.map(deal => (
            <div key={deal.product_id} className="relative flex-shrink-0 w-16 h-16 bg-white rounded-lg p-1">
              <button 
                onClick={() => removeFromCompareList(deal.product_id)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 z-10"
              >
                <X className="w-3 h-3" />
              </button>
              {deal.image_url ? (
                <img src={deal.image_url} alt={deal.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[8px] text-slate-400 text-center rounded">No Img</div>
              )}
            </div>
          ))}
          
          {compareList.length < 4 && (
            <div className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center text-slate-500">
              <span className="text-2xl">+</span>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-800 border-t border-slate-700">
          <button
            onClick={() => setShowModal(true)}
            disabled={compareList.length < 2}
            className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
              compareList.length >= 2 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            {compareList.length < 2 ? 'Select at least 2 items' : 'Compare Now'}
          </button>
        </div>
      </div>

      {showModal && <CompareListModal onClose={() => setShowModal(false)} />}
    </>
  );
}
