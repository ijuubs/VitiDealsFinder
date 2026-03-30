import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileImage, Loader2, CheckCircle2, AlertCircle, Trash2, Edit2, Check, X, Image as ImageIcon, WifiOff, Clock } from 'lucide-react';
import { extractDealsFromFlyer } from '../services/geminiService';
import { useAppStore } from '../store';
import { Deal, Product } from '../types';
import { motion, AnimatePresence } from 'motion/react';

type FileStatus = 'pending' | 'processing' | 'success' | 'error' | 'skipped';
interface FileProgress {
  status: FileStatus;
  message?: string;
  progress?: number;
}

export default function UploadFlyer() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
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
    
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files || []) as File[];
    
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  // Keep track of all created object URLs to clean them up on unmount
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    const newPreviews = newFiles.map(file => {
      const isHeic = file.type.includes('heic') || 
                   file.type.includes('heif') || 
                   file.name.toLowerCase().endsWith('.heic') || 
                   file.name.toLowerCase().endsWith('.heif');
      const isValidImage = file.type.startsWith('image/') && !isHeic;
      
      if (!isValidImage) return '';
      
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      return url;
    });
    setPreviews(prev => [...prev, ...newPreviews]);
    setFileProgresses(prev => [...prev, ...newFiles.map(file => {
      const isHeic = file.type.includes('heic') || 
                   file.type.includes('heif') || 
                   file.name.toLowerCase().endsWith('.heic') || 
                   file.name.toLowerCase().endsWith('.heif');
      const isValidImage = file.type.startsWith('image/') && !isHeic;
      
      if (!isValidImage) {
        return { status: 'skipped' as FileStatus, message: isHeic ? 'HEIC format not supported' : 'Not a valid image file', progress: 0 };
      }
      return { status: 'pending' as FileStatus, message: 'Ready to process', progress: 0 };
    })]);
    setError(null);
    setSuccess(false);
    setShowPreview(false);
    setExtractedDeals([]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const urlToRevoke = prev[index];
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
        objectUrlsRef.current.delete(urlToRevoke);
      }
      return prev.filter((_, i) => i !== index);
    });
    setFileProgresses(prev => prev.filter((_, i) => i !== index));
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleExtract = async () => {
    if (files.length === 0) return;

    setIsExtracting(true);
    setError(null);
    setExtractionProgress(0);
    setExtractionStatus('Initializing extraction...');
    
    setFileProgresses(files.map(() => ({ status: 'pending', message: 'Waiting...', progress: 0 })));
    
    let allNewDeals: Deal[] = [];
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        const baseProgress = (i / files.length) * 100;
        const fileProgressStep = 100 / files.length;
        
        const isHeic = file.type.includes('heic') || 
                     file.type.includes('heif') || 
                     file.name.toLowerCase().endsWith('.heic') || 
                     file.name.toLowerCase().endsWith('.heif');
        const isValidImage = file.type.startsWith('image/') && !isHeic;
        
        if (!isValidImage) {
          skippedCount++;
          setFileProgresses(prev => {
            const next = [...prev];
            next[i] = { status: 'skipped', message: isHeic ? 'HEIC format not supported' : 'Not a valid image file', progress: 0 };
            return next;
          });
          setExtractionProgress(((i + 1) / files.length) * 100);
          continue;
        }
        
        setFileProgresses(prev => {
          const next = [...prev];
          next[i] = { status: 'processing', progress: 10, message: 'Preparing image...' };
          return next;
        });
        setExtractionStatus(`Preparing flyer ${i + 1} of ${files.length}...`);
        setExtractionProgress(baseProgress + (fileProgressStep * 0.1)); // 10% of this file
        
        const base64String = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Max dimension for Gemini is typically 3072, let's use 1536 to be safe and fast
            const MAX_DIMENSION = 1536;
            if (width > height && width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            } else if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress as JPEG with 0.8 quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl.split(',')[1]);
          };
          
          img.onerror = () => {
            reject(new Error('Failed to load image for compression. It might be corrupted or inaccessible.'));
          };
          
          img.src = previews[i];
        });

        setFileProgresses(prev => {
          const next = [...prev];
          next[i] = { status: 'processing', progress: 40, message: 'Analyzing deals with AI...' };
          return next;
        });
        setExtractionStatus(`Analyzing deals with AI for flyer ${i + 1}...`);
        setExtractionProgress(baseProgress + (fileProgressStep * 0.3)); // 30% of this file

        // We converted it to jpeg during compression
        const mimeType = 'image/jpeg';
        const flyerData = await extractDealsFromFlyer(base64String, mimeType);
        
        setFileProgresses(prev => {
          const next = [...prev];
          next[i] = { status: 'processing', progress: 80, message: 'Extracting product images...' };
          return next;
        });
        setExtractionStatus(`Extracting product images for flyer ${i + 1}...`);
        setExtractionProgress(baseProgress + (fileProgressStep * 0.8)); // 80% of this file
        
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
                  
                  const y = (Math.min(ymin, ymax) / 1000) * img.height;
                  const x = (Math.min(xmin, xmax) / 1000) * img.width;
                  const height = (Math.abs(ymax - ymin) / 1000) * img.height;
                  const width = (Math.abs(xmax - xmin) / 1000) * img.width;

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
            img.src = `data:image/jpeg;base64,${base64String}`;
          });
        };

        const productsWithImages = await processImages(flyerData.products);

        // Map products to deals
        const newDeals: Deal[] = productsWithImages.map(product => {
          const defaultStartDate = new Date();
          const defaultEndDate = new Date();
          defaultEndDate.setDate(defaultEndDate.getDate() + 7);

          const safeString = (val: any, fallback: string) => {
            if (!val) return fallback;
            if (typeof val === 'string') return val;
            if (Array.isArray(val)) return val.join(', ');
            try {
              return JSON.stringify(val);
            } catch (e) {
              return fallback;
            }
          };

          return {
            ...product,
            product_id: `flyer-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`,
            store: safeString(flyerData.store, 'Unknown Store').replace(/["{}]/g, ''),
            location: safeString(flyerData.location, 'Unknown Location').replace(/["{}]/g, ''),
            start_date: (() => {
              const d = new Date(flyerData.promotion_period?.start_date || '');
              return isNaN(d.getTime()) ? defaultStartDate.toISOString() : d.toISOString();
            })(),
            end_date: (() => {
              const d = new Date(flyerData.promotion_period?.end_date || '');
              // If invalid date or date is in the past, use default (7 days from now)
              if (isNaN(d.getTime()) || d.getTime() < Date.now()) {
                return defaultEndDate.toISOString();
              }
              return d.toISOString();
            })(),
            terms_and_conditions: flyerData.terms_and_conditions,
            store_hours: flyerData.store_hours,
            traffic_status: flyerData.traffic_status,
            uploaded_at: Date.now(),
          };
        });

        allNewDeals = [...allNewDeals, ...newDeals];
        
        setFileProgresses(prev => {
          const next = [...prev];
          next[i] = { status: 'success', progress: 100, message: `Found ${newDeals.length} deals` };
          return next;
        });
        setExtractionProgress(((i + 1) / files.length) * 100);
      } catch (err: any) {
        console.error(`Extraction error for file ${i}:`, err);
        errorCount++;
        
        let errorMessage = "An unknown error occurred";
        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (err && typeof err === 'object') {
          if (err.type === 'error' || err.toString() === '[object ProgressEvent]') {
            errorMessage = "Network error. Please check your internet connection.";
          } else {
            try {
              errorMessage = JSON.stringify(err);
            } catch (e) {
              errorMessage = String(err);
            }
          }
        } else {
          errorMessage = String(err);
        }

        if (errorMessage.includes('parse response') || errorMessage.includes('No response') || errorMessage.includes('JSON')) {
          errorMessage = "AI couldn't understand this flyer.";
        } else if (errorMessage.includes('timed out')) {
          errorMessage = "Extraction took too long.";
        } else if (errorMessage.includes('Network error') || errorMessage.includes('fetch')) {
          errorMessage = "Network error.";
        }

        setFileProgresses(prev => {
          const next = [...prev];
          next[i] = { status: 'error', message: errorMessage, progress: 0 };
          return next;
        });
      }
    }

    setIsExtracting(false);
    setExtractionStatus('');

    if (allNewDeals.length > 0) {
      setExtractedDeals(allNewDeals);
      setSelectedDeals(new Set(allNewDeals.map(d => d.product_id)));
      setShowPreview(true);
      if (errorCount > 0 || skippedCount > 0) {
        let msg = "Some flyers failed to process.";
        if (errorCount > 0 && skippedCount > 0) {
          msg = `${errorCount} flyer(s) failed and ${skippedCount} were skipped.`;
        } else if (errorCount > 0) {
          msg = `${errorCount} flyer(s) failed to process.`;
        } else if (skippedCount > 0) {
          msg = `${skippedCount} flyer(s) were skipped.`;
        }
        setError(`${msg} Check the list below for details.`);
      }
    } else {
      setError("Failed to extract any deals from the uploaded flyers. Please check the errors and try again.");
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
    previews.forEach(url => {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    });
    setPreviews([]);
    setFileProgresses([]);
    setExtractedDeals([]);
    setShowPreview(false);
    setSelectedDeals(new Set());
  };

  if (showPreview) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 pb-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 font-display">Review Extracted Deals</h1>
            <p className="text-slate-500 mt-2 font-medium">
              Review the {extractedDeals.length} deals extracted from {files.length} flyer{files.length > 1 ? 's' : ''}. Select the ones you want to keep.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
            >
              Discard All
            </button>
            <button
              onClick={handleAccept}
              disabled={selectedDeals.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm hover:shadow-md"
            >
              <Check className="w-5 h-5" />
              Save {selectedDeals.size} Deals
            </button>
          </div>
        </div>

        {/* Flyer Metadata Summary */}
        {extractedDeals.length > 0 && (
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1.5">Stores & Locations</p>
              <p className="font-bold text-slate-900">
                {Array.from(new Set(extractedDeals.map(d => `${d.store}${d.location && d.location !== 'Unknown Location' ? ` - ${d.location}` : ''}`))).join(', ')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1.5">Validity Period</p>
              <p className="font-bold text-slate-900">
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

        {/* Processing Summary */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 font-display">Processing Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {files.map((file, idx) => {
              const progress = fileProgresses[idx];
              if (!progress) return null;
              
              return (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {progress.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                  {progress.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                  {progress.status === 'skipped' && <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
                  {progress.status === 'pending' && <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                  
                  <div className="truncate">
                    <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                    <p className={`text-xs font-medium truncate ${
                      progress.status === 'error' ? 'text-red-500' : 
                      progress.status === 'skipped' ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {progress.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Batch Actions */}
        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedDeals.size === extractedDeals.length && extractedDeals.length > 0}
              onChange={handleToggleAll}
              className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-bold text-slate-700">
              {selectedDeals.size} selected
            </span>
          </div>
          {selectedDeals.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remove Selected
            </button>
          )}
        </div>

        {/* Deals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {extractedDeals.map((deal, idx) => (
              <motion.div 
                key={`${deal.product_id}-${idx}`} 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bg-white border rounded-3xl overflow-hidden transition-all ${
                  selectedDeals.has(deal.product_id) ? 'border-emerald-500 ring-2 ring-emerald-500 shadow-md' : 'border-slate-100 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={selectedDeals.has(deal.product_id)}
                    onChange={() => handleToggleSelect(deal.product_id)}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{deal.category}</span>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  {deal.image_url ? (
                    <div className="h-40 bg-slate-50 rounded-2xl flex items-center justify-center p-2 border border-slate-100">
                      <img src={deal.image_url} alt={deal.name} className="max-h-full object-contain mix-blend-multiply" />
                    </div>
                  ) : (
                    <div className="h-40 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                      <FileImage className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-900 line-clamp-2 font-display" title={deal.name}>{deal.name}</h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium">{deal.weight || deal.brand || 'No weight specified'}</p>
                    {deal.tags && deal.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {deal.tags.map((tag, idx) => {
                          let colorClass = "bg-slate-50 text-slate-700 border-slate-200";
                          const lowerTag = tag.toLowerCase();
                          if (lowerTag.includes('halal')) colorClass = "bg-blue-50 text-blue-700 border-blue-200";
                          else if (lowerTag.includes('veg') || lowerTag.includes('plant')) colorClass = "bg-green-50 text-green-700 border-green-200";
                          else if (lowerTag.includes('sugar')) colorClass = "bg-red-50 text-red-700 border-red-200";
                          else if (lowerTag.includes('free')) colorClass = "bg-purple-50 text-purple-700 border-purple-200";
                          
                          return (
                            <span key={idx} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${colorClass}`}>
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-2 flex items-end justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">{deal.currency || 'FJD'}</span>
                      <span className="text-2xl font-black text-emerald-600 ml-1 font-display tracking-tight">
                        {deal.price ? deal.price.toFixed(2) : (deal.variants?.[0]?.price?.toFixed(2) || 'N/A')}
                      </span>
                    </div>
                    {deal.deal_type && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-lg uppercase tracking-wider">
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
      className="space-y-8 pb-6"
    >
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 font-display">Upload Flyers</h1>
        <p className="text-slate-500 mt-2 font-medium">
          Upload photos of supermarket flyers. Our AI will automatically extract the deals, normalize prices, and add them to your database. You can upload multiple flyers at once.
        </p>
      </div>

      <div 
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-colors ${
          files.length > 0 ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 bg-white'
        } ${isOffline ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
            {isOffline ? <WifiOff className="w-10 h-10 text-slate-400" /> : <Upload className="w-10 h-10 text-indigo-500" />}
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">
            {isOffline ? 'Offline Mode' : 'Drag and drop your flyers here'}
          </h3>
          <p className="text-slate-500 mb-8 max-w-sm font-medium">
            {isOffline 
              ? 'You cannot upload flyers while offline. Please connect to the internet to use this feature.' 
              : 'Supports JPG, PNG, and WebP. Make sure the text and prices are clearly visible.'}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isOffline}
            className={`bg-white border border-slate-200 text-slate-700 font-bold py-3 px-8 rounded-xl transition-colors shadow-sm hover:shadow-md ${
              isOffline ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 hover:border-slate-300'
            }`}
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
                  key={`${index}-${preview ? 'valid' : 'invalid'}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm aspect-[3/4]"
                >
                  <img 
                    src={preview} 
                    alt={`Flyer preview ${index + 1}`} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/80 to-transparent p-3">
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

      {(isExtracting || fileProgresses.some(p => p.status !== 'pending')) && (
        <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isExtracting ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                {isExtracting ? (
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                ) : (
                  <FileImage className="w-6 h-6 text-slate-600" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 font-display text-lg">
                  {isExtracting ? 'Processing Flyers' : 'Processing Complete'}
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {isExtracting ? extractionStatus : 'Review the status of your uploaded flyers below.'}
                </p>
              </div>
            </div>
            {isExtracting && (
              <span className="text-lg font-black text-indigo-600 font-display">{Math.round(extractionProgress)}%</span>
            )}
          </div>
          
          {isExtracting && (
            <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
              <motion.div 
                className="bg-indigo-600 h-3 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${extractionProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          {/* Individual File Progress */}
          {fileProgresses.length > 0 && (
            <div className="mt-6 space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {files.map((file, idx) => {
                const progress = fileProgresses[idx];
                if (!progress) return null;
                
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {progress.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />}
                      {progress.status === 'processing' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />}
                      {progress.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                      {progress.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                      {progress.status === 'skipped' && <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
                      
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                        <p className={`text-xs font-medium truncate ${
                          progress.status === 'error' ? 'text-red-500' : 
                          progress.status === 'skipped' ? 'text-amber-600' : 'text-slate-500'
                        }`}>
                          {progress.message || (progress.status === 'pending' ? 'Waiting...' : '')}
                        </p>
                      </div>
                    </div>
                    
                    {progress.status === 'processing' && progress.progress !== undefined && (
                      <span className="text-xs font-bold text-indigo-600 ml-4">{Math.round(progress.progress)}%</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-100 text-red-700 p-5 rounded-2xl flex items-start gap-3 shadow-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <p className="text-sm font-medium leading-relaxed">{error}</p>
        </motion.div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={handleExtract}
          disabled={files.length === 0 || isExtracting || isOffline}
          className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-8 rounded-xl flex items-center gap-2 transition-colors shadow-sm hover:shadow-md ${
            (files.length === 0 || isExtracting || isOffline) ? 'opacity-50 cursor-not-allowed hover:shadow-sm' : ''
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
