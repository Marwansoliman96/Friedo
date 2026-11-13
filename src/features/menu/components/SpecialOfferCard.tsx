'use client';

import React from 'react';
import Image from '@/shared/components/Image';
import { Plus, Check, SlidersHorizontal, Flame, Sparkles, Users } from 'lucide-react';
import { useSafeCart } from '@/features/cart/store/useCartStore';
import type { Product } from '@/shared/types';

interface SpecialOfferCardProps {
  product: Product;
  index?: number;
}

export const SpecialOfferCard: React.FC<SpecialOfferCardProps> = ({ product, index = 0 }) => {
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

  // شارة مميزة حسب نوع العرض لزيادة الجاذبية
  const getOfferBadge = () => {
    const name = product.name || '';
    if (name.includes('الفرايد')) {
      return {
        text: 'الأكثر طلباً 🔥',
        icon: Flame,
        color: 'from-red-600 to-amber-600',
      };
    }
    if (name.includes('التوفير')) {
      return {
        text: 'أفضل توفير ⚡',
        icon: Sparkles,
        color: 'from-amber-500 to-orange-600',
      };
    }
    if (name.includes('العيلة')) {
      return {
        text: 'لمّة العيلة 👨‍👩‍👧‍👦',
        icon: Users,
        color: 'from-red-700 to-rose-600',
      };
    }
    return {
      text: index === 0 ? 'الأكثر طلباً 🔥' : 'عرض حصري ✨',
      icon: Flame,
      color: 'from-red-600 to-amber-600',
    };
  };

  const badge = getOfferBadge();
  const BadgeIcon = badge.icon;

  return (
    <article
      onClick={isAvailable ? handleAction : undefined}
      className={`special-offer-card group w-[76vw] xs:w-[270px] sm:w-[290px] md:w-[310px] shrink-0 flex flex-col justify-between select-none bg-white border border-stone-200/90 rounded-2xl overflow-hidden transition-all duration-200 ${
        isAvailable
          ? 'cursor-pointer hover:border-red-300 shadow-xs hover:shadow-md'
          : 'cursor-not-allowed opacity-65 grayscale-[25%] shadow-none'
      }`}
    >
      {/* 1. مساحة مخصصة لعرض صورة العرض بالكامل وبدون أي نصوص تغطي عليها */}
      <div className="relative w-full h-[185px] xs:h-[195px] sm:h-[210px] bg-stone-100 overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 76vw, 310px"
            style={{ objectFit: 'cover' }}
            loading="lazy"
            className={isAvailable ? 'group-hover:scale-104 transition-transform duration-500 ease-out' : ''}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs font-bold">
            صورة العرض
          </div>
        )}

        {/* شارة نوع العرض في الزاوية العلوية اليمنى */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/65 backdrop-blur-md border border-white/25 text-white text-[11px] font-bold shadow-md">
          {isAvailable ? (
            <>
              <BadgeIcon className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>{badge.text}</span>
            </>
          ) : (
            <span className="text-red-300 font-bold">غير متوفر حالياً</span>
          )}
        </div>

        {/* شارة الكمية في السلة إن وجدت */}
        {isAvailable && cartQty > 0 && (
          <div className="absolute top-2.5 left-2.5 z-10 bg-[#ff2b2b] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
            <span>{cartQty} بالسلة</span>
          </div>
        )}
      </div>

      {/* 2. شريط التفاصيل السفلي - مساحة بيضاء نظيفة لا تحجب الصورة إطلاقاً */}
      <div className="p-3 sm:p-3.5 space-y-2 bg-white flex flex-col justify-between flex-1">
        <div className="space-y-0.5">
          <h3 className="text-sm sm:text-base font-black text-stone-900 group-hover:text-[#ff2b2b] transition-colors line-clamp-1 leading-snug">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-[11px] text-stone-500 line-clamp-1 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* السعر والزر التفاعلي للطلب أو التخصيص */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
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
              className="inline-flex items-center gap-1 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl text-xs font-bold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed select-none"
            >
              <span>غير متاح</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAction}
              className={`inline-flex items-center gap-1 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer active:scale-95 ${
                hasOptions
                  ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200'
                  : 'bg-[#ff2b2b] hover:bg-[#e02424] text-white shadow-xs shadow-red-500/20'
              }`}
              aria-label={`طلب ${product.name}`}
            >
              {hasOptions ? (
                <>
                  <SlidersHorizontal className="w-3 h-3 text-stone-600" />
                  <span>تخصيص</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>أضف للطلب</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
