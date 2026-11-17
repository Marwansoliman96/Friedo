'use client';

import React from 'react';
import Image from '@/shared/components/Image';
import { ShoppingBag, Phone } from 'lucide-react';
import { useSafeCart } from '@/features/cart/store/useCartStore';
import type { RestaurantInfo } from '@/shared/types';

interface HeaderProps {
  restaurantInfo: RestaurantInfo;
}

export const Header: React.FC<HeaderProps> = ({ restaurantInfo }) => {
  const { cartCount, subtotal, setCartOpen, isMounted } = useSafeCart();

  return (
    <header className="sticky top-0 z-40 bg-[#fffdf7]/90 backdrop-blur-xl border-b border-stone-200/80 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* اللوجو والاسم */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-red-500/30 shadow-md bg-white shrink-0">
            <Image
              src={restaurantInfo.logo || '/logo.png'}
              alt={restaurantInfo.name}
              fill
              className="object-cover p-0.5"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-black text-stone-900 tracking-tight">
                {restaurantInfo.name}
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                مفتوح للطلب
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium line-clamp-1">
              {restaurantInfo.description || 'طعم مايتنسيش!'}
            </p>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex items-center gap-2">
          {restaurantInfo.phone && (
            <a
              href={`tel:${restaurantInfo.phone}`}
              className="w-10 h-10 rounded-xl bg-white border border-stone-200 text-stone-700 hover:text-stone-900 hover:border-stone-300 flex items-center justify-center active:scale-95 transition-transform shadow-xs"
              title="اتصل بالمطعم"
              aria-label="اتصال"
            >
              <Phone className="w-4 h-4 text-[#ff2b2b]" />
            </a>
          )}

          {/* زر السلة */}
          <button
            onClick={() => setCartOpen(true)}
            className="h-10 px-3.5 rounded-xl bg-gradient-to-r from-[#ff2b2b] to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-red-500/25 active:scale-95 transition-all"
            aria-label="فتح السلة"
          >
            <div className="relative">
              <ShoppingBag className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-400 text-stone-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </div>
            {cartCount > 0 && (
              <span className="hidden sm:inline font-black text-amber-100">
                {subtotal} ج.م
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
