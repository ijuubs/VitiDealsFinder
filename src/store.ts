import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Deal, ListItem } from './types';
import { initialDeals } from './data/initialDeals';

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
  deals: Deal[];
  shoppingList: ListItem[];
  pendingOfflineDeals: Deal[];
  addDeals: (newDeals: Deal[]) => void;
  addToShoppingList: (deal: Deal) => void;
  removeFromShoppingList: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  syncOfflineDeals: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      deals: initialDeals,
      shoppingList: [],
      pendingOfflineDeals: [],
      addDeals: (newDeals) => set((state) => {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        
        // Deduplicate new deals
        const existingIds = new Set(state.deals.map(d => d.product_id));
        const uniqueNewDeals = newDeals.filter(d => !existingIds.has(d.product_id));
        
        if (isOffline) {
          // If offline, queue them for sync later to ensure data integrity
          return { 
            deals: [...state.deals, ...uniqueNewDeals],
            pendingOfflineDeals: [...state.pendingOfflineDeals, ...uniqueNewDeals]
          };
        }
        
        return { deals: [...state.deals, ...uniqueNewDeals] };
      }),
      addToShoppingList: (deal) => set((state) => {
        const existing = state.shoppingList.find(item => item.product_id === deal.product_id);
        if (existing) {
          return {
            shoppingList: state.shoppingList.map(item =>
              item.product_id === deal.product_id ? { ...item, quantity: item.quantity + 1 } : item
            )
          };
        }
        return { shoppingList: [...state.shoppingList, { product_id: deal.product_id, quantity: 1, deal }] };
      }),
      removeFromShoppingList: (productId) => set((state) => ({
        shoppingList: state.shoppingList.filter(item => item.product_id !== productId)
      })),
      updateQuantity: (productId, quantity) => set((state) => ({
        shoppingList: state.shoppingList.map(item =>
          item.product_id === productId ? { ...item, quantity } : item
        )
      })),
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
    }),
    {
      name: 'fiji-smart-deals-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
