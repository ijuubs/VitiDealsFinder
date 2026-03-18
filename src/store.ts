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
  addDeals: (newDeals: Deal[]) => void;
  addToShoppingList: (deal: Deal) => void;
  removeFromShoppingList: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      deals: initialDeals,
      shoppingList: [],
      addDeals: (newDeals) => set((state) => ({ deals: [...state.deals, ...newDeals] })),
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
    }),
    {
      name: 'fiji-smart-deals-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
