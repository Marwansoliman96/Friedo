'use client';

import React from 'react';
import { Flame, Sparkles, Bike, ShieldCheck } from 'lucide-react';

export const HeroBanner: React.FC = () => {
  return (
    <section className="relative overflow-hidden pt-4 pb-2 px-4 max-w-4xl mx-auto">
      <div className="relative rounded-3xl bg-gradient-to-br from-red-50 via-amber-50/40 to-orange-50/30 border border-red-100/80 p-4 sm:p-6 overflow-hidden shadow-sm">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100/80 border border-red-200 text-[#ff2b2b] text-xs font-bold">
            <Flame className="w-3.5 h-3.5 fill-[#ff2b2b]" />
            <span>طازج ومقرمش يومياً على طلبك</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-stone-900 leading-tight">
            عيش طعم القرمشة الحقيقي مع <span className="text-[#ff2b2b]">فرايدو</span>
          </h2>

          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-xl">
            أنت الآن على موعد مع أفضل تجربة فرايد تشيكن على الإطلاق
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-stone-600 font-medium">
            <button
              type="button"
              onClick={() => {
                const el = document.querySelector('[id*="sec"]');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-1.5 bg-[#ff2b2b] text-white px-3 py-1.5 rounded-xl font-bold shadow-xs hover:bg-[#e02424] active:scale-95 transition-all cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 fill-white" />
              <span>استكشف عروض التوفير</span>
            </button>
            <span className="flex items-center gap-1 bg-white/90 px-2.5 py-1.5 rounded-xl border border-stone-200/80 shadow-2xs">
              <Bike className="w-3.5 h-3.5 text-[#ff2b2b]" />
              توصيل لجميع المناطق
            </span>
            <span className="flex items-center gap-1 bg-white/90 px-2.5 py-1.5 rounded-xl border border-stone-200/80 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              أعلى جودة وأفضل سعر
            </span>
            <span className="flex items-center gap-1 bg-white/90 px-2.5 py-1.5 rounded-xl border border-stone-200/80 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              دفع عند الاستلام
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
