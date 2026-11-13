import type { CartItem } from '@/shared/types';
import { formatItemCustomizations } from '../utils/whatsappMessage';

const env = (import.meta.env || {}) as Record<string, string | undefined>;

export const DEFAULT_SHEET_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbwQaeNMjx-tYVAQYI8_R9OOOqj1P5m5go-llqZSZjPN0Bn5drpIu0SfYbyqEo8Rq2i5DA/exec';

export const SHEET_WEBAPP_URL =
  env.VITE_GOOGLE_SHEET_WEBAPP_URL || DEFAULT_SHEET_WEBAPP_URL;

export interface GoogleSheetOrderPayload {
  orderNumber: string;
  trackingToken: string;
  customerName: string;
  customerPhone: string;
  area: string;
  address: string;
  deliveryFee: number;
  note: string;
  orderType: string;
  items: Array<{
    name: string;
    productName: string;
    qty: number;
    priceText: string;
    priceNum: number;
    unitPrice: number;
    section: string;
    options: string;
    note: string;
  }>;
  itemsText: string;
  totalNumeric: number;
  grandTotal: number;
  userAgent: string;
  pageUrl: string;
  createdAt: string;
}

export interface BuildSheetParams {
  trackingToken: string;
  customerName: string;
  customerPhone: string;
  orderType: 'delivery' | 'pickup';
  area?: string;
  address?: string;
  deliveryFee: number;
  notes?: string;
  items: CartItem[];
  subtotal: number;
  grandTotal: number;
}

// حماية ضد التكرار (Deduplication) خلال 15 ثانية
let lastSentSignature = '';
let lastSentTime = 0;

/**
 * تجهيز بيانات الطلب المتوافقة مع Google Sheets
 */
export function buildGoogleSheetPayload(params: BuildSheetParams): GoogleSheetOrderPayload {
  const {
    trackingToken,
    customerName,
    customerPhone,
    orderType,
    area = '',
    address = '',
    deliveryFee,
    notes = '',
    items: cartItems,
    subtotal,
    grandTotal,
  } = params;

  const finalAddress =
    orderType === 'delivery'
      ? address.trim()
      : 'الفرع الرئيسي (استلام من الفرع)';

  const items = cartItems.map((it) => {
    const optionsText = formatItemCustomizations(it);
    const fullName = optionsText ? `${it.product.name} (${optionsText})` : it.product.name;
    const itemNote = it.customizations?.notes?.trim() || '';

    return {
      name: fullName,
      productName: it.product.name,
      qty: it.quantity,
      priceText: `${it.total_price} ج`,
      priceNum: it.total_price,
      unitPrice: it.unit_price,
      section: it.product.category || '',
      options: optionsText,
      note: itemNote,
    };
  });

  const itemsText = cartItems
    .map((it) => {
      const optionsText = formatItemCustomizations(it);
      const noteText = it.customizations?.notes?.trim()
        ? ` [ملاحظة: ${it.customizations.notes.trim()}]`
        : '';
      const optsText = optionsText ? ` [${optionsText}]` : '';
      return `${it.quantity}× ${it.product.name}${optsText} — ${it.total_price} ج${noteText}`;
    })
    .join('\n');

  return {
    orderNumber: trackingToken,
    trackingToken,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    area: orderType === 'delivery' ? area.trim() : '',
    address: finalAddress,
    deliveryFee: Number(deliveryFee) || 0,
    note: notes.trim(),
    orderType: orderType === 'delivery' ? 'دليفري' : 'استلام من الفرع',
    items,
    itemsText,
    totalNumeric: subtotal,
    grandTotal,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    createdAt: new Date().toISOString(),
  };
}

/**
 * إرسال الطلب إلى Google Sheet بنمط Fire-and-Forget:
 * - تجربة navigator.sendBeacon أولاً لتجنب حظر التوجيه وضمان وصول الطلب
 * - ثم fetch(mode: 'no-cors', keepalive: true) كبديل فوري آمن
 */
export function sendOrderToGoogleSheetFireAndForget(params: BuildSheetParams): boolean {
  try {
    if (!SHEET_WEBAPP_URL || !SHEET_WEBAPP_URL.includes('/exec')) {
      return false;
    }

    const payload = buildGoogleSheetPayload(params);
    const orderSignature = `${params.customerPhone}_${params.customerName}_${payload.grandTotal}_${params.items.length}`;
    const now = Date.now();

    // منع تكرار نفس الطلب خلال 15 ثانية
    if (lastSentSignature === orderSignature && now - lastSentTime < 15000) {
      return true;
    }

    lastSentSignature = orderSignature;
    lastSentTime = now;

    const body = JSON.stringify(payload);

    // 1. sendBeacon
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const ok = navigator.sendBeacon(
          SHEET_WEBAPP_URL,
          new Blob([body], { type: 'text/plain;charset=utf-8' })
        );
        if (ok) return true;
      }
    } catch {
      // الانتقال للـ fallback
    }

    // 2. fetch (no-cors + keepalive)
    try {
      fetch(SHEET_WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        keepalive: true,
      });
      return true;
    } catch {
      // ignore
    }

    return false;
  } catch (err) {
    console.warn('Notice sending order to Google Sheet:', err);
    return false;
  }
}

