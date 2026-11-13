'use client';

import React from 'react';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import { useSafeCart } from '@/features/cart/store/useCartStore';

export const FloatingCartBar: React.FC = () => {
  const { items, cartCount: totalCount, subtotal, setCartOpen, isMounted } = useSafeCart();
  if (!isMounted || items.length === 0) return null;

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom-6 duration-300">
      <button
        onClick={() => setCartOpen(true)}
        className="w-full min-h-[52px] bg-gradient-to-r from-red-600 via-red-600 to-amber-600 text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-2xl shadow-red-600/40 ring-1 ring-white/20 active:scale-[0.98] transition-all"
        aria-label="عرض سلة الطلبات"
      >
        <div className="flex items-center gap-3">
          <div className="relative bg-zinc-950/30 w-8 h-8 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-white" />
            <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-zinc-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {totalCount}
            </span>
          </div>
          <div className="text-right">
            <span className="block text-xs font-black">عرض السلة</span>
            <span className="block text-[11px] text-amber-200">{totalCount} صنف في انتظارك</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-black tracking-tight">{subtotal} ج.م</span>
          <ArrowLeft className="w-4 h-4" />
        </div>
      </button>
    </div>
  );
};
