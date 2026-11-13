'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, CartItem, CartCustomizations } from '@/shared/types';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  isCheckoutOpen: boolean;
  selectedProductForOptions: Product | null;

  // Actions
  addItem: (product: Product, quantity?: number, customizations?: CartCustomizations) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  openOptionsModal: (product: Product) => void;
  closeOptionsModal: () => void;

  // Calculations
  getTotalCount: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isCheckoutOpen: false,
      selectedProductForOptions: null,

      addItem: (product, quantity = 1, customizations) => {
        const state = get();
        // حساب السعر الإفرادي للصنف مع خياراته
        let unitPrice = Number(product.base_price) || 0;
        const optionsSummaryParts: string[] = [];

        if (customizations?.selectedOptions && customizations.selectedOptions.length > 0) {
          customizations.selectedOptions.forEach((opt) => {
            unitPrice += Number(opt.total_price) || 0;
            const label = opt.quantity > 1 ? `${opt.item_name} ×${opt.quantity}` : opt.item_name;
            optionsSummaryParts.push(label);
          });
        } else {
          if (customizations?.size) {
            unitPrice += Number(customizations.size.price) || 0;
            optionsSummaryParts.push(customizations.size.name);
          }
          if (customizations?.sauce) {
            unitPrice += Number(customizations.sauce.price) || 0;
            optionsSummaryParts.push(customizations.sauce.name);
          }
          if (customizations?.extras && customizations.extras.length > 0) {
            customizations.extras.forEach((ext) => {
              unitPrice += Number(ext.price) || 0;
              optionsSummaryParts.push(ext.name);
            });
          }
          if (customizations?.removals && customizations.removals.length > 0) {
            optionsSummaryParts.push(`بدون: ${customizations.removals.join('، ')}`);
          }
        }

        const optionsSummary = optionsSummaryParts.join(' • ');

        // إنشاء معرف مميز لهذا الصنف بتوليفة خياراته
        const dynSig = (customizations?.selectedOptions || [])
          .map((o) => `${o.group_name}:${o.item_name}:${o.quantity}`)
          .sort()
          .join('|');

        const itemSignature = `${product.id}_${dynSig || `${customizations?.size?.name || ''}_${customizations?.sauce?.name || ''}_${(customizations?.extras || []).map(e => e.name).sort().join(',')}_${(customizations?.removals || []).sort().join(',')}`}`;

        const existingIndex = state.items.findIndex((it) => it.id === itemSignature);

        if (existingIndex > -1) {
          const updatedItems = [...state.items];
          const newQty = updatedItems[existingIndex].quantity + quantity;
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: newQty,
            total_price: newQty * updatedItems[existingIndex].unit_price,
          };
          set({ items: updatedItems });
        } else {
          const newItem: CartItem = {
            id: itemSignature,
            product,
            quantity,
            unit_price: unitPrice,
            total_price: unitPrice * quantity,
            customizations,
            options_summary: optionsSummary,
          };
          set({ items: [...state.items, newItem] });
        }
      },

      removeItem: (cartItemId) => {
        set({ items: get().items.filter((it) => it.id !== cartItemId) });
      },

      updateQuantity: (cartItemId, delta) => {
        const state = get();
        const existing = state.items.find((it) => it.id === cartItemId);
        if (!existing) return;

        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          set({ items: state.items.filter((it) => it.id !== cartItemId) });
        } else {
          set({
            items: state.items.map((it) =>
              it.id === cartItemId
                ? { ...it, quantity: newQty, total_price: newQty * it.unit_price }
                : it
            ),
          });
        }
      },

      clearCart: () => set({ items: [] }),
      setCartOpen: (open) => set({ isOpen: open }),
      setCheckoutOpen: (open) => set({ isCheckoutOpen: open }),
      openOptionsModal: (product) => set({ selectedProductForOptions: product }),
      closeOptionsModal: () => set({ selectedProductForOptions: null }),

      getTotalCount: () => {
        return get().items.reduce((total, it) => total + it.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((total, it) => total + it.total_price, 0);
      },
    }),
    {
      name: 'friedo_cart_v1',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

import { useState, useEffect } from 'react';

/**
 * Hook آمن يمنع أي Hydration Mismatch على هواتف الآيفون
 */
export function useSafeCart() {
  const [mounted, setMounted] = useState(false);
  const store = useCartStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    ...store,
    isMounted: mounted,
    items: mounted ? store.items : [],
    cartCount: mounted ? store.getTotalCount() : 0,
    subtotal: mounted ? store.getSubtotal() : 0,
  };
}
