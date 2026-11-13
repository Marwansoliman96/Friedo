import type { CartItem } from '@/shared/types';

export interface WhatsAppOrderMessageParams {
  trackingToken: string;
  orderType: 'delivery' | 'pickup';
  customerName: string;
  customerPhone: string;
  areaName?: string;
  addressDetails?: string;
  notes?: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  grandTotal: number;
}

/**
 * تنسيق أرقام المبالغ المالية بالشكل النظيف (بدون كسور غير لازمة)
 */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

/**
 * تنسيق خيارات الصنف مجمعة بحيث تظهر كل مجموعة باسمها ومتبوعة بخياراتها وأعدادها
 */
export function formatItemGroupedOptions(item: CartItem): string[] {
  const selected = item.customizations?.selectedOptions;

  if (selected && selected.length > 0) {
    // تجميع الخيارات حسب اسم المجموعة مع الحفاظ على ترتيب المجموعات
    const groupMap = new Map<string, string[]>();

    selected.forEach((opt) => {
      const groupName = opt.group_name?.trim() || 'خيارات الصنف';
      let text = opt.item_name;

      // 1. حساب وتوضيح كمية الخيار الداخلي
      if (opt.quantity > 1) {
        if (item.quantity > 1) {
          const totalQty = opt.quantity * item.quantity;
          text += ` (×${opt.quantity} للوجبة — إجمالي: ${totalQty})`;
        } else {
          text += ` (×${opt.quantity})`;
        }
      }

      // 2. توضيح السعر الإضافي للخيار إن وجد
      if (opt.total_price > 0) {
        text += ` (+${formatAmount(opt.total_price)} ج)`;
      }

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(text);
    });

    const lines: string[] = [];
    groupMap.forEach((optionsList, groupName) => {
      lines.push(`${groupName}: ${optionsList.join('، ')}`);
    });

    return lines;
  }

  // في حال وجود خيارات قديمة (legacy fallback)
  const legacyLines: string[] = [];
  if (item.customizations?.size) {
    const priceText = item.customizations.size.price > 0 ? ` (+${formatAmount(item.customizations.size.price)} ج)` : '';
    legacyLines.push(`الحجم / الكومبو: ${item.customizations.size.name}${priceText}`);
  }
  if (item.customizations?.sauce) {
    const priceText = item.customizations.sauce.price > 0 ? ` (+${formatAmount(item.customizations.sauce.price)} ج)` : '';
    legacyLines.push(`نوع الصوص: ${item.customizations.sauce.name}${priceText}`);
  }
  if (item.customizations?.extras && item.customizations.extras.length > 0) {
    const extrasText = item.customizations.extras
      .map((ext) => {
        const qty = ext.quantity && ext.quantity > 1 ? ` (×${ext.quantity})` : '';
        const pr = ext.price > 0 ? ` (+${formatAmount(ext.price)} ج)` : '';
        return `${ext.name}${qty}${pr}`;
      })
      .join('، ');
    legacyLines.push(`إضافات: ${extrasText}`);
  }
  if (item.customizations?.removals && item.customizations.removals.length > 0) {
    legacyLines.push(`استبعادات: ${item.customizations.removals.join('، ')}`);
  }

  if (legacyLines.length > 0) {
    return legacyLines;
  }

  if (item.options_summary && item.options_summary.trim()) {
    return [`الخيارات: ${item.options_summary.trim()}`];
  }

  return [];
}

/**
 * دالة مساعدة لتنسيق الخيارات في سطر واحد عند الحاجة
 */
export function formatItemCustomizations(item: CartItem): string {
  const grouped = formatItemGroupedOptions(item);
  return grouped.join(' • ');
}

/**
 * صياغة رسالة الواتساب المتوافقة مع هوية وشكل رسائل مطعم Friedo الأصلية،
 * والمحدثة لتناسب نظام خيارات وأصناف وأكواد تتبع الطلبات الجديدة (Tayaran POS).
 */
export function buildWhatsAppOrderMessage(params: WhatsAppOrderMessageParams): string {
  const {
    trackingToken,
    orderType,
    customerName,
    customerPhone,
    areaName,
    addressDetails,
    notes,
    items,
    subtotal,
    deliveryFee,
    grandTotal,
  } = params;

  let msg = `طلب جديد ✅\n`;

  if (trackingToken) {
    msg += `🏷️ كود الطلب: #${trackingToken}\n\n`;
  } else {
    msg += `\n`;
  }

  if (orderType === 'delivery') {
    msg += `🛵 نوع الطلب: دليفري (توصيل)\n`;
  } else {
    msg += `🏪 نوع الطلب: استلام من الفرع\n`;
  }

  if (customerName?.trim()) {
    msg += `👤 الاسم: ${customerName.trim()}\n`;
  }

  if (customerPhone?.trim()) {
    msg += `📞 الموبايل: ${customerPhone.trim()}\n`;
  }

  if (orderType === 'delivery') {
    if (areaName?.trim()) {
      msg += `📍 المنطقة: ${areaName.trim()}\n`;
    }
    if (addressDetails?.trim()) {
      msg += `🏠 العنوان بالتفصيل: ${addressDetails.trim()}\n`;
    }
  } else {
    msg += `📍 فرع الاستلام: الفرع الرئيسي\n`;
  }

  if (notes?.trim()) {
    msg += `📝 ملاحظات: ${notes.trim()}\n`;
  }

  msg += `\nالطلبات:\n`;

  items.forEach((it) => {
    const formattedItemTotal = formatAmount(it.total_price);
    msg += `${it.quantity}× ${it.product.name} — ${formattedItemTotal} ج\n`;

    // عرض كل مجموعة خيارات باسمها والخيارات التي بداخلها
    const optionLines = formatItemGroupedOptions(it);
    optionLines.forEach((line) => {
      msg += `  ▫️ ${line}\n`;
    });

    // عرض ملاحظة الصنف الخاصة إن وجدت
    const itemNote = it.customizations?.notes;
    if (itemNote && itemNote.trim()) {
      msg += `  (ملاحظة: ${itemNote.trim()})\n`;
    }
  });

  const formattedSubtotal = formatAmount(subtotal);
  const formattedDelivery = formatAmount(deliveryFee);
  const formattedGrandTotal = formatAmount(grandTotal);

  if (orderType === 'delivery') {
    msg += `\n💵 إجمالي المنتجات: ${formattedSubtotal} ج\n`;
    msg += `🛵 خدمة التوصيل: ${formattedDelivery} ج\n`;
    msg += `💰 الإجمالي النهائي: ${formattedGrandTotal} ج\n`;
  } else {
    msg += `\n💰 الإجمالي النهائي: ${formattedGrandTotal} ج\n`;
  }

  msg += `\nشكراً 🙏`;

  return msg;
}

/**
 * تجهيز روابط الواتساب للويب وتطبيقات الموبايل الأصلية
 */
export function buildWhatsAppUrls(phone: string, message: string) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(message);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  const nativeWaUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;

  return { waUrl, nativeWaUrl };
}

/**
 * توجيه العميل إلى الواتساب بسلاسة مع دعم فتح التطبيق المباشر على الهواتف وتخطي حظر النوافذ المنبثقة
 */
export function openWhatsAppCheckout(waUrl: string, nativeWaUrl: string) {
  const isMobile =
    typeof navigator !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024));

  if (isMobile) {
    window.location.href = nativeWaUrl;
  } else {
    try {
      const link = document.createElement('a');
      link.href = waUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(waUrl, '_blank', 'noopener');
    }
  }
}
