import { create } from 'zustand';
import { Deal, ListItem } from './types';
import { initialDeals } from './data/initialDeals';

interface AppState {
  deals: Deal[];
  shoppingList: ListItem[];
  addDeals: (newDeals: Deal[]) => void;
  addToShoppingList: (deal: Deal) => void;
  removeFromShoppingList: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
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
}));
