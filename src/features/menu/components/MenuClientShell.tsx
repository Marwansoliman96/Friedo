'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Header } from './Header';
import { HeroBanner } from './HeroBanner';
import { CategoryBar } from './CategoryBar';
import { ProductCard } from './ProductCard';
import { SpecialOffersSection } from './SpecialOffersSection';
import { OptionSelectorModal } from './OptionSelectorModal';
import { DeliveryAreasModal } from './DeliveryAreasModal';
import { FloatingCartBar } from '@/features/cart/components/FloatingCartBar';
import { CartDrawer } from '@/features/cart/components/CartDrawer';
import { CheckoutModal } from '@/features/checkout/components/CheckoutModal';
import { useCartStore } from '@/features/cart/store/useCartStore';
import type { MenuSection, DeliveryArea, RestaurantInfo } from '@/shared/types';

interface MenuClientShellProps {
  restaurantInfo: RestaurantInfo;
  sections: MenuSection[];
  deliveryAreas: DeliveryArea[];
}

export const MenuClientShell: React.FC<MenuClientShellProps> = ({
  restaurantInfo,
  sections,
  deliveryAreas,
}) => {
  const [activeSection, setActiveSection] = useState<string>(
    sections.length > 0 ? sections[0].id : ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isAreasModalOpen, setAreasModalOpen] = useState(false);

  const isManualScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.trim().toLowerCase();

    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            (it.description && it.description.toLowerCase().includes(q))
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [sections, searchQuery]);

  // فحص السلة تلقائياً واستبعاد أي أصناف تم إيقافها أو لم تعد متوفرة في المطعم
  useEffect(() => {
    if (!sections || sections.length === 0) return;
    const availableProductIds = new Set(
      sections
        .flatMap((s) => s.items)
        .filter((p) => p.available === 'YES' || p.available === true || !p.available)
        .map((p) => p.id)
    );

    const cartItems = useCartStore.getState().items;
    const invalidItems = cartItems.filter((it) => !availableProductIds.has(it.product.id));

    if (invalidItems.length > 0) {
      invalidItems.forEach((it) => {
        useCartStore.getState().removeItem(it.id);
      });
    }
  }, [sections]);

  // متابعة التمرير الرأسي (ScrollSpy) لتحديث القسم النشط تلقائياً أثناء سكرول المنيو
  useEffect(() => {
    if (filteredSections.length === 0) return;

    const checkActiveSection = () => {
      // إذا كان التمرير ناتجاً عن ضغط المستخدم على زر تصنيف، ننتظر انتهاء الحركة السلسة
      if (isManualScrollingRef.current) return;

      // فحص نهاية الصفحة: إذا وصل العميل لآخر المنيو نفعّل القسم الأخير تلقائياً
      const isAtBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 60;

      if (isAtBottom) {
        const lastSec = filteredSections[filteredSections.length - 1];
        if (lastSec && activeSectionRef.current !== lastSec.id) {
          activeSectionRef.current = lastSec.id;
          setActiveSection(lastSec.id);
        }
        return;
      }

      // فحص الأقسام التي وصلت لمنطقة أسفل شريط التنقل المثبت (~170px)
      const offsetThreshold = 175;
      let currentVisibleId = filteredSections[0]?.id || '';

      for (let i = 0; i < filteredSections.length; i++) {
        const sec = filteredSections[i];
        const el = document.getElementById(sec.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= offsetThreshold) {
            currentVisibleId = sec.id;
          }
        }
      }

      if (currentVisibleId && currentVisibleId !== activeSectionRef.current) {
        activeSectionRef.current = currentVisibleId;
        setActiveSection(currentVisibleId);
      }
    };

    let isThrottled = false;
    const onScroll = () => {
      if (!isThrottled) {
        window.requestAnimationFrame(() => {
          checkActiveSection();
          isThrottled = false;
        });
        isThrottled = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // فحص أولي عند التحميل
    checkActiveSection();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [filteredSections]);

  const handleSelectSection = (sectionId: string) => {
    setActiveSection(sectionId);
    activeSectionRef.current = sectionId;
    isManualScrollingRef.current = true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // إتاحة الـ Scrollspy مجدداً بعد انتهاء السكرول السلس (Smooth Scroll)
    scrollTimeoutRef.current = setTimeout(() => {
      isManualScrollingRef.current = false;
    }, 750);
  };

  return (
    <div className="min-h-screen bg-[#fffdf7] text-stone-900 flex flex-col font-sans pb-36">
      <Header restaurantInfo={restaurantInfo} />

      {!searchQuery && <HeroBanner onOpenDeliveryAreas={() => setAreasModalOpen(true)} />}

      <CategoryBar
        sections={sections}
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <main className="max-w-4xl mx-auto px-4 py-6 w-full space-y-10">
        {filteredSections.length === 0 ? (
          <div className="py-20 text-center space-y-2 text-stone-500">
            <p className="text-sm font-bold text-stone-700">لا توجد نتائج تطابق بحثك</p>
            <p className="text-xs">جرب البحث باسم صنف آخر أو تصفح الأقسام</p>
          </div>
        ) : (
          filteredSections.map((sec) => {
            const isOffersSection =
              sec.name.includes('عروض') ||
              sec.name.includes('عرض') ||
              sec.name.toLowerCase().includes('offer');

            if (isOffersSection && !searchQuery) {
              return <SpecialOffersSection key={sec.id} section={sec} />;
            }

            return (
              <section key={sec.id} id={sec.id} className="space-y-2.5 scroll-mt-36">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff2b2b] shrink-0"></span>
                    <h2 className="text-base sm:text-lg font-black text-stone-900">{sec.name}</h2>
                  </div>
                  <span className="text-xs text-stone-500 font-bold">{sec.items.length} وجبة</span>
                </div>

                {/* Unified Inset List (قائمة موحدة لكل قسم) */}
                <div className="bg-white rounded-3xl border border-stone-200 shadow-xs divide-y divide-stone-200 overflow-hidden">
                  {sec.items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      <OptionSelectorModal />
      <DeliveryAreasModal
        isOpen={isAreasModalOpen}
        onClose={() => setAreasModalOpen(false)}
        deliveryAreas={deliveryAreas}
      />
      <FloatingCartBar />
      <CartDrawer />
      <CheckoutModal deliveryAreas={deliveryAreas} restaurantInfo={restaurantInfo} />
    </div>
  );
};
