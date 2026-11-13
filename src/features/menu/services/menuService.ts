import { supabase } from '@/shared/lib/supabase/client';
import type { Product, ProductOption, MenuSection, DeliveryArea, RestaurantInfo } from '@/shared/types';
import fallbackData from '@/data/friedo_data.json';
import fallbackMenu from '@/data/menu_fallback.json';

const env = (import.meta.env || {}) as Record<string, string | undefined>;

export const TENANT_ID =
  env.VITE_TENANT_ID ||
  env.NEXT_PUBLIC_TENANT_ID ||
  'b22f93a5-a92a-440c-ad9b-4d24eb33ce43';

/**
 * جلب بيانات المنيو والأصناف والخيارات ومناطق التوصيل مباشرة وحصرياً من قاعدة بيانات Supabase
 */
export async function getMenuData(): Promise<{
  restaurantInfo: RestaurantInfo;
  sections: MenuSection[];
  allProducts: Product[];
  deliveryAreas: DeliveryArea[];
}> {
  // 1. إعداد معلومات المطعم الأساسية من المتغيرات البيئية
  const restaurantInfo: RestaurantInfo = {
    name: env.VITE_RESTAURANT_NAME || 'Friedo',
    description: 'طعم مايتنسيش ✨ أشهى فرايد تشيكن وبروستد وساندوتشات مميزة',
    logo: '/logo.png',
    themeColor: '#ff2b2b',
    phone: env.VITE_RESTAURANT_PHONE || '201284843300',
    currency: 'ج.م',
  };

  // 2. جلب جميع المنتجات المتاحة من جدول products في Supabase (مع Zero-Latency Fallback فوري)
  let dbProducts: any[] = [];
  try {
    const { data, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('available', 'YES')
      .order('category_order', { ascending: true })
      .order('display_order', { ascending: true });

    if (prodErr || !data || data.length === 0) {
      console.warn('Notice from Supabase products, applying zero-latency fallback:', prodErr?.message);
      dbProducts = ((fallbackMenu as any).products || []).filter(
        (p: any) => p.available === 'YES' || p.available === true
      );
    } else {
      dbProducts = data.filter((p: any) => p.available === 'YES' || p.available === true);
    }
  } catch (err) {
    console.warn('Network notice connecting to Supabase products, applying fallback:', err);
    dbProducts = ((fallbackMenu as any).products || []).filter(
      (p: any) => p.available === 'YES' || p.available === true
    );
  }

  // 3. جلب جميع خيارات التخصيص من جدول options في Supabase (الأولوية لـ display_order ثم created_at)
  let optionsList: ProductOption[] = [];
  try {
    const { data: dbOptions, error: optErr } = await supabase
      .from('options')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (optErr || !dbOptions || dbOptions.length === 0) {
      optionsList = (fallbackMenu as any).options || [];
    } else {
      optionsList = dbOptions;
    }
  } catch (err) {
    optionsList = (fallbackMenu as any).options || [];
  }

  // 4. دمج الخيارات ومطابقتها حصرياً ومستقلاً برقم الوجبة الفعلي (100% Isolated Per-Product)
  const enrichedProducts: Product[] = (dbProducts || []).map((p) => {
    const matched = optionsList
      .filter((opt) => opt.product_id === p.id)
      .sort((a, b) => {
        const orderA = Number(a.display_order) || 0;
        const orderB = Number(b.display_order) || 0;
        if (orderA !== orderB && (orderA > 0 || orderB > 0)) {
          if (orderA === 0) return 1;
          if (orderB === 0) return -1;
          return orderA - orderB;
        }
        if (a.created_at && b.created_at) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return 0;
      });

    let cleanImage = p.image_url || '';
    if (cleanImage.includes('assets/images/')) {
      cleanImage = cleanImage.replace('assets/images/', '/images/');
    } else if (cleanImage && !cleanImage.startsWith('/') && !cleanImage.startsWith('http')) {
      cleanImage = `/images/${cleanImage}`;
    }

    return {
      ...p,
      image_url: cleanImage,
      options: matched,
    };
  });

  // 5. تجميع المنتجات وترتيبها ديناميكياً داخل أقسام المنيو
  const sectionMap = new Map<string, { order: number; items: Product[] }>();

  enrichedProducts.forEach((prod) => {
    const cat = prod.category || 'أصناف متنوعة';
    if (!sectionMap.has(cat)) {
      sectionMap.set(cat, {
        order: prod.category_order || 999,
        items: [],
      });
    }
    sectionMap.get(cat)!.items.push(prod);
  });

  // ترتيب الأقسام حسب category_order
  const sortedSections = Array.from(sectionMap.entries()).sort(
    (a, b) => a[1].order - b[1].order
  );

  let sIndex = 1;
  const sections: MenuSection[] = sortedSections.map(([name, { order, items }]) => ({
    id: `sec_${sIndex++}`,
    name,
    order,
    items,
  }));

  // 6. جلب مناطق التوصيل من جدول delivery_areas في Supabase مع Fallback فوري من friedo_data.json
  const { data: dbAreas, error: areaErr } = await supabase
    .from('delivery_areas')
    .select('*')
    .eq('tenant_id', TENANT_ID);

  if (areaErr) {
    console.warn('Notice fetching delivery_areas from Supabase:', areaErr);
  }

  // استخدام مناطق Supabase إن وجدت، أو استرجاع الـ 24 منطقة من friedo_data.json فوراً
  const fallbackAreasList: DeliveryArea[] = ((fallbackData as any).deliveryAreas || []).map(
    (a: any, idx: number) => ({
      id: `area_fallback_${idx + 1}`,
      name: a.name,
      fee: Number(a.fee) || 0,
      tenant_id: TENANT_ID,
    })
  );

  const rawAreas = (dbAreas && dbAreas.length > 0) ? dbAreas : fallbackAreasList;

  const deliveryAreas: DeliveryArea[] = rawAreas.map((a: any, idx: number) => ({
    id: a.id || `area_${idx + 1}`,
    name: a.name,
    fee: Number(a.fee) || 0,
    tenant_id: a.tenant_id || TENANT_ID,
  }));

  return {
    restaurantInfo,
    sections,
    allProducts: enrichedProducts,
    deliveryAreas,
  };
}
