'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Bike, Store, Send, CheckCircle2, AlertCircle, MapPin, ChevronDown, Loader2 } from 'lucide-react';
import { useCartStore } from '@/features/cart/store/useCartStore';
import { supabase } from '@/shared/lib/supabase/client';
import { TENANT_ID } from '@/features/menu/services/menuService';
import fallbackData from '@/data/friedo_data.json';
import type { DeliveryArea, RestaurantInfo } from '@/shared/types';
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppUrls,
  openWhatsAppCheckout,
} from '@/features/checkout/utils/whatsappMessage';
import { sendOrderToGoogleSheetFireAndForget } from '@/features/checkout/services/googleSheetService';

/**
 * دالة حساب تاريخ يوم العمل (business_date) لظروف عمل المطعم بعد منتصف الليل
 * إذا كانت الساعة بين 00:00 و 05:00 صباحاً، يُعتبر يوم العمل هو اليوم السابق
 */
const getBusinessDate = (): string => {
  const now = new Date();
  if (now.getHours() < 5) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface CheckoutModalProps {
  deliveryAreas: DeliveryArea[];
  restaurantInfo: RestaurantInfo;
}

/**
 * استخراج وتحويل الأرقام إلى أرقام إنجليزية فقط (0-9).
 */
const extractEnglishDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^0-9]/g, '');

/**
 * تطبيع رقم الهاتف ليقبل الأرقام الإنجليزية فقط (0-9) بحد أقصى 11 رقماً.
 */
const normalizeEnglishPhone = (value: string): string =>
  extractEnglishDigits(value).slice(0, 11);

/**
 * التحقق المتدرج أثناء الكتابة من أن الرقم يبدأ بـ 010 أو 011 أو 012 أو 015.
 */
const isValidPhonePrefixLive = (digits: string): boolean => {
  if (!digits) return true;
  if (digits.length === 1) return digits === '0';
  if (digits.length === 2) return digits === '01';
  return /^01[0125]/.test(digits);
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  deliveryAreas,
  restaurantInfo,
}) => {
  const isCheckoutOpen = useCartStore((s) => s.isCheckoutOpen);
  const setCheckoutOpen = useCartStore((s) => s.setCheckoutOpen);
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const getSubtotal = useCartStore((s) => s.getSubtotal);

  // إعداد قائمة مناطق التوصيل المعتمدة (مع Fallback فوري لجميع الـ 24 منطقة في حال تعذر Supabase)
  const fallbackAreas: DeliveryArea[] = useMemo(() => {
    return ((fallbackData as any).deliveryAreas || []).map((a: any, idx: number) => ({
      id: `area_fb_${idx + 1}`,
      name: a.name,
      fee: Number(a.fee) || 0,
      tenant_id: TENANT_ID,
    }));
  }, []);

  const activeAreas = useMemo(() => {
    return deliveryAreas && deliveryAreas.length > 0 ? deliveryAreas : fallbackAreas;
  }, [deliveryAreas, fallbackAreas]);

  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedArea, setSelectedArea] = useState<DeliveryArea | null>(null);

  // مزامنة المنطقة المختارة تلقائياً واسترجاع بيانات العميل المحفوظة مسبقاً
  useEffect(() => {
    try {
      const saved = localStorage.getItem('friedo_customer_v1');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.name && !customerName) setCustomerName(data.name);
        if (data.phone && !customerPhone) setCustomerPhone(normalizeEnglishPhone(String(data.phone)));
        if (data.address && !addressDetails) setAddressDetails(data.address);
        if (data.orderType) setOrderType(data.orderType);
        if (data.area && activeAreas.length > 0) {
          const matchedArea = activeAreas.find((a) => a.name === data.area);
          if (matchedArea) {
            setSelectedArea(matchedArea);
            return;
          }
        }
      }
    } catch {
      // ignore
    }

    if (!selectedArea && activeAreas.length > 0) {
      setSelectedArea(activeAreas[0]);
    }
  }, [activeAreas, selectedArea]);

  const [addressDetails, setAddressDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [phoneLimitWarning, setPhoneLimitWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [invalidField, setInvalidField] = useState<'name' | 'phone' | 'area' | 'address' | null>(null);
  const [successToken, setSuccessToken] = useState<string | null>(null);
  const [lastOrderWaUrl, setLastOrderWaUrl] = useState<string>('');

  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const areaSelectRef = useRef<HTMLSelectElement>(null);
  const addressInputRef = useRef<HTMLTextAreaElement>(null);

  // إخفاء تنبيه تجاوز الحد الأقصى لرقم الهاتف تلقائياً بعد 3.5 ثوانٍ
  useEffect(() => {
    if (!phoneLimitWarning) return;
    const timer = setTimeout(() => setPhoneLimitWarning(false), 3500);
    return () => clearTimeout(timer);
  }, [phoneLimitWarning]);

  if (!isCheckoutOpen) return null;

  const hasInvalidPhonePrefix = !isValidPhonePrefixLive(customerPhone);
  const subtotal = getSubtotal();
  const deliveryFee = orderType === 'delivery' ? (selectedArea?.fee || 0) : 0;
  const grandTotal = subtotal + deliveryFee;

  const DEFAULT_RESTAURANT_PHONE = '201284843300';
  const targetPhone = (restaurantInfo?.phone || DEFAULT_RESTAURANT_PHONE).replace(/[^0-9]/g, '') || DEFAULT_RESTAURANT_PHONE;

  // إرسال وتأكيد الطلب الموحد: تسجيل فوري في قاعدة البيانات والداشبورد + إرسال للواتساب
  const handleSubmit = async () => {
    // التحقق من الحقول الإلزامية مع التركيز التلقائي على الحقل الناقص
    if (!customerName.trim()) {
      setInvalidField('name');
      setErrorMsg('يرجى كتابة اسمك بالكامل للمتابعة');
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const cleanPhone = normalizeEnglishPhone(customerPhone);
    if (!cleanPhone) {
      setInvalidField('phone');
      setErrorMsg('يرجى كتابة رقم هاتفك للتواصل');
      phoneInputRef.current?.focus();
      phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!/^01[0125]/.test(cleanPhone)) {
      setInvalidField('phone');
      setErrorMsg('رقم الهاتف يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015');
      phoneInputRef.current?.focus();
      phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (cleanPhone.length !== 11) {
      setInvalidField('phone');
      setErrorMsg('يرجى إدخال رقم هاتف مكون من 11 رقماً بالكامل');
      phoneInputRef.current?.focus();
      phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (orderType === 'delivery') {
      if (!selectedArea) {
        setInvalidField('area');
        setErrorMsg('يرجى اختيار منطقة التوصيل من القائمة لتحديد رسوم التوصيل');
        areaSelectRef.current?.focus();
        areaSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!addressDetails.trim() || addressDetails.trim().length < 3) {
        setInvalidField('address');
        setErrorMsg('يرجى كتابة تفاصيل العنوان (الشارع أو العمارة أو رقم الشقة)');
        addressInputRef.current?.focus();
        addressInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    if (items.length === 0) {
      setErrorMsg('سلة الطلبات فارغة، يرجى اختيار وجبة أولاً');
      return;
    }

    const unavailableItem = items.find(
      (it) => it.product.available === 'NO' || it.product.available === false
    );
    if (unavailableItem) {
      setErrorMsg(`عذراً، الصنف "${unavailableItem.product.name}" غير متاح حالياً. يرجى حذفه من السلة للمتابعة.`);
      return;
    }

    setInvalidField(null);
    setErrorMsg('');
    setIsSubmitting(true);

    const trackingToken = 'ORD_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const tenantId = TENANT_ID;

    // تجهيز نص رسالة الواتساب وفق التنسيق المعتمد لمطعم Friedo وشكل الطلبات الجديد
    const rawMessage = buildWhatsAppOrderMessage({
      trackingToken,
      orderType,
      customerName,
      customerPhone,
      areaName: selectedArea?.name,
      addressDetails,
      notes,
      items,
      subtotal,
      deliveryFee,
      grandTotal,
    });

    const { waUrl, nativeWaUrl } = buildWhatsAppUrls(targetPhone, rawMessage);
    setLastOrderWaUrl(waUrl);

    try {
      // 1. تسجيل الطلب في Google Sheet (Fire-and-Forget بدون أي تعطيل للواجهة)
      sendOrderToGoogleSheetFireAndForget({
        trackingToken,
        customerName,
        customerPhone,
        orderType,
        area: selectedArea?.name,
        address: addressDetails,
        deliveryFee,
        notes,
        items,
        subtotal,
        grandTotal,
      });

      // 2. تسجيل الطلب في جدول orders بالداشبورد في Supabase
      const orderPayload: any = {
        tenant_id: tenantId,
        order_number: trackingToken,
        tracking_token: trackingToken,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        order_type: orderType,
        delivery_area: orderType === 'delivery' ? selectedArea?.name : null,
        delivery_address: orderType === 'delivery' ? addressDetails.trim() : null,
        delivery_fee: deliveryFee,
        subtotal,
        total_price: grandTotal,
        notes: notes.trim() || null,
        status: 'pending',
        payment_method: 'cash',
        payment_status: 'pending',
        business_date: getBusinessDate(),
      };

      // إدراج الطلب مع مهلة أمان قصيرة لتفادي أي تعليق شبكة
      const insertPromise = supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 3500)
      );

      const { data: orderData } = await Promise.race([insertPromise, timeoutPromise]);

      // 2. تسجيل أصناف الطلب في جدول order_items إن وُجد المعرف
      if (orderData?.id) {
        const orderItemsPayload = items.map((it) => ({
          tenant_id: tenantId,
          order_id: orderData.id,
          product_name: it.product.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
          customizations: it.customizations || {},
          options_summary: it.options_summary || '',
        }));

        await supabase.from('order_items').insert(orderItemsPayload);
      }
    } catch (err) {
      console.warn('Notice saving order to Supabase:', err);
    } finally {
      setIsSubmitting(false);
      setSuccessToken(trackingToken);
      clearCart();

      // حفظ بيانات العميل لتسهيل الطلبات القادمة
      try {
        localStorage.setItem(
          'friedo_customer_v1',
          JSON.stringify({
            name: customerName.trim(),
            phone: customerPhone.trim(),
            address: addressDetails.trim(),
            area: selectedArea?.name || '',
            orderType,
          })
        );
      } catch {
        // ignore
      }

      // 3. فتح وتوجيه العميل للواتساب بشكل فوري وموثوق يتجاوز حظر النوافذ المنبثقة
      openWhatsAppCheckout(waUrl, nativeWaUrl);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setCheckoutOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md max-h-[95vh] bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
      >
        {/* الهيدر */}
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
          <h3 className="text-base font-black text-stone-900">إتمام الطلب</h3>
          <button
            type="button"
            onClick={() => setCheckoutOpen(false)}
            aria-label="إغلاق نافذة إتمام الطلب"
            className="w-11 h-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {successToken ? (
          /* شاشة تأكيد النجاح */
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-stone-900">تم استلام طلبك بنجاح!</h4>
              <p className="text-xs text-stone-500 leading-relaxed">
                تم تسجيل الطلب في سيستم المطعم، وجارٍ التواصل معك للتأكيد والتوصيل بأسرع وقت.
              </p>
            </div>

            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-0.5">
              <span className="text-[11px] text-stone-400 block font-bold">كود الطلب</span>
              <span className="text-lg font-black text-red-600 font-mono tracking-wider">
                {successToken}
              </span>
            </div>

            {lastOrderWaUrl && (
              <a
                href={lastOrderWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[46px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>فتح محادثة الواتساب ومتابعة الطلب</span>
              </a>
            )}

            <button
              onClick={() => {
                setSuccessToken(null);
                setCheckoutOpen(false);
              }}
              className="w-full min-h-[42px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all"
            >
              العودة للمنيو الرئيسي
            </button>
          </div>
        ) : (
          /* نموذج البيانات */
          <div className="p-4 overflow-y-auto space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* نوع الطلب (توصيل / استلام) */}
            <div className="grid grid-cols-2 gap-2 bg-stone-50 p-1 rounded-2xl border border-stone-200">
              <button
                type="button"
                onClick={() => setOrderType('delivery')}
                className={`min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  orderType === 'delivery'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <Bike className="w-4 h-4" />
                <span>توصيل منزلي</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderType('pickup')}
                className={`min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  orderType === 'pickup'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>استلام من الفرع</span>
              </button>
            </div>

            {/* الاسم ورقم الهاتف */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">اسمك بالكامل *</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (invalidField === 'name') {
                      setInvalidField(null);
                      setErrorMsg('');
                    }
                  }}
                  placeholder="مثال: أحمد محمد"
                  className={`w-full bg-stone-50 border rounded-xl px-3 py-2.5 text-xs text-stone-900 placeholder-zinc-600 focus:outline-none transition-all ${
                    invalidField === 'name'
                      ? 'border-red-500 ring-2 ring-red-500/30 bg-red-50/30 animate-pulse'
                      : 'border-stone-200 focus:border-red-500'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700">رقم الهاتف *</label>
                  <span
                    className={`text-[11px] font-bold tabular-nums ${
                      hasInvalidPhonePrefix || invalidField === 'phone'
                        ? 'text-red-600'
                        : phoneLimitWarning
                          ? 'text-amber-600'
                          : customerPhone.length === 11
                            ? 'text-emerald-600'
                            : 'text-stone-400'
                    }`}
                  >
                    {customerPhone.length}/11
                  </span>
                </div>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  lang="en"
                  dir={customerPhone ? 'ltr' : 'rtl'}
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    const rawDigits = extractEnglishDigits(e.target.value);
                    if (rawDigits.length > 11) {
                      setPhoneLimitWarning(true);
                    } else if (rawDigits.length < 11) {
                      setPhoneLimitWarning(false);
                    }
                    setCustomerPhone(rawDigits.slice(0, 11));
                    if (invalidField === 'phone') {
                      setInvalidField(null);
                      setErrorMsg('');
                    }
                  }}
                  placeholder="مثال: 01012345678"
                  className={`w-full bg-stone-50 border rounded-xl px-3 py-2.5 text-xs text-stone-900 placeholder-zinc-600 focus:outline-none text-right tabular-nums transition-colors ${
                    hasInvalidPhonePrefix || invalidField === 'phone'
                      ? 'border-red-500 focus:border-red-600 bg-red-50/40 ring-2 ring-red-500/30 animate-pulse'
                      : phoneLimitWarning
                        ? 'border-amber-500 focus:border-amber-600 bg-amber-50/40'
                        : 'border-stone-200 focus:border-red-500'
                  }`}
                />
                {hasInvalidPhonePrefix && (
                  <p
                    role="alert"
                    className="mt-1.5 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>رقم الهاتف يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015</span>
                  </p>
                )}
                {phoneLimitWarning && (
                  <p
                    role="alert"
                    className="mt-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>الحد الأقصى لرقم الهاتف هو 11 رقماً فقط</span>
                  </p>
                )}
              </div>

              {/* إذا كان توصيل: اختيار منطقة التوصيل من القائمة لتحديد السعر بدقة والعنوان التفصيلي */}
              {orderType === 'delivery' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-red-600" />
                        <span>منطقة التوصيل *</span>
                      </label>
                      {selectedArea && (
                        <span className="text-[11px] font-black text-red-600 bg-red-50 border border-red-200/80 px-2 py-0.5 rounded-lg">
                          رسوم التوصيل: {selectedArea.fee} ج.م
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <select
                        ref={areaSelectRef}
                        value={selectedArea?.name || ''}
                        onChange={(e) => {
                          const area = activeAreas.find((a) => a.name === e.target.value);
                          if (area) setSelectedArea(area);
                          if (invalidField === 'area') {
                            setInvalidField(null);
                            setErrorMsg('');
                          }
                        }}
                        className={`w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-900 focus:outline-none focus:bg-white shadow-2xs cursor-pointer appearance-none pl-9 transition-all ${
                          invalidField === 'area'
                            ? 'border-red-500 ring-2 ring-red-500/30 bg-red-50/30 animate-pulse'
                            : 'border-stone-200 focus:border-red-500'
                        }`}
                      >
                        {activeAreas.map((a) => (
                          <option key={a.id || a.name} value={a.name}>
                            📍 {a.name} — ({a.fee} ج.م توصيل)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-stone-500 mt-1">
                      يتم تحديد رسوم التوصيل وإضافتها لإجمالي الحساب تلقائياً بناءً على المنطقة المختارة
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">العنوان التفصيلي *</label>
                    <textarea
                      ref={addressInputRef}
                      value={addressDetails}
                      onChange={(e) => {
                        setAddressDetails(e.target.value);
                        if (invalidField === 'address') {
                          setInvalidField(null);
                          setErrorMsg('');
                        }
                      }}
                      placeholder="اسم الشارع، رقم العمارة، رقم الشقة، علامة مميزة..."
                      rows={2}
                      className={`w-full bg-stone-50 border rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:bg-white resize-none shadow-2xs transition-all ${
                        invalidField === 'address'
                          ? 'border-red-500 ring-2 ring-red-500/30 bg-red-50/30 animate-pulse'
                          : 'border-stone-200 focus:border-red-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* ملاحظات إضافية على الطلب */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  ملاحظات إضافية على الطلب (اختياري)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي ملاحظات خاصة بالتوصيل أو الاستلام..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-900 placeholder-zinc-600 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* ملخص الحساب */}
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-600 font-medium">
                <span>المجموع الفرعي</span>
                <span className="font-bold text-stone-900">{subtotal} ج.م</span>
              </div>
              {orderType === 'delivery' && (
                <div className="flex justify-between text-stone-600 font-medium">
                  <span>رسوم التوصيل ({selectedArea?.name || ''})</span>
                  <span className="font-bold text-red-600">+{deliveryFee} ج.م</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-stone-900 pt-2 border-t border-stone-200">
                <span>الإجمالي النهائي</span>
                <span className="text-red-600 text-base">{grandTotal} ج.م</span>
              </div>
            </div>

            {/* زر التأكيد الموحد (داشبورد + واتساب في نفس اللحظة) */}
            <div className="space-y-2 pt-1.5">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 animate-bounce shadow-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className={`w-full min-h-[50px] bg-gradient-to-r from-[#ff2b2b] to-[#e02424] hover:from-[#ff3d3d] hover:to-[#ff2b2b] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-red-600/30 active:scale-95 transition-all duration-150 cursor-pointer ${
                  isSubmitting ? 'opacity-85 cursor-wait' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جارٍ تجهيز طلبك وفتح الواتساب...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>تأكيد الطلب وإرسال عبر الواتساب</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-stone-500 font-medium">
                ⚡ يتم تسجيل الطلب فوراً في نظام المطعم وتأكيده معك عبر الواتساب
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
