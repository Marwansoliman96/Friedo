import React, { useState, useEffect, useCallback } from 'react';
import { getMenuData } from '@/features/menu/services/menuService';
import { MenuClientShell } from '@/features/menu/components/MenuClientShell';
import { AlertCircle, RefreshCw, Flame, WifiOff } from 'lucide-react';
import type { RestaurantInfo, MenuSection, DeliveryArea } from '@/shared/types';

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);

  // جلب البيانات حصرياً من قاعدة بيانات Supabase
  const loadMenuFromDatabase = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getMenuData();
      setRestaurantInfo(data.restaurantInfo);
      setSections(data.sections);
      setDeliveryAreas(data.deliveryAreas);
    } catch (err: any) {
      console.error('Error fetching menu from database:', err);
      setError(err?.message || 'تعذر الاتصال بقاعدة البيانات لجلب المنيو.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenuFromDatabase();
  }, [loadMenuFromDatabase]);

  // شاشة التحميل الأولية من قاعدة البيانات (Skeleton Screen متناسق بالكامل)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fffdf7] text-stone-900 flex flex-col font-sans pb-20">
        {/* شريط الهيدر الهيكلي */}
        <header className="sticky top-0 z-40 bg-[#fffdf7]/90 backdrop-blur-md border-b border-stone-200/80 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-stone-200 animate-pulse" />
              <div className="space-y-1.5">
                <div className="w-24 h-4 bg-stone-200 rounded animate-pulse" />
                <div className="w-36 h-2.5 bg-stone-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-stone-200 animate-pulse" />
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-5 w-full space-y-8">
          {/* كارت البانر الهيكلي */}
          <div className="rounded-3xl bg-stone-200/60 p-6 h-36 animate-pulse" />

          {/* شريط الأقسام الهيكلي */}
          <div className="flex items-center gap-2 overflow-hidden py-1">
            <div className="w-24 h-8 rounded-xl bg-stone-200 animate-pulse shrink-0" />
            <div className="w-20 h-8 rounded-xl bg-stone-200 animate-pulse shrink-0" />
            <div className="w-28 h-8 rounded-xl bg-stone-200 animate-pulse shrink-0" />
            <div className="w-24 h-8 rounded-xl bg-stone-200 animate-pulse shrink-0" />
          </div>

          {/* كروت العروض الهيكلية */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-200 animate-pulse" />
              <div className="w-32 h-5 bg-stone-200 rounded animate-pulse" />
            </div>
            <div className="flex gap-4 overflow-hidden py-2">
              <div className="w-[320px] aspect-square rounded-[26px] bg-stone-200 animate-pulse shrink-0" />
              <div className="w-[320px] aspect-square rounded-[26px] bg-stone-200 animate-pulse shrink-0" />
            </div>
          </div>

          {/* شبكة الوجبات الهيكلية */}
          <div className="space-y-3">
            <div className="w-28 h-5 bg-stone-200 rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-stone-200/70 animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // شاشة الخطأ في حال تعذر الوصول لقاعدة البيانات مع زر لإعادة المحاولة
  if (error || !restaurantInfo) {
    return (
      <div className="min-h-screen bg-[#fffdf7] text-stone-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#ff2b2b] flex items-center justify-center mx-auto">
            <WifiOff className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-stone-900">تعذر الاتصال بقاعدة البيانات</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              لم نتمكن من جلب قائمة الأصناف من الخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-stone-100 text-[11px] text-stone-600 font-mono text-left dir-ltr break-all">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={loadMenuFromDatabase}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#ff2b2b] hover:bg-[#e02424] text-white py-3 px-4 rounded-xl font-bold text-xs shadow-md shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة المحاولة الآن</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MenuClientShell
      restaurantInfo={restaurantInfo}
      sections={sections}
      deliveryAreas={deliveryAreas}
    />
  );
}

export default App;
