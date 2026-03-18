import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileImage, Loader2, CheckCircle2, AlertCircle, Trash2, Edit2, Check, X, Image as ImageIcon } from 'lucide-react';
import { extractDealsFromFlyer } from '../services/geminiService';
import { useAppStore } from '../store';
import { Deal, Product } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function UploadFlyer() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Preview state
  const [extractedDeals, setExtractedDeals] = useState<Deal[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const addDeals = useAppStore(state => state.addDeals);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files || []) as File[];
    const imageFiles = droppedFiles.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      addFiles(imageFiles);
    } else {
      setError('Please drop valid image files.');
    }
  };

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
    setError(null);
    setSuccess(false);
    setShowPreview(false);
    setExtractedDeals([]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtract = async () => {
    if (files.length === 0) return;

    setIsExtracting(true);
    setError(null);
    setExtractionProgress(0);
    setExtractionStatus('Initializing extraction...');
    
    let allNewDeals: Deal[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setExtractionStatus(`Processing flyer ${i + 1} of ${files.length}...`);
        
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const flyerData = await extractDealsFromFlyer(base64String, file.type);
        
        setExtractionStatus(`Extracting images for flyer ${i + 1}...`);
        
        // Process images based on bounding boxes
        const processImages = async (products: Product[]): Promise<Product[]> => {
          if (!products || !Array.isArray(products)) {
            return [];
          }
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(products);
                return;
              }

              const updatedProducts = products.map(product => {
                if (product.bounding_box && product.bounding_box.length === 4) {
                  const [ymin, xmin, ymax, xmax] = product.bounding_box;
                  
                  const y = (ymin / 1000) * img.height;
                  const x = (xmin / 1000) * img.width;
                  const height = ((ymax - ymin) / 1000) * img.height;
                  const width = ((xmax - xmin) / 1000) * img.width;

                  if (width > 0 && height > 0) {
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    return { ...product, image_url: dataUrl };
                  }
                }
                return product;
              });
              resolve(updatedProducts);
            };
            img.onerror = () => resolve(products);
            img.src = `data:${file.type};base64,${base64String}`;
          });
        };

        const productsWithImages = await processImages(flyerData.products);

        // Map products to deals
        const newDeals: Deal[] = productsWithImages.map(product => ({
          ...product,
          store: flyerData.store,
          location: flyerData.location,
          start_date: flyerData.promotion_period?.start_date || new Date().toISOString(),
          end_date: flyerData.promotion_period?.end_date || new Date().toISOString(),
          terms_and_conditions: flyerData.terms_and_conditions,
          store_hours: flyerData.store_hours,
          traffic_status: flyerData.traffic_status,
        }));

        allNewDeals = [...allNewDeals, ...newDeals];
        setExtractionProgress(((i + 1) / files.length) * 100);
      }

      setExtractedDeals(allNewDeals);
      setSelectedDeals(new Set(allNewDeals.map(d => d.product_id)));
      setShowPreview(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to extract deals. Please try again.');
    } finally {
      setIsExtracting(false);
      setExtractionStatus('');
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedDeals);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDeals(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedDeals.size === extractedDeals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(extractedDeals.map(d => d.product_id)));
    }
  };

  const handleDeleteSelected = () => {
    setExtractedDeals(extractedDeals.filter(d => !selectedDeals.has(d.product_id)));
    setSelectedDeals(new Set());
  };

  const handleAccept = () => {
    const dealsToSave = extractedDeals.filter(d => selectedDeals.has(d.product_id));
    if (dealsToSave.length === 0) {
      setError("Please select at least one deal to save.");
      return;
    }
    addDeals(dealsToSave);
    setSuccess(true);
    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  const handleDecline = () => {
    setFiles([]);
    setPreviews([]);
    setExtractedDeals([]);
    setShowPreview(false);
    setSelectedDeals(new Set());
  };

  if (showPreview) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Review Extracted Deals</h1>
            <p className="text-slate-500 mt-1">
              Review the {extractedDeals.length} deals extracted from {files.length} flyer{files.length > 1 ? 's' : ''}. Select the ones you want to keep.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
            >
              Discard All
            </button>
            <button
              onClick={handleAccept}
              disabled={selectedDeals.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              Save {selectedDeals.size} Deals
            </button>
          </div>
        </div>

        {/* Flyer Metadata Summary */}
        {extractedDeals.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Stores & Locations</p>
              <p className="font-medium text-slate-900">
                {Array.from(new Set(extractedDeals.map(d => `${d.store} - ${d.location}`))).join(', ')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Validity Period</p>
              <p className="font-medium text-slate-900">
                {new Date(extractedDeals[0].start_date).toLocaleDateString()} to {new Date(extractedDeals[0].end_date).toLocaleDateString()}
              </p>
            </div>
            {extractedDeals[0].terms_and_conditions && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Terms & Conditions</p>
                <p className="font-medium text-slate-900 text-sm line-clamp-2" title={extractedDeals[0].terms_and_conditions}>
                  {extractedDeals[0].terms_and_conditions}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Batch Actions */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedDeals.size === extractedDeals.length && extractedDeals.length > 0}
              onChange={handleToggleAll}
              className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-slate-700">
              {selectedDeals.size} selected
            </span>
          </div>
          {selectedDeals.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Remove Selected
            </button>
          )}
        </div>

        {/* Deals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {extractedDeals.map((deal) => (
              <motion.div 
                key={deal.product_id} 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                  selectedDeals.has(deal.product_id) ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md' : 'border-slate-200 opacity-70'
                }`}
              >
                <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={selectedDeals.has(deal.product_id)}
                    onChange={() => handleToggleSelect(deal.product_id)}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{deal.category}</span>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  {deal.image_url ? (
                    <div className="h-32 bg-slate-50 rounded-xl flex items-center justify-center p-2">
                      <img src={deal.image_url} alt={deal.name} className="max-h-full object-contain mix-blend-multiply" />
                    </div>
                  ) : (
                    <div className="h-32 bg-slate-100 rounded-xl flex items-center justify-center">
                      <FileImage className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-900 line-clamp-2" title={deal.name}>{deal.name}</h3>
                    <p className="text-sm text-slate-500">{deal.weight || deal.brand || 'No weight specified'}</p>
                  </div>
                  <div className="mt-auto pt-2 flex items-end justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">{deal.currency || 'FJD'}</span>
                      <span className="text-xl font-black text-emerald-600 ml-1">
                        {deal.price ? deal.price.toFixed(2) : (deal.variants?.[0]?.price?.toFixed(2) || 'N/A')}
                      </span>
                    </div>
                    {deal.deal_type && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md uppercase">
                        {deal.deal_type}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">Deals saved successfully! Redirecting...</p>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Upload Flyers</h1>
        <p className="text-slate-500 mt-2">
          Upload photos of supermarket flyers. Our AI will automatically extract the deals, normalize prices, and add them to your database. You can upload multiple flyers at once.
        </p>
      </div>

      <div 
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-colors ${
          files.length > 0 ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-300 hover:border-slate-400 bg-white'
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Drag and drop your flyers here</h3>
          <p className="text-slate-500 mb-6 max-w-sm">
            Supports JPG, PNG, and WebP. Make sure the text and prices are clearly visible.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-white border border-slate-200 text-slate-700 font-medium py-2.5 px-6 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Browse Files
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
          />
        </div>

        {/* Previews Grid */}
        {previews.length > 0 && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-left">
            <AnimatePresence>
              {previews.map((preview, index) => (
                <motion.div 
                  key={preview}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm aspect-[3/4]"
                >
                  <img 
                    src={preview} 
                    alt={`Flyer preview ${index + 1}`} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-white text-xs font-medium truncate">
                      {files[index].name}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {isExtracting && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              <h3 className="font-bold text-slate-900">Processing Flyers</h3>
            </div>
            <span className="text-sm font-bold text-emerald-600">{Math.round(extractionProgress)}%</span>
          </div>
          
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden">
            <motion.div 
              className="bg-emerald-600 h-2.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${extractionProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-sm text-slate-500">{extractionStatus}</p>
        </div>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleExtract}
          disabled={files.length === 0 || isExtracting}
          className={`bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-colors ${
            (files.length === 0 || isExtracting) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Extracting Deals...
            </>
          ) : (
            <>
              <ImageIcon className="w-5 h-5" />
              Extract {files.length > 0 ? `${files.length} ` : ''}Flyer{files.length !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
