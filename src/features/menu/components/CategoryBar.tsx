'use client';

import React, { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import type { MenuSection } from '@/shared/types';

interface CategoryBarProps {
  sections: MenuSection[];
  activeSection: string;
  onSelectSection: (sectionId: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  sections,
  activeSection,
  onSelectSection,
  searchQuery,
  setSearchQuery,
}) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // تحريك شريط الأقسام أفقياً تلقائياً ليكون القسم النشط في المنتصف وواضحاً للعميل أثناء التمرير
  useEffect(() => {
    if (!activeSection) return;
    const activeBtn = buttonRefs.current[activeSection];
    const container = tabsContainerRef.current;
    if (!activeBtn || !container) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    const btnCenter = btnRect.left + btnRect.width / 2;
    const containerCenter = containerRect.left + containerRect.width / 2;
    const diff = btnCenter - containerCenter;

    if (Math.abs(diff) > 4) {
      container.scrollBy({
        left: diff,
        behavior: 'smooth',
      });
    }
  }, [activeSection]);

  return (
    <div className="sticky top-[61px] z-30 bg-[#fffdf7] border-b border-stone-200/90 py-2.5 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 space-y-2">
        {/* شريط البحث */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن وجبتك المفضلة، ساندوتش، عرض..."
            className="w-full bg-white border border-stone-200 rounded-xl pr-10 pl-9 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#ff2b2b] shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* أزرار الأقسام */}
        <div
          ref={tabsContainerRef}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-1 px-0.5"
        >
          {sections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                ref={(el) => {
                  buttonRefs.current[sec.id] = el;
                }}
                type="button"
                onClick={() => onSelectSection(sec.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all duration-150 active:scale-95 ${isActive
                    ? 'bg-[#ff2b2b] text-white shadow-sm shadow-red-500/30'
                    : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-300 shadow-2xs'
                  }`}
              >
                {sec.name}
                <span className={`mr-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                  }`}>
                  {sec.items.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
