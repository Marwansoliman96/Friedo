'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, MapPin, Search, Bike, Check } from 'lucide-react';
import type { DeliveryArea } from '@/shared/types';

interface DeliveryAreasModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryAreas: DeliveryArea[];
}

export const DeliveryAreasModal: React.FC<DeliveryAreasModalProps> = ({
  isOpen,
  onClose,
  deliveryAreas,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [savedAreaName, setSavedAreaName] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    try {
      const raw = localStorage.getItem('friedo_customer_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.area) setSavedAreaName(parsed.area);
      }
    } catch {
      // ignore
    }
  }, [isOpen]);

  const filteredAreas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return deliveryAreas;
    return deliveryAreas.filter((area) => area.name.toLowerCase().includes(q));
  }, [deliveryAreas, searchQuery]);

  if (!isOpen) return null;

  const handleSelectArea = (area: DeliveryArea) => {
    setSavedAreaName(area.name);
    try {
      const raw = localStorage.getItem('friedo_customer_v1');
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        'friedo_customer_v1',
        JSON.stringify({ ...existing, area: area.name })
      );
    } catch {
      // ignore
    }
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md max-h-[85vh] bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
      >
        {/* الهيدر */}
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between gap-2 bg-[#fffdf7]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 text-[#ff2b2b] flex items-center justify-center shrink-0">
              <Bike className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-stone-900">
                مناطق وأسعار التوصيل
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                نوصل إلى {deliveryAreas.length} منطقة • اضغط لتحديد منطقتك (اختياري)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة مناطق التوصيل"
            className="w-11 h-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* شريط البحث السريع */}
        <div className="p-3.5 border-b border-stone-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم منطقتك (مثال: سموحة، بحري، جليم...)"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pr-9 pl-3 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-red-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* قائمة المناطق */}
        <div className="p-3.5 overflow-y-auto space-y-2 bg-[#fffdf7]">
          {filteredAreas.length === 0 ? (
            <div className="py-10 text-center text-xs text-stone-500">
              لا توجد منطقة مطابقة لـ &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredAreas.map((area) => {
              const isSelected = savedAreaName === area.name;
              return (
                <button
                  key={area.id || area.name}
                  type="button"
                  onClick={() => handleSelectArea(area)}
                  className={`w-full px-3.5 py-2.5 rounded-2xl border text-right flex items-center justify-between gap-2 transition-all active:scale-[0.99] cursor-pointer ${
                    isSelected
                      ? 'bg-red-50/70 border-[#ff2b2b] shadow-2xs'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isSelected ? (
                      <Check className="w-4 h-4 text-[#ff2b2b] shrink-0 stroke-[2.5]" />
                    ) : (
                      <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                    )}
                    <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                      {area.name}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
                      isSelected
                        ? 'bg-[#ff2b2b] text-white'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {area.fee} ج.م
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
