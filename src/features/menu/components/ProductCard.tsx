'use client';

import React from 'react';
import Image from '@/shared/components/Image';
import { Plus, Check, SlidersHorizontal } from 'lucide-react';
import { useSafeCart } from '@/features/cart/store/useCartStore';
import type { Product } from '@/shared/types';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addItem, openOptionsModal, items } = useSafeCart();

  const isAvailable = product.available === 'YES' || product.available === true || !product.available;
  const hasOptions = Boolean(product.options && product.options.length > 0);

  const cartQty = items
    .filter((it) => it.product.id === product.id)
    .reduce((sum, it) => sum + it.quantity, 0);

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAvailable) return;
    openOptionsModal(product);
  };

  return (
    <article
      onClick={isAvailable ? handleAction : undefined}
      className={`group p-3 sm:p-4 flex items-center gap-3.5 sm:gap-4 transition-colors select-none relative ${
        isAvailable
          ? 'cursor-pointer hover:bg-stone-50/80 active:bg-stone-100/60'
          : 'cursor-not-allowed opacity-65 grayscale-[30%] bg-stone-50/40'
      }`}
    >
      {/* 1. الجانب الأيمن: صورة الوجبة بأبعاد ثابتة ومقرمشة */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/70 shadow-2xs">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 80px, 96px"
            style={{ objectFit: 'cover' }}
            loading="lazy"
            className={isAvailable ? 'group-hover:scale-105 transition-transform duration-300 ease-out' : ''}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-[11px] font-bold">
            صورة الصنف
          </div>
        )}

        {/* شارة غير متوفر في حال عدم تفعيل المنتج */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-1 text-center z-10">
            <span className="text-[10px] font-black text-white bg-red-600/90 px-1.5 py-0.5 rounded-md shadow-xs">
              غير متوفر
            </span>
          </div>
        )}

        {/* شارة الكمية في السلة إن وجدت */}
        {isAvailable && cartQty > 0 && (
          <div className="absolute top-1 right-1 bg-[#ff2b2b] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-0.5 z-10">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
            <span>{cartQty}</span>
          </div>
        )}
      </div>

      {/* 2. الجانب الأيسر: تفاصيل الوجبة، السعر، وزر الطلب */}
      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5 text-right">
        {/* الاسم والوصف */}
        <div className="space-y-0.5">
          <h3 className="text-sm sm:text-base font-black text-stone-900 group-hover:text-[#ff2b2b] transition-colors line-clamp-1 leading-snug">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-[11px] sm:text-xs text-stone-500 leading-relaxed line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        {/* السعر والزر */}
        <div className="flex items-center justify-between gap-2 pt-1.5 mt-auto">
          <div className="flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-[#ff2b2b] tracking-tight">
              {product.base_price}
            </span>
            <span className="text-[11px] font-bold text-stone-500">ج.م</span>
          </div>

          {!isAvailable ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed select-none"
            >
              <span>غير متاح</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAction}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer active:scale-95 ${
                hasOptions
                  ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200/90'
                  : 'bg-[#ff2b2b] hover:bg-[#e02424] text-white shadow-xs shadow-red-500/20'
              }`}
              aria-label={`طلب ${product.name}`}
            >
              {hasOptions ? (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-stone-600" />
                  <span>تخصيص</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>إضافة</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
