import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Deal, ListItem, UploadedFlyer } from './types';
import { initialDeals } from './data/initialDeals';
import { supabase } from './lib/supabase';

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface AppState {
  user: any | null;
  isAdmin: boolean;
  deals: Deal[];
  shoppingList: ListItem[];
  pendingOfflineDeals: Deal[];
  userLocation: { lat: number, lon: number } | null;
  selectedRegion: string;
  savingsHistory: { amount: number, date: string }[];
  monthlyGoal: number;
  weeklyBudget: number;
  transportMode: 'driving' | 'walking' | 'bus';
  priceAlerts: { productId: string, targetPrice: number }[];
  compareList: Deal[];
  uploadedFlyers: UploadedFlyer[];
  hasCompletedOnboarding: boolean;
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  setUser: (user: any | null) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  initializeAuth: () => void;
  signOut: () => Promise<void>;
  fetchUserDataFromSupabase: () => Promise<void>;
  completeOnboarding: () => void;
  addDeals: (newDeals: Deal[]) => void;
  addUploadedFlyer: (flyer: UploadedFlyer) => void;
  updateUploadedFlyer: (id: string, updates: Partial<UploadedFlyer>) => void;
  removeDeal: (productId: string) => Promise<void>;
  upvoteDeal: (productId: string) => void;
  downvoteDeal: (productId: string) => void;
  flagOutOfStock: (productId: string) => void;
  addToShoppingList: (deal: Deal, quantity?: number) => void;
  removeFromShoppingList: (productId: string) => void;
  clearShoppingList: () => void;
  updateQuantity: (productId: string, quantity: number) => void;
  optimizeShoppingList: (newItems: ListItem[]) => void;
  syncOfflineDeals: () => Promise<void>;
  setUserLocation: (location: { lat: number, lon: number } | null) => void;
  setSelectedRegion: (region: string) => void;
  addSavings: (amount: number) => void;
  setMonthlyGoal: (goal: number) => void;
  setWeeklyBudget: (budget: number) => void;
  setTransportMode: (mode: 'driving' | 'walking' | 'bus') => void;
  addPriceAlert: (productId: string, targetPrice: number) => void;
  removePriceAlert: (productId: string) => void;
  addToCompareList: (deal: Deal) => void;
  removeFromCompareList: (productId: string) => void;
  clearCompareList: () => void;
  fetchDealsFromSupabase: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      isAdmin: false,
      deals: initialDeals,
      shoppingList: [],
      pendingOfflineDeals: [],
      userLocation: null,
      selectedRegion: 'current',
      savingsHistory: [],
      monthlyGoal: 500,
      weeklyBudget: 150,
      transportMode: 'driving',
      priceAlerts: [],
      compareList: [],
      uploadedFlyers: [],
      hasCompletedOnboarding: false,
      toasts: [],
      setUser: (user) => {
        const adminEmails = ['kavi.kavinay@gmail.com', 'admin@fijideals.com'];
        set({ user, isAdmin: user?.email && adminEmails.includes(user.email) });
      },
      addToast: (message, type = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({
          toasts: [...state.toasts, { id, message, type }]
        }));
        setTimeout(() => get().removeToast(id), 3000);
      },
      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      })),
      initializeAuth: () => {
        if (!supabase) return;
        
        const adminEmails = ['kavi.kavinay@gmail.com', 'admin@fijideals.com'];
        
        supabase.auth.getSession().then(({ data: { session } }) => {
          const user = session?.user ?? null;
          set({ user, isAdmin: user?.email && adminEmails.includes(user.email) });
          if (user) {
            get().fetchUserDataFromSupabase();
          }
        });

        supabase.auth.onAuthStateChange((_event, session) => {
          const user = session?.user ?? null;
          set({ user, isAdmin: user?.email && adminEmails.includes(user.email) });
          if (user) {
            get().fetchUserDataFromSupabase();
          } else {
            // Clear user data on sign out
            set({ shoppingList: [], savingsHistory: [], priceAlerts: [], isAdmin: false });
          }
        });
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      fetchUserDataFromSupabase: async () => {
        const state = get();
        if (!supabase || !state.user) return;
        
        try {
          // Fetch shopping list
          const { data: shoppingListData } = await supabase
            .from('shopping_lists')
            .select('*')
            .eq('user_id', state.user.id)
            .single();
            
          if (shoppingListData && shoppingListData.items) {
            set({ shoppingList: shoppingListData.items });
          }

          // Fetch user profile (savings, goal, alerts)
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', state.user.id)
            .single();
            
          if (profileData) {
            set({ 
              savingsHistory: profileData.savings_history || [],
              monthlyGoal: profileData.monthly_goal || 500,
              priceAlerts: profileData.price_alerts || []
            });
          }
        } catch (error) {
          console.error('Error fetching user data from Supabase:', error);
        }
      },
      addDeals: async (newDeals) => {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        
        set((state) => {
          const updatedDeals = [...state.deals];
          const newDealsToAdd: Deal[] = [];
          
          // Identify stores being updated
          const updatedStoreKeys = new Set(newDeals.map(d => `${d.store}|${d.location}`));
          
          newDeals.forEach(newDeal => {
            const existingIndex = updatedDeals.findIndex(d => d.product_id === newDeal.product_id);
            
            if (existingIndex >= 0) {
              const existingDeal = updatedDeals[existingIndex];
              
              // Price History Logic
              if (existingDeal.price !== newDeal.price) {
                const historyPoint = {
                  price: existingDeal.price || 0,
                  date: existingDeal.uploaded_at ? new Date(existingDeal.uploaded_at).toISOString() : new Date().toISOString(),
                  store: existingDeal.store,
                  deal_type: existingDeal.deal_type
                };
                
                newDeal.price_history = [
                  ...(existingDeal.price_history || []),
                  historyPoint
                ];
                
                // Determine price trend
                if (newDeal.price && existingDeal.price) {
                  if (newDeal.price < existingDeal.price) newDeal.price_trend = 'dropping';
                  else if (newDeal.price > existingDeal.price) newDeal.price_trend = 'rising';
                  else newDeal.price_trend = 'stable';
                }
              } else {
                newDeal.price_history = existingDeal.price_history;
                newDeal.price_trend = existingDeal.price_trend;
              }
              
              // Update existing deal
              updatedDeals[existingIndex] = {
                ...existingDeal,
                ...newDeal,
                is_archived: false // Reactivate if it was archived
              };
            } else {
              newDealsToAdd.push(newDeal);
            }
          });

          // Archive deals from the same store that are NOT in the new batch
          // (Only if they were part of a previous flyer and are now missing)
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          const finalDeals = updatedDeals.map(deal => {
            const storeKey = `${deal.store}|${deal.location}`;
            if (updatedStoreKeys.has(storeKey)) {
              // If this deal belongs to an updated store but wasn't updated in this batch
              // and it's an "old" deal (not from the current upload session)
              const isFromCurrentBatch = newDeals.some(nd => nd.product_id === deal.product_id);
              if (!isFromCurrentBatch && (!deal.uploaded_at || deal.uploaded_at < oneHourAgo)) {
                return { ...deal, is_archived: true };
              }
            }
            return deal;
          });

          const allDeals = [...finalDeals, ...newDealsToAdd];
          
          // Filter out deals that have expired (optional, maybe keep them archived)
          const now = new Date().getTime();
          const activeDeals = allDeals.filter(d => {
             if (d.is_archived) return true; // Keep archived ones in state for history
             const endDate = new Date(d.end_date).getTime();
             return isNaN(endDate) || endDate >= now;
          });

          if (isOffline) {
            return { 
              deals: activeDeals,
              pendingOfflineDeals: [...state.pendingOfflineDeals, ...newDealsToAdd]
            };
          }
          
          return { deals: activeDeals };
        });

        // Push to Supabase if online and configured
        if (!isOffline && supabase) {
          try {
            const dealsToInsert = newDeals.map(d => ({
              ...d,
              uploaded_at: d.uploaded_at ? new Date(d.uploaded_at).toISOString() : new Date().toISOString()
            }));
            
            // Use upsert to handle updates and history
            await supabase.from('deals').upsert(dealsToInsert, { onConflict: 'product_id' });
          } catch (error) {
            console.error('Error syncing with Supabase:', error);
          }
        }
      },
      fetchDealsFromSupabase: async () => {
        if (!supabase) return;
        try {
          const { data, error } = await supabase.from('deals').select('*');
          if (error) throw error;
          
          if (data && data.length > 0) {
            const mappedDeals = data.map(d => ({
              ...d,
              uploaded_at: d.uploaded_at ? new Date(d.uploaded_at).getTime() : undefined
            }));
            
            set({ deals: mappedDeals });
          }
        } catch (error) {
          console.error('Error fetching from Supabase:', error);
        }
      },
      addUploadedFlyer: (flyer) => set((state) => ({
        uploadedFlyers: [flyer, ...state.uploadedFlyers]
      })),
      updateUploadedFlyer: (id, updates) => set((state) => ({
        uploadedFlyers: state.uploadedFlyers.map(f => 
          f.id === id ? { ...f, ...updates } : f
        )
      })),
      removeDeal: async (productId) => {
        set((state) => ({
          deals: state.deals.filter(d => d.product_id !== productId)
        }));
        
        if (supabase) {
          try {
            await supabase.from('deals').delete().eq('product_id', productId);
          } catch (error) {
            console.error('Error deleting deal from Supabase:', error);
          }
        }
      },
      upvoteDeal: (productId) => set((state) => ({
        deals: state.deals.map(deal => 
          deal.product_id === productId ? { ...deal, upvotes: (deal.upvotes || 0) + 1 } : deal
        )
      })),
      downvoteDeal: (productId) => set((state) => ({
        deals: state.deals.map(deal => 
          deal.product_id === productId ? { ...deal, downvotes: (deal.downvotes || 0) + 1 } : deal
        )
      })),
      flagOutOfStock: (productId) => set((state) => ({
        deals: state.deals.map(deal => 
          deal.product_id === productId ? { ...deal, outOfStock: true } : deal
        )
      })),
      addToShoppingList: (deal, quantity = 1) => set((state) => {
        const existing = state.shoppingList.find(item => item.product_id === deal.product_id);
        let newList;
        if (existing) {
          newList = state.shoppingList.map(item =>
            item.product_id === deal.product_id ? { ...item, quantity: item.quantity + quantity } : item
          );
        } else {
          newList = [...state.shoppingList, { product_id: deal.product_id, quantity, deal }];
        }
        
        if (state.user && supabase) {
          supabase.from('shopping_lists').upsert({
            user_id: state.user.id,
            items: newList,
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Error syncing shopping list:', error);
          });
        }
        
        return { shoppingList: newList };
      }),
      removeFromShoppingList: (productId) => set((state) => {
        const newList = state.shoppingList.filter(item => item.product_id !== productId);
        
        if (state.user && supabase) {
          supabase.from('shopping_lists').upsert({
            user_id: state.user.id,
            items: newList,
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Error syncing shopping list:', error);
          });
        }
        
        return { shoppingList: newList };
      }),
      clearShoppingList: () => set((state) => {
        if (state.user && supabase) {
          supabase.from('shopping_lists').upsert({
            user_id: state.user.id,
            items: [],
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Error syncing shopping list:', error);
          });
        }
        return { shoppingList: [] };
      }),
      updateQuantity: (productId, quantity) => set((state) => {
        const newList = state.shoppingList.map(item =>
          item.product_id === productId ? { ...item, quantity } : item
        );
        
        if (state.user && supabase) {
          supabase.from('shopping_lists').upsert({
            user_id: state.user.id,
            items: newList,
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Error syncing shopping list:', error);
          });
        }
        
        return { shoppingList: newList };
      }),
      optimizeShoppingList: (newItems) => set((state) => {
        if (state.user && supabase) {
          supabase.from('shopping_lists').upsert({
            user_id: state.user.id,
            items: newItems,
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Error syncing shopping list:', error);
          });
        }
        return { shoppingList: newItems };
      }),
      syncOfflineDeals: async () => {
        const state = get();
        if (state.pendingOfflineDeals.length > 0) {
          try {
            // Read current state from idb-keyval to prevent conflicts
            const storedStateStr = await idbStorage.getItem('fiji-smart-deals-storage');
            let storedDeals: Deal[] = [];
            
            if (storedStateStr) {
              const storedState = JSON.parse(storedStateStr);
              if (storedState && storedState.state && storedState.state.deals) {
                storedDeals = storedState.state.deals;
              }
            }
            
            set((currentState) => {
              // Merge stored deals with current deals and pending offline deals
              const mergedDealsMap = new Map<string, Deal>();
              
              // 1. Add stored deals
              storedDeals.forEach(d => mergedDealsMap.set(d.product_id, d));
              
              // 2. Add current deals (overwrites stored if conflict, assuming current is newer)
              currentState.deals.forEach(d => mergedDealsMap.set(d.product_id, d));
              
              // 3. Ensure pending offline deals are included
              currentState.pendingOfflineDeals.forEach(d => mergedDealsMap.set(d.product_id, d));
              
              return {
                deals: Array.from(mergedDealsMap.values()),
                pendingOfflineDeals: [] // Clear the queue after successful sync
              };
            });
            
          } catch (error) {
            console.error("Failed to synchronize offline deals with idb-keyval:", error);
          }
        }
      },
      setUserLocation: (location) => set({ userLocation: location }),
      setSelectedRegion: (region) => set({ selectedRegion: region }),
      addSavings: (amount) => set((state) => {
        const newHistory = [...state.savingsHistory, { amount, date: new Date().toISOString() }];
        
        if (state.user && supabase) {
          supabase.from('user_profiles').upsert({
            user_id: state.user.id,
            savings_history: newHistory,
            monthly_goal: state.monthlyGoal,
            price_alerts: state.priceAlerts,
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Error syncing savings history:', error);
          });
        }
        
        return { savingsHistory: newHistory };
      }),
      setMonthlyGoal: (goal) => set((state) => {
        if (state.user && supabase) {
          supabase.from('user_profiles').upsert({
            user_id: state.user.id,
            savings_history: state.savingsHistory,
            monthly_goal: goal,
            price_alerts: state.priceAlerts,
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Error syncing monthly goal:', error);
          });
        }
        return { monthlyGoal: goal };
      }),
      setWeeklyBudget: (budget) => set({ weeklyBudget: budget }),
      setTransportMode: (mode) => set({ transportMode: mode }),
      addPriceAlert: (productId, targetPrice) => set((state) => {
        const newAlerts = [...state.priceAlerts.filter(a => a.productId !== productId), { productId, targetPrice }];
        
        if (state.user && supabase) {
          supabase.from('user_profiles').upsert({
            user_id: state.user.id,
            savings_history: state.savingsHistory,
            monthly_goal: state.monthlyGoal,
            price_alerts: newAlerts,
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Error syncing price alerts:', error);
          });
        }
        
        return { priceAlerts: newAlerts };
      }),
      removePriceAlert: (productId) => set((state) => {
        const newAlerts = state.priceAlerts.filter(a => a.productId !== productId);
        
        if (state.user && supabase) {
          supabase.from('user_profiles').upsert({
            user_id: state.user.id,
            savings_history: state.savingsHistory,
            monthly_goal: state.monthlyGoal,
            price_alerts: newAlerts,
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Error syncing price alerts:', error);
          });
        }
        
        return { priceAlerts: newAlerts };
      }),
      addToCompareList: (deal) => set((state) => {
        if (state.compareList.find(d => d.product_id === deal.product_id)) return state;
        if (state.compareList.length >= 4) return state; // Limit to 4 items
        return { compareList: [...state.compareList, deal] };
      }),
      removeFromCompareList: (productId) => set((state) => ({
        compareList: state.compareList.filter(d => d.product_id !== productId)
      })),
      clearCompareList: () => set({ compareList: [] }),
    }),
    {
      name: 'fiji-smart-deals-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
