'use client';

import React from 'react';
import Image from '@/shared/components/Image';
import { X, Trash2, Plus, Minus, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/features/cart/store/useCartStore';

export const CartDrawer: React.FC = () => {
  const isOpen = useCartStore((s) => s.isOpen);
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  const setCheckoutOpen = useCartStore((s) => s.setCheckoutOpen);
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const getSubtotal = useCartStore((s) => s.getSubtotal);

  const subtotal = getSubtotal();

  if (!isOpen) return null;

  const handleProceedToCheckout = () => {
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-50/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md h-full bg-white border-r border-stone-200 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-300">
        {/* الهيدر */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-black text-stone-900">سلة الطلبات</h2>
            <span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-bold">
              {items.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-stone-500 hover:text-rose-400 font-bold px-2 py-1"
              >
                تفريغ
              </button>
            )}
            <button
              onClick={() => setCartOpen(false)}
              className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:text-stone-900 flex items-center justify-center active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* قائمة الأصناف */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-stone-400">
              <ShoppingBag className="w-12 h-12 stroke-[1.5]" />
              <p className="text-sm font-bold text-stone-500">سلتك فارغة حالياً</p>
              <p className="text-xs text-stone-400">أضف بعض الوجبات اللذيذة لبدء طلبك</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-3 flex gap-3 items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.product.image_url && (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/60 shrink-0">
                      <Image
                        src={item.product.image_url}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 space-y-0.5">
                    <h4 className="text-xs font-black text-stone-900 truncate">{item.product.name}</h4>
                    {item.options_summary && (
                      <p className="text-[11px] text-stone-600 font-medium line-clamp-2 leading-tight">
                        {item.options_summary}
                      </p>
                    )}
                    {item.customizations?.notes && (
                      <p className="text-[10px] text-amber-700/90 font-semibold truncate">
                        ملاحظة: {item.customizations.notes}
                      </p>
                    )}
                    <p className="text-xs font-black text-red-600">
                      {item.total_price} <span className="text-[10px] font-bold text-stone-500">ج.م</span>
                    </p>
                  </div>
                </div>

                {/* أزرار الكمية والحذف */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200/90 rounded-xl p-1 shadow-inner">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-stone-200/80 text-stone-700 hover:text-red-600 hover:border-red-200 flex items-center justify-center active:scale-90 transition-all shadow-xs cursor-pointer"
                      aria-label="تقليل الكمية"
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <span className="min-w-[22px] text-center text-xs sm:text-sm font-black text-stone-900 select-none">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center active:scale-90 transition-all shadow-xs cursor-pointer"
                      aria-label="زيادة الكمية"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="w-8 h-8 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                    aria-label="حذف الصنف من السلة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* الفوتر وزر إتمام الطلب */}
        {items.length > 0 && (
          <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">المجموع الفرعي</span>
              <span className="text-base font-black text-red-600">{subtotal} ج.م</span>
            </div>
            <button
              onClick={handleProceedToCheckout}
              className="w-full min-h-[48px] bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-black text-sm flex items-center justify-between px-4 shadow-lg shadow-red-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <span>متابعة إتمام الطلب</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
