import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  fileHash?: string;
}

export default function UploadFlyer() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isDragging, setIsDragging] = useState(false);
  const isCancelledRef = useRef(false);

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsExtracting(false);
    setExtractionStatus('Extraction cancelled.');
  };

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
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'missing_price' | 'missing_name'>('all');

  const filteredExtractedDeals = useMemo(() => {
    return extractedDeals.filter(deal => {
      if (reviewFilter === 'missing_price') return !deal.price && (!deal.variants || deal.variants.length === 0);
      if (reviewFilter === 'missing_name') return !deal.name || deal.name.length < 3;
      return true;
    });
  }, [extractedDeals, reviewFilter]);

  const handleDealEdit = (id: string, field: keyof Deal, value: any) => {
    setExtractedDeals(prev => prev.map(d => d.product_id === id ? { ...d, [field]: value } : d));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const addDeals = useAppStore(state => state.addDeals);
  const isAdmin = useAppStore(state => state.isAdmin);
  const uploadedFlyers = useAppStore(state => state.uploadedFlyers);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

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
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []) as File[];
    
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  // Keep track of all created object URLs to clean them up on unmount
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const addFiles = async (newFiles: File[]) => {
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
    
    // Initialize synchronously to prevent mismatch
    const initialProgresses = newFiles.map(() => ({ status: 'pending' as FileStatus, message: 'Checking file...', progress: 0 }));
    setFileProgresses(prev => [...prev, ...initialProgresses]);

    const newProgresses = await Promise.all(newFiles.map(async (file) => {
      const isHeic = file.type.includes('heic') || 
                   file.type.includes('heif') || 
                   file.name.toLowerCase().endsWith('.heic') || 
                   file.name.toLowerCase().endsWith('.heif');
      const isValidImage = file.type.startsWith('image/') && !isHeic;
      
      if (!isValidImage) {
        return { status: 'skipped' as FileStatus, message: isHeic ? 'HEIC format not supported' : 'Not a valid image file', progress: 0 };
      }

      let fileHash = '';
      try {
        fileHash = await calculateFileHash(file);
        const isDuplicate = uploadedFlyers.some(f => f.fileHash === fileHash);
        
        if (isDuplicate) {
          return { status: 'skipped' as FileStatus, message: 'Duplicate flyer detected', progress: 0, fileHash };
        }
      } catch (e) {
        console.warn("Failed to calculate file hash", e);
      }

      return { status: 'pending' as FileStatus, message: 'Ready to process', progress: 0, fileHash };
    }));

    setFileProgresses(prev => {
      const next = [...prev];
      // Replace the newly added progresses with the resolved ones
      const startIndex = next.length - newProgresses.length;
      for (let i = 0; i < newProgresses.length; i++) {
        next[startIndex + i] = newProgresses[i];
      }
      return next;
    });
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
    isCancelledRef.current = false;
    setError(null);
    setExtractionProgress(0);
    setExtractionStatus('Initializing extraction...');
    
    setFileProgresses(prev => prev.map(p => 
      p.status === 'skipped' ? p : { ...p, status: 'pending', message: 'Waiting...', progress: 0 }
    ));
    
    let allNewDeals: Deal[] = [];
    let errorCount = 0;
    let skippedCount = 0;
    let completedCount = 0;

    const CHUNK_SIZE = 2;
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      if (isCancelledRef.current) break;
      
      const chunkIndices = [];
      for (let j = i; j < i + CHUNK_SIZE && j < files.length; j++) {
        chunkIndices.push(j);
      }

      const chunkResults = await Promise.all(chunkIndices.map(async (idx) => {
        try {
          if (isCancelledRef.current) return [];
          
          if (fileProgresses[idx].status === 'skipped') {
            skippedCount++;
            completedCount++;
            setExtractionProgress((completedCount / files.length) * 100);
            return;
          }

          const file = files[idx];
          
          const isHeic = file.type.includes('heic') || 
                       file.type.includes('heif') || 
                       file.name.toLowerCase().endsWith('.heic') || 
                       file.name.toLowerCase().endsWith('.heif');
          const isValidImage = file.type.startsWith('image/') && !isHeic;
          
          if (!isValidImage) {
            skippedCount++;
            setFileProgresses(prev => {
              const next = [...prev];
              next[idx] = { ...next[idx], status: 'skipped', message: isHeic ? 'HEIC format not supported' : 'Not a valid image file', progress: 0 };
              return next;
            });
            completedCount++;
            setExtractionProgress((completedCount / files.length) * 100);
            return;
          }
          
          setFileProgresses(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: 'processing', progress: 10, message: 'Preparing image...' };
            return next;
          });
          setExtractionStatus(`Processing flyers... (${completedCount + 1}/${files.length})`);
          
          const { base64String, thumbnail } = await new Promise<{base64String: string, thumbnail: string}>((resolve, reject) => {
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
              
              // Generate thumbnail
              const thumbCanvas = document.createElement('canvas');
              let thumbWidth = img.width;
              let thumbHeight = img.height;
              const THUMB_MAX = 300;
              if (thumbWidth > thumbHeight && thumbWidth > THUMB_MAX) {
                thumbHeight *= THUMB_MAX / thumbWidth;
                thumbWidth = THUMB_MAX;
              } else if (thumbHeight > THUMB_MAX) {
                thumbWidth *= THUMB_MAX / thumbHeight;
                thumbHeight = THUMB_MAX;
              }
              thumbCanvas.width = thumbWidth;
              thumbCanvas.height = thumbHeight;
              const thumbCtx = thumbCanvas.getContext('2d');
              if (thumbCtx) {
                thumbCtx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
              }
              const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.6);

              // Explicitly free memory
              canvas.width = 0;
              canvas.height = 0;
              thumbCanvas.width = 0;
              thumbCanvas.height = 0;
              img.src = '';

              resolve({ base64String: dataUrl.split(',')[1], thumbnail: thumbDataUrl });
            };
            
            img.onerror = () => {
              reject(new Error('Failed to load image for compression. It might be corrupted or inaccessible.'));
            };
            
            img.src = previews[idx];
          });

          setThumbnails(prev => {
            const next = [...prev];
            next[idx] = thumbnail;
            return next;
          });

          setFileProgresses(prev => {
            const next = [...prev];
            next[idx] = { status: 'processing', progress: 40, message: 'Analyzing deals with AI...' };
            return next;
          });

          // We converted it to jpeg during compression
          const mimeType = 'image/jpeg';
          let base64Data = base64String;
          const flyerData = await extractDealsFromFlyer(base64Data, mimeType);
          base64Data = ''; // Free memory
          
          setFileProgresses(prev => {
            const next = [...prev];
            next[idx] = { status: 'processing', progress: 80, message: 'Extracting product images...' };
            return next;
          });
          
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
                      const MAX_CROP_SIZE = 200;
                      let cropWidth = width;
                      let cropHeight = height;
                      if (cropWidth > MAX_CROP_SIZE || cropHeight > MAX_CROP_SIZE) {
                        if (cropWidth > cropHeight) {
                          cropHeight = (cropHeight / cropWidth) * MAX_CROP_SIZE;
                          cropWidth = MAX_CROP_SIZE;
                        } else {
                          cropWidth = (cropWidth / cropHeight) * MAX_CROP_SIZE;
                          cropHeight = MAX_CROP_SIZE;
                        }
                      }
                      canvas.width = cropWidth;
                      canvas.height = cropHeight;
                      ctx.drawImage(img, x, y, width, height, 0, 0, cropWidth, cropHeight);
                      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                      return { ...product, image_url: dataUrl };
                    }
                  }
                  return product;
                });
                
                // Explicitly free memory
                canvas.width = 0;
                canvas.height = 0;
                img.src = '';
                
                resolve(updatedProducts);
              };
              img.onerror = () => resolve(products);
              img.src = previews[idx];
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

            const generateProductId = (store: string, location: string, name: string, price: number | undefined, weight: string | undefined, brand: string | null | undefined) => {
              const str = `${store}-${location}-${name}-${price || ''}-${weight || ''}-${brand || ''}`.toLowerCase().replace(/\s+/g, '-');
              let hash = 0;
              for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
              }
              return `prod-${Math.abs(hash).toString(36)}`;
            };

            const storeName = safeString(flyerData.store, 'Unknown Store').replace(/["{}]/g, '');
            const locationName = safeString(flyerData.location, 'Unknown Location').replace(/["{}]/g, '');

            return {
              ...product,
              product_id: generateProductId(storeName, locationName, product.name, product.price, product.weight, product.brand),
              store: storeName,
              location: locationName,
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

          setFileProgresses(prev => {
            const next = [...prev];
            next[idx] = { status: 'success', progress: 100, message: `Found ${newDeals.length} deals` };
            return next;
          });
          completedCount++;
          setExtractionProgress((completedCount / files.length) * 100);

          return newDeals;
        } catch (err: any) {
          console.error(`Extraction error for file ${idx}:`, err);
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
            next[idx] = { status: 'error', message: errorMessage, progress: 0 };
            return next;
          });
          completedCount++;
          setExtractionProgress((completedCount / files.length) * 100);
          return [];
        }
      }));
      
      chunkResults.forEach(deals => {
        if (deals && deals.length > 0) {
          allNewDeals = [...allNewDeals, ...deals];
        }
      });
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

  const addUploadedFlyer = useAppStore(state => state.addUploadedFlyer);

  const handleAccept = async () => {
    const dealsToSave = extractedDeals.filter(d => selectedDeals.has(d.product_id));
    if (dealsToSave.length === 0) {
      setError("Please select at least one deal to save.");
      return;
    }
    
    setIsExtracting(true);
    setExtractionStatus('Saving deals...');
    
    // Allow UI to update before heavy synchronous operations
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      await addDeals(dealsToSave);
      
      // Add to history
      files.forEach((file, index) => {
        if (fileProgresses[index].status === 'success') {
          addUploadedFlyer({
            id: `flyer-${Date.now()}-${index}`,
            thumbnail: thumbnails[index] || previews[index],
            uploadDate: new Date().toISOString(),
            dealsExtracted: dealsToSave.length, // Total deals saved in this batch
            store: dealsToSave[0]?.store || 'Unknown Store',
            status: 'processed',
            fileHash: fileProgresses[index].fileHash
          });
        }
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error("Failed to save deals:", err);
      setError("Failed to save deals. Please try again.");
    } finally {
      setIsExtracting(false);
      setExtractionStatus('');
    }
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
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 sm:-mx-0 sm:px-0 border-b border-slate-100 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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

        {/* Batch Actions & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedDeals.size === filteredExtractedDeals.length && filteredExtractedDeals.length > 0}
              onChange={handleToggleAll}
              className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-bold text-slate-700">
              {selectedDeals.size} selected
            </span>
            {selectedDeals.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ml-2"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            <button
              onClick={() => setReviewFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                reviewFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Deals ({extractedDeals.length})
            </button>
            <button
              onClick={() => setReviewFilter('missing_price')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                reviewFilter === 'missing_price' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Missing Price
            </button>
            <button
              onClick={() => setReviewFilter('missing_name')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                reviewFilter === 'missing_name' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Missing Name
            </button>
          </div>
        </div>

        {/* Deals Grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          <AnimatePresence>
            {filteredExtractedDeals.map((deal, idx) => {
              const isMissingPrice = !deal.price && (!deal.variants || deal.variants.length === 0);
              const isMissingName = !deal.name || deal.name.length < 3;
              const hasWarning = isMissingPrice || isMissingName;

              return (
              <motion.div 
                key={`${deal.product_id}-${idx}`} 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`break-inside-avoid bg-white border rounded-3xl overflow-hidden transition-all duration-300 ${
                  selectedDeals.has(deal.product_id) ? 'border-emerald-500 ring-2 ring-emerald-500 shadow-lg -translate-y-1' : 'border-slate-200 opacity-90 hover:opacity-100 hover:shadow-md hover:-translate-y-1'
                }`}
              >
                <div className={`p-4 border-b flex justify-between items-center ${hasWarning ? 'bg-amber-50 border-amber-100' : 'bg-slate-50/50 border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedDeals.has(deal.product_id)}
                      onChange={() => handleToggleSelect(deal.product_id)}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    {hasWarning && (
                      <div className="flex items-center gap-1 text-amber-600" title="Missing important information">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">Review Needed</span>
                      </div>
                    )}
                  </div>
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
                  <div className="group/edit relative">
                    {editingDealId === deal.product_id ? (
                      <input 
                        type="text" 
                        value={deal.name} 
                        onChange={(e) => handleDealEdit(deal.product_id, 'name', e.target.value)}
                        className="w-full font-bold text-slate-900 font-display border-b-2 border-emerald-500 focus:outline-none bg-emerald-50 px-1 rounded-t"
                        autoFocus
                        onBlur={() => setEditingDealId(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingDealId(null)}
                      />
                    ) : (
                      <h3 
                        className={`font-bold text-slate-900 line-clamp-2 font-display cursor-pointer hover:text-emerald-600 ${isMissingName ? 'text-red-500' : ''}`} 
                        title={deal.name}
                        onClick={() => setEditingDealId(deal.product_id)}
                      >
                        {deal.name || 'Missing Product Name'}
                        <Edit2 className="w-3 h-3 inline-block ml-1 opacity-0 group-hover/edit:opacity-100 transition-opacity text-emerald-500" />
                      </h3>
                    )}
                    
                    {editingDealId === `${deal.product_id}-weight` ? (
                      <input 
                        type="text" 
                        value={deal.weight || ''} 
                        placeholder="Weight/Size"
                        onChange={(e) => handleDealEdit(deal.product_id, 'weight', e.target.value)}
                        className="w-full text-sm text-slate-700 mt-1 border-b-2 border-emerald-500 focus:outline-none bg-emerald-50 px-1 rounded-t"
                        autoFocus
                        onBlur={() => setEditingDealId(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingDealId(null)}
                      />
                    ) : (
                      <p 
                        className="text-sm text-slate-500 mt-1 font-medium cursor-pointer hover:text-emerald-600 group/weight"
                        onClick={() => setEditingDealId(`${deal.product_id}-weight`)}
                      >
                        {deal.weight || deal.brand || 'No weight specified'}
                        <Edit2 className="w-3 h-3 inline-block ml-1 opacity-0 group-hover/weight:opacity-100 transition-opacity text-emerald-500" />
                      </p>
                    )}

                    {deal.tags && deal.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
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
                  <div className="mt-auto pt-2 flex items-end justify-between group/price">
                    <div className="cursor-pointer" onClick={() => setEditingDealId(`${deal.product_id}-price`)}>
                      <span className="text-xs font-bold text-slate-400 uppercase">{deal.currency || 'FJD'}</span>
                      {editingDealId === `${deal.product_id}-price` ? (
                        <input 
                          type="number" 
                          step="0.01"
                          value={deal.price || ''} 
                          onChange={(e) => handleDealEdit(deal.product_id, 'price', parseFloat(e.target.value))}
                          className="w-20 text-2xl font-black text-emerald-600 ml-1 font-display tracking-tight border-b-2 border-emerald-500 focus:outline-none bg-emerald-50 px-1 rounded-t"
                          autoFocus
                          onBlur={() => setEditingDealId(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingDealId(null)}
                        />
                      ) : (
                        <span className={`text-2xl font-black ml-1 font-display tracking-tight hover:text-emerald-700 ${isMissingPrice ? 'text-red-500' : 'text-emerald-600'}`}>
                          {deal.price ? deal.price.toFixed(2) : (deal.variants?.[0]?.price?.toFixed(2) || 'N/A')}
                          <Edit2 className="w-4 h-4 inline-block ml-1 opacity-0 group-hover/price:opacity-100 transition-opacity text-emerald-500" />
                        </span>
                      )}
                    </div>
                    {deal.deal_type && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-lg uppercase tracking-wider">
                        {deal.deal_type}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
              );
            })}
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
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 ${
          isDragging 
            ? 'border-emerald-500 bg-emerald-50 scale-[1.02] shadow-lg' 
            : files.length > 0 
              ? 'border-emerald-400 bg-emerald-50/50' 
              : 'border-slate-200 hover:border-emerald-300 bg-white'
        } ${isOffline ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-8">
          <motion.div 
            animate={{ y: isDragging ? 10 : 0, scale: isDragging ? 1.1 : 1 }}
            className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${
              isDragging ? 'bg-emerald-100' : 'bg-emerald-50'
            }`}
          >
            {isOffline ? <WifiOff className="w-10 h-10 text-slate-400" /> : <Upload className={`w-10 h-10 transition-colors ${isDragging ? 'text-emerald-600' : 'text-emerald-500'}`} />}
          </motion.div>
          <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">
            {isOffline ? 'Offline Mode' : isDragging ? 'Drop flyers here!' : 'Drag and drop your flyers here'}
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
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isExtracting ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                {isExtracting ? (
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
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
              <div className="flex items-center gap-4">
                <span className="text-lg font-black text-emerald-600 font-display">{Math.round(extractionProgress)}%</span>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          
          {isExtracting && (
            <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
              <motion.div 
                className="bg-emerald-600 h-3 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${extractionProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          {/* Individual File Progress */}
          {fileProgresses.length > 0 && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {files.map((file, idx) => {
                const progress = fileProgresses[idx];
                if (!progress) return null;
                
                return (
                  <div key={idx} className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm aspect-[3/4] group">
                    <img 
                      src={previews[idx]} 
                      alt={`Flyer preview ${idx + 1}`} 
                      className={`w-full h-full object-cover transition-opacity ${progress.status === 'processing' ? 'opacity-50' : ''}`}
                    />
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[1px]">
                      {progress.status === 'pending' && <div className="w-10 h-10 rounded-full border-4 border-white/50 flex-shrink-0 shadow-sm" />}
                      {progress.status === 'processing' && (
                        <div className="relative w-12 h-12 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-white/30"
                              strokeWidth="4"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="text-emerald-500 transition-all duration-300"
                              strokeWidth="4"
                              strokeDasharray={`${progress.progress || 0}, 100`}
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <span className="absolute text-[10px] font-bold text-white shadow-sm">{Math.round(progress.progress || 0)}%</span>
                        </div>
                      )}
                      {progress.status === 'success' && <CheckCircle2 className="w-10 h-10 text-emerald-400 drop-shadow-md" />}
                      {progress.status === 'error' && <AlertCircle className="w-10 h-10 text-red-400 drop-shadow-md" />}
                      {progress.status === 'skipped' && <AlertCircle className="w-10 h-10 text-amber-400 drop-shadow-md" />}
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/90 to-transparent p-3 pt-6">
                        <p className="text-white text-xs font-bold truncate drop-shadow-sm">{file.name}</p>
                        <p className={`text-[10px] font-medium truncate drop-shadow-sm ${
                          progress.status === 'error' ? 'text-red-300' : 
                          progress.status === 'skipped' ? 'text-amber-300' : 'text-slate-200'
                        }`}>
                          {progress.message || (progress.status === 'pending' ? 'Waiting...' : '')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Skeleton Loaders */}
          {isExtracting && (
            <div className="mt-8">
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Analyzing Deals...</h4>
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="break-inside-avoid bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm animate-pulse">
                    <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                      <div className="w-5 h-5 bg-slate-200 rounded"></div>
                      <div className="w-16 h-3 bg-slate-200 rounded"></div>
                    </div>
                    <div className="p-5 flex flex-col gap-4">
                      <div className="h-40 bg-slate-100 rounded-2xl"></div>
                      <div>
                        <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-5 bg-slate-200 rounded w-1/2"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/3 mt-3"></div>
                      </div>
                      <div className="mt-auto pt-4 flex items-end justify-between">
                        <div className="w-24 h-8 bg-slate-200 rounded"></div>
                        <div className="w-16 h-6 bg-slate-100 rounded-lg"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
          className={`bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-8 rounded-xl flex items-center gap-2 transition-colors shadow-sm hover:shadow-md ${
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
