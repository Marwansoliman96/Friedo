import React, { useState, useEffect, useCallback } from 'react';
import { getInitialMenuData, getMenuData, type MenuDataResult } from '@/features/menu/services/menuService';
import { MenuClientShell } from '@/features/menu/components/MenuClientShell';

export function App() {
  // ⚡ تهيئة الصفحة فوراً بالبيانات الحقيقية للمطعم (زمن انتظار 0 ملّي ثانية - بدون بيانات وهمية أو سكيلتون)
  const [menuData, setMenuData] = useState<MenuDataResult>(() => getInitialMenuData());

  // مزامنة صامتة في الخلفية مع قاعدة البيانات (Stale-While-Revalidate) لتحديث أي أسعار أو أصناف جديدة
  const syncWithDatabase = useCallback(async () => {
    try {
      const freshData = await getMenuData();
      if (freshData && freshData.sections.length > 0) {
        setMenuData(freshData);
      }
    } catch (err: any) {
      console.warn('Background sync notice:', err?.message);
    }
  }, []);

  useEffect(() => {
    syncWithDatabase();
  }, [syncWithDatabase]);

  // عرض المنيو الحقيقي للعميل فوراً دون أي وميض أو تأخير
  return (
    <MenuClientShell
      restaurantInfo={menuData.restaurantInfo}
      sections={menuData.sections}
      deliveryAreas={menuData.deliveryAreas}
    />
  );
}

export default App;
