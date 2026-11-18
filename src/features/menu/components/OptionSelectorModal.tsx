'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from '@/shared/components/Image';
import { X, Plus, Minus, Check, AlertCircle, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/features/cart/store/useCartStore';
import type { ProductOption, SelectedCustomOption } from '@/shared/types';

interface InternalOptionGroup {
  key: string;
  title: string;
  title_en: string;
  order: number;
  selection_type: 'single' | 'multi' | 'quantity';
  min_selection: number;
  max_selection: number;
  max_qty_per_item: number;
  options: ProductOption[];
}

/**
 * تحديد ترتيب مجموعة الخيارات:
 * الأولوية لحقل group_order من قاعدة البيانات، مع fallback متناسق تماماً مع الداشبورد ومنطق طلب الطعام
 */
function getInitialGroupOrder(opt: ProductOption, groupName: string): number {
  if (typeof opt.group_order === 'number' && opt.group_order > 0) {
    return opt.group_order;
  }

  const gn = groupName.toLowerCase();
  const typeStr = (opt.option_type || '').toLowerCase();

  // 1. الأحجام والكومبو والتتبيلة
  if (typeStr === 'size' || gn.includes('حجم') || gn.includes('أحجام') || gn.includes('كومبو') || gn.includes('تتبيل')) {
    return 1;
  }

  // 2. الصوص الأساسي الأول المشمول
  if (typeStr === 'first_sauce' || gn.includes('اساسي') || gn.includes('أساسي') || gn.includes('رئيسي')) {
    return 2;
  }

  // 3. الصوص الجانبي المشمول
  if (typeStr === 'side_sauce' || gn.includes('جانبي')) {
    return 3;
  }

  // 4. خيارات الصوصات العامة
  if (typeStr === 'sauce' || gn.includes('صوص')) {
    return 4;
  }

  // 5. خيارات الصنف الخاصة (تبديل صدر إلى ورك، نوع الخبز)
  if (gn.includes('خيارات') || gn.includes('تعديل') || gn.includes('نوع')) {
    return 5;
  }

  // 6. الإضافات المدفوعة والجانبية
  if (typeStr === 'extras' || gn.includes('إضاف') || gn.includes('اضاف')) {
    return 6;
  }

  // 7. بدون (الاستبعادات)
  if (typeStr === 'removals' || gn.includes('بدون') || gn.includes('استبعاد')) {
    return 7;
  }

  return 99;
}

export const OptionSelectorModal: React.FC = () => {
  const product = useCartStore((s) => s.selectedProductForOptions);
  const closeOptionsModal = useCartStore((s) => s.closeOptionsModal);
  const addItem = useCartStore((s) => s.addItem);

  const [quantity, setQuantity] = useState(1);
  const [singleSelections, setSingleSelections] = useState<Record<string, ProductOption | null>>({});
  const [multiSelections, setMultiSelections] = useState<Record<string, ProductOption[]>>({});
  const [quantitySelections, setQuantitySelections] = useState<Record<string, Record<string, number>>>({});
  const [notes, setNotes] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);

  // 1. تجميع الخيارات ديناميكياً وترتيبها حسب group_order و display_order
  const groups: InternalOptionGroup[] = useMemo(() => {
    if (!product || !product.options || product.options.length === 0) return [];

    const groupMap = new Map<string, InternalOptionGroup>();

    product.options.forEach((opt) => {
      // تحديد اسم المجموعة بالعربي والإنجليزي
      let groupName = (opt.group_name || '').trim();
      let groupNameEn = (opt.group_name_en || '').trim();
      let selType: 'single' | 'multi' | 'quantity' = opt.selection_type || 'single';

      // Fallback ذكي إذا كانت البيانات القديمة لا تحتوي على group_name
      if (!groupName) {
        const typeStr = (opt.option_type || '').toLowerCase();
        if (typeStr === 'size' || typeStr === 'حجم' || typeStr === 'sizes') {
          groupName = 'الحجم / الكومبو';
          groupNameEn = 'Size / Combo';
          selType = 'single';
        } else if (typeStr === 'sauce' || typeStr === 'صوص') {
          groupName = 'نوع الصوص';
          groupNameEn = 'Sauce Selection';
          selType = 'single';
        } else if (typeStr === 'removals' || typeStr === 'بدون' || typeStr === 'استبعاد') {
          groupName = 'استبعادات';
          groupNameEn = 'Removals';
          selType = 'multi';
        } else {
          groupName = 'إضافات إضافية';
          groupNameEn = 'Extras & Add-ons';
          selType = 'quantity';
        }
      }

      const calculatedOrder = getInitialGroupOrder(opt, groupName);

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, {
          key: groupName,
          title: groupName,
          title_en: groupNameEn || groupName,
          order: calculatedOrder,
          selection_type: opt.selection_type || selType,
          min_selection: typeof opt.min_selection === 'number' ? opt.min_selection : (selType === 'single' ? 1 : 0),
          max_selection: typeof opt.max_selection === 'number' && opt.max_selection > 0 ? opt.max_selection : (selType === 'single' ? 1 : 99),
          max_qty_per_item: typeof opt.max_qty_per_item === 'number' && opt.max_qty_per_item > 0 ? opt.max_qty_per_item : 5,
          options: [],
        });
      } else {
        // إذا كان أحد خيارات المجموعة يحتوي على group_order أصغر في قاعدة البيانات نعتمد عليه
        const currentGroup = groupMap.get(groupName)!;
        if (calculatedOrder < currentGroup.order) {
          currentGroup.order = calculatedOrder;
        }
      }

      groupMap.get(groupName)!.options.push(opt);
    });

    // الهرمية: ترتيب المجموعات أولاً بـ group_order، ثم ترتيب الأصناف داخل كل مجموعة بـ display_order مع فولباك created_at
    return Array.from(groupMap.values())
      .sort((a, b) => a.order - b.order)
      .map((g) => {
        g.options.sort((a, b) => {
          const orderA = Number(a.display_order) || 0;
          const orderB = Number(b.display_order) || 0;
          // إذا كان display_order محدداً في لوحة التحكم (> 0) نعتمد عليه
          if (orderA !== orderB && (orderA > 0 || orderB > 0)) {
            if (orderA === 0) return 1;
            if (orderB === 0) return -1;
            return orderA - orderB;
          }
          // في حال عدم تحديده نعتمد على تاريخ الإنشاء
          if (a.created_at && b.created_at) {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
          return 0;
        });
        return g;
      });
  }, [product]);

  // إعادة ضبط واستباق الاختيارات الإلزامية المجانية عند فتح أي وجبة جديدة (100% Isolated State)
  useEffect(() => {
    if (!product) return;
    setQuantity(1);
    setNotes('');
    setValidationAttempted(false);

    const initialSingle: Record<string, ProductOption | null> = {};
    groups.forEach((g) => {
      if (g.selection_type === 'single' && g.min_selection >= 1 && g.options.length > 0) {
        // تفضيل الخيار المجاني أو الأول تلقائياً
        const freeOrFirst = g.options.find((o) => (Number(o.extra_price) || 0) === 0) || g.options[0];
        initialSingle[g.key] = freeOrFirst;
      }
    });

    setSingleSelections(initialSingle);
    setMultiSelections({});
    setQuantitySelections({});
  }, [product?.id]);

  // 2. حساب إجمالي الإضافات بالسعر
  const extraTotal = useMemo(() => {
    let sum = 0;

    // Single
    Object.values(singleSelections).forEach((opt) => {
      if (opt) sum += Number(opt.extra_price) || 0;
    });

    // Multi
    Object.values(multiSelections).forEach((opts) => {
      opts.forEach((opt) => {
        sum += Number(opt.extra_price) || 0;
      });
    });

    // Quantity
    groups.forEach((group) => {
      if (group.selection_type === 'quantity') {
        const groupCounts = quantitySelections[group.key] || {};
        group.options.forEach((opt) => {
          const optKey = opt.id || opt.item_name;
          const count = groupCounts[optKey] || 0;
          if (count > 0) {
            sum += count * (Number(opt.extra_price) || 0);
          }
        });
      }
    });

    return sum;
  }, [singleSelections, multiSelections, quantitySelections, groups]);

  const unitPrice = Number(product?.base_price || 0) + extraTotal;
  const totalPrice = unitPrice * quantity;

  // 3. التحقق من الشروط لكل مجموعة (Validation)
  const validationStatus = useMemo(() => {
    const unfulfilled: string[] = [];

    groups.forEach((g) => {
      if (g.min_selection <= 0) return;

      if (g.selection_type === 'single') {
        if (!singleSelections[g.key]) {
          unfulfilled.push(`${g.title} (مطلوب اختيار واحد)`);
        }
      } else if (g.selection_type === 'multi') {
        const count = multiSelections[g.key]?.length || 0;
        if (count < g.min_selection) {
          unfulfilled.push(`${g.title} (مطلوب على الأقل ${g.min_selection})`);
        }
      } else if (g.selection_type === 'quantity') {
        const counts = quantitySelections[g.key] || {};
        const totalQty = Object.values(counts).reduce((a, b) => a + b, 0);
        if (totalQty < g.min_selection) {
          unfulfilled.push(`${g.title} (مطلوب على الأقل ${g.min_selection})`);
        }
      }
    });

    return {
      isValid: unfulfilled.length === 0,
      unfulfilled,
    };
  }, [groups, singleSelections, multiSelections, quantitySelections]);

  // Handlers
  const handleSelectSingle = (groupKey: string, opt: ProductOption) => {
    setSingleSelections((prev) => {
      // إذا ضغط على نفس الخيار وكان اختياري (min=0) يلغي اختياره
      const group = groups.find((g) => g.key === groupKey);
      if (group && group.min_selection === 0 && prev[groupKey]?.item_name === opt.item_name) {
        return { ...prev, [groupKey]: null };
      }
      return { ...prev, [groupKey]: opt };
    });
  };

  const handleToggleMulti = (group: InternalOptionGroup, opt: ProductOption) => {
    const current = multiSelections[group.key] || [];
    const isAlreadySelected = current.some((o) => (o.id && opt.id ? o.id === opt.id : o.item_name === opt.item_name));

    if (isAlreadySelected) {
      setMultiSelections((prev) => ({
        ...prev,
        [group.key]: current.filter((o) => (o.id && opt.id ? o.id !== opt.id : o.item_name !== opt.item_name)),
      }));
    } else {
      if (current.length >= group.max_selection) return; // تم الوصول للحد الأقصى
      setMultiSelections((prev) => ({
        ...prev,
        [group.key]: [...current, opt],
      }));
    }
  };

  const handleUpdateQuantity = (
    group: InternalOptionGroup,
    opt: ProductOption,
    delta: number
  ) => {
    const optKey = opt.id || opt.item_name;
    const currentCounts = quantitySelections[group.key] || {};
    const currentQty = currentCounts[optKey] || 0;
    const totalGroupQty = Object.values(currentCounts).reduce((a, b) => a + b, 0);

    if (delta > 0) {
      if (currentQty >= group.max_qty_per_item) return; // حد الصنف
      if (totalGroupQty >= group.max_selection) return; // حد المجموعة
    } else {
      if (currentQty <= 0) return;
    }

    const newQty = Math.max(0, currentQty + delta);
    setQuantitySelections((prev) => ({
      ...prev,
      [group.key]: {
        ...(prev[group.key] || {}),
        [optKey]: newQty,
      },
    }));
  };

  // التأكيد والإضافة للسلة
  const handleConfirm = () => {
    setValidationAttempted(true);
    if (!product || !validationStatus.isValid) return;
    if (product.available === 'NO' || product.available === false) return;

    // تجميع الخيارات المحددة بصيغة موحدة
    const selectedOptionsPayload: SelectedCustomOption[] = [];

    // Single
    Object.entries(singleSelections).forEach(([groupName, opt]) => {
      if (opt) {
        selectedOptionsPayload.push({
          id: opt.id,
          group_name: groupName,
          item_name: opt.item_name,
          quantity: 1,
          unit_price: Number(opt.extra_price) || 0,
          total_price: Number(opt.extra_price) || 0,
          selection_type: 'single',
        });
      }
    });

    // Multi
    Object.entries(multiSelections).forEach(([groupName, opts]) => {
      opts.forEach((opt) => {
        selectedOptionsPayload.push({
          id: opt.id,
          group_name: groupName,
          item_name: opt.item_name,
          quantity: 1,
          unit_price: Number(opt.extra_price) || 0,
          total_price: Number(opt.extra_price) || 0,
          selection_type: 'multi',
        });
      });
    });

    // Quantity
    groups.forEach((group) => {
      if (group.selection_type === 'quantity') {
        const counts = quantitySelections[group.key] || {};
        group.options.forEach((opt) => {
          const optKey = opt.id || opt.item_name;
          const count = counts[optKey] || 0;
          if (count > 0) {
            selectedOptionsPayload.push({
              id: opt.id,
              group_name: group.title,
              item_name: opt.item_name,
              quantity: count,
              unit_price: Number(opt.extra_price) || 0,
              total_price: count * (Number(opt.extra_price) || 0),
              selection_type: 'quantity',
            });
          }
        });
      }
    });

    addItem(product, quantity, {
      selectedOptions: selectedOptionsPayload,
      notes: notes.trim() || undefined,
    });

    closeOptionsModal();
    // إعادة تعيين الحالة
    setQuantity(1);
    setSingleSelections({});
    setMultiSelections({});
    setQuantitySelections({});
    setNotes('');
    setValidationAttempted(false);
  };

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full sm:max-w-lg max-h-[92vh] bg-white border border-stone-200/90 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* رأس المودال مع صورة الصنف والاسم */}
        <div className="relative p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-3 min-w-0">
            {product.image_url ? (
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200/80 shadow-xs">
                <Image src={product.image_url} alt={product.name} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 font-bold flex items-center justify-center text-xs shrink-0">
                وجبة
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-black text-stone-900 truncate">{product.name}</h3>
              <p className="text-xs font-black text-red-600 mt-0.5">
                {product.base_price} <span className="text-[10px] text-stone-500 font-bold">ج.م</span>
              </p>
            </div>
          </div>
          <button
            onClick={closeOptionsModal}
            className="w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center active:scale-90 transition-transform shadow-2xs"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* تنبيه بالخيارات المطلوبة إن وُجدت */}
        {validationAttempted && !validationStatus.isValid && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs font-bold text-amber-800 animate-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>يرجى استكمال: {validationStatus.unfulfilled.join('، ')}</span>
          </div>
        )}

        {/* محتوى المجموعات أو شاشة اختيار الكمية للأصناف المباشرة */}
        <div className="p-4 overflow-y-auto space-y-6 text-right flex-1">
          {groups.length === 0 ? (
            <div className="py-2 flex flex-col items-center justify-center text-center space-y-5">
              {product.description && (
                <p className="text-xs text-stone-600 leading-relaxed max-w-sm px-2">
                  {product.description}
                </p>
              )}

              {/* بطاقة اختيار الكمية البارزة والواضحة */}
              <div className="w-full bg-gradient-to-b from-stone-50 to-stone-100/70 border border-stone-200/90 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 shadow-2xs">
                <span className="text-xs font-black text-stone-700">حدد الكمية المطلوبة</span>

                {/* العداد الكبير */}
                <div className="flex items-center gap-4 bg-white px-4 py-2.5 rounded-2xl border border-stone-200/80 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-10 h-10 rounded-xl bg-[#ff2b2b] hover:bg-[#e02424] text-white active:scale-90 flex items-center justify-center shadow-sm shadow-red-500/25 transition-all cursor-pointer"
                    aria-label="زيادة الكمية"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <span className="w-12 text-center text-2xl font-black text-stone-900 select-none">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-200 active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                    aria-label="تقليل الكمية"
                  >
                    <Minus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                <div className="text-xs font-bold text-stone-500">
                  سعر القطعة: <span className="font-black text-stone-800">{product.base_price} ج.م</span>
                  {quantity > 1 && (
                    <span className="text-[#ff2b2b] mr-2 font-black">
                      • الإجمالي: {totalPrice} ج.م
                    </span>
                  )}
                </div>
              </div>

              {/* ملاحظات إضافية */}
              <div className="w-full space-y-1.5 text-right pt-1">
                <label className="text-xs font-black text-stone-800 block">ملاحظات خاصة (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: بدون كاتشب، زيادة مناديل..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-stone-200 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-red-500 shadow-2xs resize-none"
                />
              </div>
            </div>
          ) : (
            <>
              {groups.map((group) => {
            const isSingle = group.selection_type === 'single';
            const isMulti = group.selection_type === 'multi';
            const isQty = group.selection_type === 'quantity';

            // بيانات العداد للمجموعة
            const groupCounts = quantitySelections[group.key] || {};
            const totalGroupQty = Object.values(groupCounts).reduce((a, b) => a + b, 0);
            const isGroupMaxReached = totalGroupQty >= group.max_selection;

            // بيانات الـ Multi للمجموعة
            const selectedMultiItems = multiSelections[group.key] || [];
            const isMultiMaxReached = selectedMultiItems.length >= group.max_selection;

            return (
              <div key={group.key} className="space-y-2.5 bg-stone-50/60 p-3.5 rounded-2xl border border-stone-200/70">
                {/* عنوان المجموعة مع شارة النوع والحدود */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <h4 className="text-xs font-black text-stone-900">{group.title}</h4>
                    {group.min_selection > 0 && (
                      <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                        إلزامي
                      </span>
                    )}
                  </div>

                  {/* معلومات العداد أو الحدود */}
                  <div className="text-[10px] font-bold text-stone-500">
                    {isSingle && group.min_selection > 0 && 'اختر 1'}
                    {isMulti && (
                      <span>
                        تم اختيار {selectedMultiItems.length}
                        {group.max_selection < 90 ? ` من ${group.max_selection}` : ''}
                      </span>
                    )}
                    {isQty && (
                      <span className={isGroupMaxReached ? 'text-amber-600 font-black' : ''}>
                        المجموع: {totalGroupQty}
                        {group.max_selection < 90 ? ` / ${group.max_selection}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* 1. نمط Single Selection (Radio Buttons) */}
                {isSingle && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.options.map((opt) => {
                      const isSelected = singleSelections[group.key]?.item_name === opt.item_name;
                      const extra = Number(opt.extra_price) || 0;

                      return (
                        <button
                          key={opt.id || opt.item_name}
                          type="button"
                          onClick={() => handleSelectSingle(group.key, opt)}
                          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-red-500 bg-red-50 text-red-950 shadow-xs ring-1 ring-red-500/30'
                              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                isSelected ? 'border-red-600 bg-red-600' : 'border-stone-300 bg-white'
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span>{opt.item_name}</span>
                          </div>
                          <span className={extra > 0 ? 'text-amber-600 font-black text-[11px]' : 'text-stone-400 text-[11px]'}>
                            {extra > 0 ? `+${extra} ج.م` : 'مجاناً'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. نمط Multi Selection (Checkboxes) */}
                {isMulti && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.options.map((opt) => {
                      const isSelected = selectedMultiItems.some((o) =>
                        o.id && opt.id ? o.id === opt.id : o.item_name === opt.item_name
                      );
                      const extra = Number(opt.extra_price) || 0;
                      const isDisabled = isMultiMaxReached && !isSelected;

                      return (
                        <button
                          key={opt.id || opt.item_name}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleToggleMulti(group, opt)}
                          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-red-500 bg-red-50 text-red-950 shadow-xs'
                              : isDisabled
                              ? 'border-stone-200 bg-stone-100/50 text-stone-300 cursor-not-allowed opacity-60'
                              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                isSelected ? 'border-red-600 bg-red-600 text-white' : 'border-stone-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span>{opt.item_name}</span>
                          </div>
                          <span className={extra > 0 ? 'text-amber-600 font-black text-[11px]' : 'text-stone-400 text-[11px]'}>
                            {extra > 0 ? `+${extra} ج.م` : 'مجاناً'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. نمط Quantity Selection (العداد الذكي) */}
                {isQty && (
                  <div className="space-y-2">
                    {group.options.map((opt) => {
                      const optKey = opt.id || opt.item_name;
                      const currentItemQty = groupCounts[optKey] || 0;
                      const extra = Number(opt.extra_price) || 0;

                      // شرط الصنف: لا يتعدى max_qty_per_item
                      const isItemMaxReached = currentItemQty >= group.max_qty_per_item;
                      // شرط المجموعة: مجموع كل العدادات لا يتعدى max_selection
                      const isPlusDisabled = isItemMaxReached || isGroupMaxReached;
                      const isMinusDisabled = currentItemQty <= 0;

                      return (
                        <div
                          key={optKey}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                            currentItemQty > 0
                              ? 'bg-red-50/50 border-red-300/80 shadow-2xs'
                              : 'bg-white border-stone-200'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-black text-stone-900 block">{opt.item_name}</span>
                            <span className="text-[11px] text-amber-600 font-bold block">
                              {extra > 0 ? `+${extra} ج.م` : 'مجاناً'}
                              {currentItemQty > 0 && extra > 0 && (
                                <span className="text-stone-500 mr-1.5 font-normal">
                                  (الإجمالي: +{currentItemQty * extra} ج.م)
                                </span>
                              )}
                            </span>
                          </div>

                          {/* أزرار العداد [+] [الكمية] [-] */}
                          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200">
                            <button
                              type="button"
                              disabled={isPlusDisabled}
                              onClick={() => handleUpdateQuantity(group, opt, 1)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                isPlusDisabled
                                  ? 'opacity-30 text-stone-400 cursor-not-allowed'
                                  : 'bg-red-600 text-white hover:bg-red-700 active:scale-90 shadow-xs'
                              }`}
                              aria-label="زيادة"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            <span className="w-6 text-center text-xs font-black text-stone-900">
                              {currentItemQty}
                            </span>

                            <button
                              type="button"
                              disabled={isMinusDisabled}
                              onClick={() => handleUpdateQuantity(group, opt, -1)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                isMinusDisabled
                                  ? 'opacity-30 text-stone-400 cursor-not-allowed'
                                  : 'bg-white text-stone-800 hover:bg-stone-200 active:scale-90 shadow-xs'
                              }`}
                              aria-label="إنقاص"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

              {/* ملاحظات إضافية */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-black text-stone-800 block">ملاحظات خاصة (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: كاتشب زيادة، الصوص في علبة خارجية..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-stone-200 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-red-500 shadow-2xs resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* ذيل المودال (الكمية الإجمالية + السعر + زر الإضافة) */}
        <div className="p-4 border-t border-stone-100 bg-white space-y-3">
          <div className="flex items-center justify-between">
            {/* كمية الوجبة الرئيسية */}
            {groups.length === 0 ? (
              <div className="text-xs font-bold text-stone-600">
                الكمية: <span className="font-black text-stone-900 text-sm">{quantity}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-600">الكمية:</span>
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-7 h-7 rounded-lg bg-white text-stone-800 flex items-center justify-center active:scale-90 shadow-xs cursor-pointer"
                    aria-label="زيادة الكمية"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center text-xs font-black text-stone-900">{quantity}</span>
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded-lg bg-white text-stone-800 disabled:opacity-30 flex items-center justify-center active:scale-90 shadow-xs cursor-pointer"
                    aria-label="تقليل الكمية"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* إجمالي السعر */}
            <div className="text-left">
              <span className="text-[10px] text-stone-400 block font-bold">الإجمالي</span>
              <span className="text-base font-black text-red-600">
                {totalPrice} <span className="text-xs font-bold text-stone-500">ج.م</span>
              </span>
            </div>
          </div>

          {/* زر إضافة للسلة مع التحقق */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full min-h-[46px] rounded-xl font-black text-xs text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 active:scale-[0.98] shadow-md shadow-red-500/20 flex items-center justify-center gap-2 transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>إضافة إلى السلة ({totalPrice} ج.م)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
