'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Flame, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { SpecialOfferCard } from './SpecialOfferCard';
import type { MenuSection } from '@/shared/types';

interface SpecialOffersSectionProps {
  section: MenuSection;
}

export const SpecialOffersSection: React.FC<SpecialOffersSectionProps> = ({ section }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const items = section.items || [];

  // مراقبة ظهور القسم على الشاشة حتى يتوقف التمرير التلقائي تماماً إذا نزل العميل لتصفح باقي المنيو
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // دالة تمرير أفقية داخل الحاوية فقط دون تحريك نافذة المتصفح الرئيسية (Window Scroll)
  const scrollToSlide = useCallback((index: number) => {
    const container = scrollRef.current;
    if (!container) return;

    const cards = container.querySelectorAll<HTMLElement>('article');
    const targetCard = cards[index];
    if (!targetCard) return;

    // حساب المسافة الأفقية النسبية فقط داخل حاوية الكروت
    const containerRect = container.getBoundingClientRect();
    const cardRect = targetCard.getBoundingClientRect();

    const cardCenter = cardRect.left + cardRect.width / 2;
    const containerCenter = containerRect.left + containerRect.width / 2;
    const deltaX = cardCenter - containerCenter;

    // تمرير الحاوية أفقياً فقط
    container.scrollBy({
      left: deltaX,
      behavior: 'smooth',
    });

    setActiveIndex(index);
  }, []);

  const handleNext = () => {
    const nextIndex = (activeIndexRef.current + 1) % items.length;
    scrollToSlide(nextIndex);
  };

  const handlePrev = () => {
    const prevIndex = (activeIndexRef.current - 1 + items.length) % items.length;
    scrollToSlide(prevIndex);
  };

  // تمرير تلقائي يعمل فقط عندما يكون قسم العروض معروضاً أمام العميل، ويتوقف تلقائياً عند النزول لأقسام أخرى أو التفاعل
  useEffect(() => {
    if (isPaused || !isVisible || items.length <= 1) return;

    const timer = setInterval(() => {
      const next = (activeIndexRef.current + 1) % items.length;
      scrollToSlide(next);
    }, 4000);

    return () => clearInterval(timer);
  }, [isPaused, isVisible, items.length, scrollToSlide]);

  // متابعة التمرير اليدوي لتحديث رقم الشريحة النشطة دون إحداث أي ارتداد
  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    const cards = container.querySelectorAll<HTMLElement>('article');
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    let closestIdx = 0;
    let minDistance = Infinity;

    cards.forEach((card, idx) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(containerCenter - cardCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIdx = idx;
      }
    });

    if (closestIdx !== activeIndex) {
      setActiveIndex(closestIdx);
    }
  };

  if (items.length === 0) return null;

  return (
    <section ref={sectionRef} id={section.id} className="space-y-3.5 scroll-mt-36">
      {/* رأس قسم العروض الأنيق والمدمج */}
      <div className="flex items-center justify-between border-b border-stone-200/90 pb-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-[#ff2b2b]">
              <Flame className="w-3 h-3 fill-[#ff2b2b]" />
            </span>
            <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
              {section.name}
            </h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-900 border border-amber-200/60">
              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
              أقوى التوفيرات
            </span>
          </div>
          <p className="text-[11px] text-stone-500 font-medium">
            توفير حقيقي وأشهى وجبات مقرمشة تناسبك وتناسب كل حبايبك
          </p>
        </div>

        {/* أزرار الأسهم للتنقل السريع */}
        {items.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              className="w-7 h-7 rounded-full bg-white border border-stone-200 shadow-2xs flex items-center justify-center text-stone-700 hover:bg-stone-50 hover:text-stone-900 active:scale-95 transition-all cursor-pointer"
              aria-label="العرض السابق"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="w-7 h-7 rounded-full bg-white border border-stone-200 shadow-2xs flex items-center justify-center text-stone-700 hover:bg-stone-50 hover:text-stone-900 active:scale-95 transition-all cursor-pointer"
              aria-label="العرض التالي"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* شريط الكروت الأفقي التفاعلي مع Auto-scroll و Snap */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className="flex items-stretch gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-1 px-1 -mx-4 sm:mx-0 px-4 sm:px-0"
      >
        {items.map((product, idx) => (
          <SpecialOfferCard key={product.id} product={product} index={idx} />
        ))}
      </div>

      {/* مؤشرات الشرائح (Pagination Dots) */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToSlide(idx)}
              aria-label={`الانتقال للعرض ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                activeIndex === idx
                  ? 'w-7 bg-[#ff2b2b]'
                  : 'w-2 bg-stone-300 hover:bg-stone-400'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
