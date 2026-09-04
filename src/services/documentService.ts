import jsPDF from 'jspdf';
import type {
  Order,
  OrderItem,
  Payment,
  ProductionOrder,
  Client,
  CompanyInfo,
  StockItem
} from '../types';

export function formatCurrency(amount: number): string {
  return `${Number(amount || 0).toLocaleString('fr-DZ')} DA`;
}

export function formatDateFr(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Safely loads the logo as a Data URL for jsPDF embedding (works offline and in browser)
 */
async function loadLogoDataUrl(customLogo?: string): Promise<string | null> {
  const src = customLogo || '/otm-door-logo.png';
  if (src.startsWith('data:image')) {
    return src;
  }
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 120;
        canvas.height = img.height || 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
          return;
        }
      } catch {}
      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadLogoImage(logoDataUrl?: string | null): Promise<HTMLImageElement | null> {
  if (!logoDataUrl || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoDataUrl;
  });
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Renders the Arabic copy of an Order / Quote (A4 resolution @ 200dpi: 1654 x 2339)
 */
async function renderArabicOrderCanvas(
  order: Order,
  items: OrderItem[],
  company?: CompanyInfo,
  isQuote: boolean = false
): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1654;
  canvas.height = 2339;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top Accent Bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, 50);

  // Company logo (top right)
  const logoData = await loadLogoDataUrl(company?.logo);
  const logoImg = await loadLogoImage(logoData);
  if (logoImg) {
    try {
      ctx.drawImage(logoImg, canvas.width - 200, 70, 120, 120);
    } catch {}
  }

  // Company details in Arabic (RTL)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.direction = 'rtl';
  const headerTextRight = logoImg ? canvas.width - 220 : canvas.width - 80;

  ctx.font = 'bold 36px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(company?.name || 'شركة OTM DOOR', headerTextRight, 75);

  ctx.font = 'normal 19px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('صناعة وبيع الأبواب الداخلية والخارجية (WPC - MDF - PVC)', headerTextRight, 125);

  const addressLine = [company?.address, company?.commune, company?.wilaya].filter(Boolean).join('، ') || 'المنطقة الصناعية - الجزائر';
  ctx.fillText(addressLine, headerTextRight, 155);

  const phoneLine = `الهاتف: ${company?.phone1 || '0555 00 00 00'} ${company?.phone2 ? ' / ' + company.phone2 : ''} — البريد: ${company?.email || 'contact@otmdoor.com'}`;
  ctx.fillText(phoneLine, headerTextRight, 185);

  // Document Box (Left side)
  ctx.fillStyle = '#f1f5f9';
  drawRoundRect(ctx, 80, 70, 480, 145, 12);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.font = 'bold 28px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(isQuote ? 'عرض أسعار تقديري / فاتورة شكلية' : 'وصل طلبية / استمارة طلبية', 320, 90);

  ctx.font = 'bold 23px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#c59b27';
  ctx.fillText(isQuote ? `DEV-${order.orderNumber}` : `BC-${order.orderNumber}`, 320, 135);

  ctx.font = 'normal 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(`التاريخ : ${formatDateFr(order.date)}`, 320, 175);

  // Client Box
  let y = 255;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, 80, y, 1494, 135, 10);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.font = 'bold 21px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('معلومات الزبون', 1540, y + 15);

  ctx.font = 'normal 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`الزبون : ${order.clientNameSnapshot}`, 1540, y + 55);
  ctx.fillText(`الهاتف : ${order.clientPhoneSnapshot || 'غير محدد'}`, 1540, y + 95);

  ctx.fillText(`العنوان : ${order.clientAddressSnapshot || 'غير محدد'}`, 800, y + 55);
  ctx.fillText(`تاريخ التسليم المتوقع : ${order.expectedDate ? formatDateFr(order.expectedDate) : 'حسب الاتفاق'}`, 800, y + 95);

  // Items Table
  y = 425;
  const startX = 80;
  const tableWidth = 1494;
  const colWidths = [70, 240, 150, 180, 200, 180, 110, 174, 190];
  const headers = ['رقم', 'النموذج', 'المادة', 'اللون', 'المقاسات (سم)', 'نوع الإطار', 'الكمية', 'السعر الفردي', 'المجموع'];

  // Table Header bar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(startX, y, tableWidth, 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Amiri", Arial, sans-serif';
  ctx.textAlign = 'center';

  let curX = startX;
  headers.forEach((h, idx) => {
    ctx.fillText(h, curX + colWidths[idx] / 2, y + 14);
    curX += colWidths[idx];
  });

  y += 50;

  // Rows
  ctx.font = 'normal 17px "Amiri", Arial, sans-serif';
  items.forEach((item, index) => {
    const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillStyle = rowBg;
    ctx.fillRect(startX, y, tableWidth, 48);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, y, tableWidth, 48);

    curX = startX;
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';

    // 0: N°
    ctx.fillText(String(index + 1), curX + colWidths[0] / 2, y + 14);
    curX += colWidths[0];

    // 1: Model
    ctx.fillText(item.modelRefSnapshot || 'P-001', curX + colWidths[1] / 2, y + 14);
    curX += colWidths[1];

    // 2: Material
    ctx.fillText(item.materialName || 'WPC', curX + colWidths[2] / 2, y + 14);
    curX += colWidths[2];

    // 3: Colour
    ctx.fillText(item.colourNameSnapshot || 'قياسي', curX + colWidths[3] / 2, y + 14);
    curX += colWidths[3];

    // 4: Dimensions
    ctx.fillText(`${item.width} × ${item.height} سم`, curX + colWidths[4] / 2, y + 14);
    curX += colWidths[4];

    // 5: Frame
    ctx.fillText(item.frameNameSnapshot || '—', curX + colWidths[5] / 2, y + 14);
    curX += colWidths[5];

    // 6: Quantity
    ctx.fillText(String(item.quantity), curX + colWidths[6] / 2, y + 14);
    curX += colWidths[6];

    // 7: Unit Price
    ctx.fillText(`${item.unitPrice.toLocaleString('fr-DZ')} دج`, curX + colWidths[7] / 2, y + 14);
    curX += colWidths[7];

    // 8: Line Total
    const lineTotal = (item.unitPrice || 0) * (item.quantity || 1);
    ctx.fillText(`${lineTotal.toLocaleString('fr-DZ')} دج`, curX + colWidths[8] / 2, y + 14);

    y += 48;
  });

  // Totals Section
  y += 25;
  const totalsBoxX = 80;
  const totalsBoxW = 600;

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  drawRoundRect(ctx, totalsBoxX, y, totalsBoxW, 190, 10);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.font = 'normal 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('المجموع الجزئي :', totalsBoxX + totalsBoxW - 20, y + 20);
  ctx.fillText(`${order.subtotal.toLocaleString('fr-DZ')} دج`, totalsBoxX + 40, y + 20);

  if (order.discount && order.discount > 0) {
    ctx.fillText('تخفيض استثنائي :', totalsBoxX + totalsBoxW - 20, y + 55);
    ctx.fillText(`- ${order.discount.toLocaleString('fr-DZ')} دج`, totalsBoxX + 40, y + 55);
  }

  // Total amount highlight
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(totalsBoxX + 10, y + 85, totalsBoxW - 20, 42);

  ctx.font = 'bold 20px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('المجموع الإجمالي للطلبية :', totalsBoxX + totalsBoxW - 20, y + 95);
  ctx.fillText(`${order.totalAmount.toLocaleString('fr-DZ')} دج`, totalsBoxX + 40, y + 95);

  ctx.font = 'bold 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#15803d';
  ctx.fillText('المبلغ المدفوع / التسبيق :', totalsBoxX + totalsBoxW - 20, y + 145);
  ctx.fillText(`${order.paidAmount.toLocaleString('fr-DZ')} دج`, totalsBoxX + 40, y + 145);

  // Remaining Box
  y += 215;
  ctx.fillStyle = '#fef2f2';
  ctx.strokeStyle = '#fca5a5';
  drawRoundRect(ctx, totalsBoxX, y, totalsBoxW, 55, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 21px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#b91c1c';
  ctx.fillText('الباقي للدفع :', totalsBoxX + totalsBoxW - 20, y + 15);
  ctx.fillText(`${order.remainingAmount.toLocaleString('fr-DZ')} دج`, totalsBoxX + 40, y + 15);

  // Observations
  if (order.notes) {
    y = Math.max(y + 80, 1750);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px "Amiri", Arial, sans-serif';
    ctx.fillText('ملاحظات خاصة :', canvas.width - 100, y);
    ctx.font = 'normal 17px "Amiri", Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(order.notes, canvas.width - 100, y + 30);
  }

  // Signatures
  const signY = 2050;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(canvas.width - 450, signY);
  ctx.lineTo(canvas.width - 100, signY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(100, signY);
  ctx.lineTo(450, signY);
  ctx.stroke();

  ctx.font = 'bold 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('إمضاء وموافقة الزبون', canvas.width - 275, signY + 15);
  ctx.fillText('ختم وتأشيرة شركة OTM DOOR', 275, signY + 15);

  // Footer
  ctx.font = 'normal 16px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('OTM DOOR — صناعة الأبواب الداخلية والخارجية عالية الجودة — وثيقة مستخرجة إلكترونياً (النسخة العربية)', canvas.width / 2, 2280);

  return canvas.toDataURL('image/png');
}

/**
 * Renders the Arabic copy of Delivery Note (A4 resolution @ 200dpi: 1654 x 2339)
 */
async function renderArabicDeliveryNoteCanvas(
  order: Order,
  items: OrderItem[],
  company?: CompanyInfo
): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1654;
  canvas.height = 2339;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, 50);

  const logoData = await loadLogoDataUrl(company?.logo);
  const logoImg = await loadLogoImage(logoData);
  if (logoImg) {
    try {
      ctx.drawImage(logoImg, canvas.width - 200, 70, 120, 120);
    } catch {}
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.direction = 'rtl';
  const headerTextRight = logoImg ? canvas.width - 220 : canvas.width - 80;

  ctx.font = 'bold 36px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(company?.name || 'شركة OTM DOOR', headerTextRight, 75);

  ctx.font = 'normal 19px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('صناعة وبيع الأبواب الداخلية والخارجية (WPC - MDF - PVC)', headerTextRight, 125);

  const addressLine = [company?.address, company?.commune, company?.wilaya].filter(Boolean).join('، ') || 'المنطقة الصناعية - الجزائر';
  ctx.fillText(addressLine, headerTextRight, 155);

  const phoneLine = `الهاتف: ${company?.phone1 || '0555 00 00 00'} ${company?.phone2 ? ' / ' + company.phone2 : ''}`;
  ctx.fillText(phoneLine, headerTextRight, 185);

  // Document Box (Left)
  ctx.fillStyle = '#f1f5f9';
  drawRoundRect(ctx, 80, 70, 480, 145, 12);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.font = 'bold 28px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('وصل تسليم بضاعة', 320, 90);

  ctx.font = 'bold 23px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#c59b27';
  ctx.fillText(`BL-${order.orderNumber}`, 320, 135);

  ctx.font = 'normal 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(`التاريخ : ${formatDateFr(new Date().toISOString())}`, 320, 175);

  // Client Box
  let y = 255;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, 80, y, 1494, 135, 10);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.font = 'bold 21px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('معلومات المستلم / الزبون', 1540, y + 15);

  ctx.font = 'normal 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`الزبون : ${order.clientNameSnapshot}`, 1540, y + 55);
  ctx.fillText(`الهاتف : ${order.clientPhoneSnapshot || 'غير محدد'}`, 1540, y + 95);

  ctx.fillText(`عنوان التسليم : ${order.clientAddressSnapshot || 'غير محدد'}`, 800, y + 55);
  ctx.fillText(`رقم الطلبية الأصلية : ${order.orderNumber}`, 800, y + 95);

  // Table
  y = 425;
  const startX = 80;
  const tableWidth = 1494;
  const colWidths = [80, 270, 200, 240, 270, 274, 160];
  const headers = ['رقم', 'النموذج', 'المادة', 'اللون', 'المقاسات (سم)', 'نوع الإطار', 'الكمية المسلمة'];

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(startX, y, tableWidth, 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Amiri", Arial, sans-serif';
  ctx.textAlign = 'center';

  let curX = startX;
  headers.forEach((h, idx) => {
    ctx.fillText(h, curX + colWidths[idx] / 2, y + 14);
    curX += colWidths[idx];
  });

  y += 50;

  ctx.font = 'normal 17px "Amiri", Arial, sans-serif';
  items.forEach((item, index) => {
    const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillStyle = rowBg;
    ctx.fillRect(startX, y, tableWidth, 48);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, y, tableWidth, 48);

    curX = startX;
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';

    ctx.fillText(String(index + 1), curX + colWidths[0] / 2, y + 14);
    curX += colWidths[0];

    ctx.fillText(item.modelRefSnapshot || 'P-001', curX + colWidths[1] / 2, y + 14);
    curX += colWidths[1];

    ctx.fillText(item.materialName || 'WPC', curX + colWidths[2] / 2, y + 14);
    curX += colWidths[2];

    ctx.fillText(item.colourNameSnapshot || 'قياسي', curX + colWidths[3] / 2, y + 14);
    curX += colWidths[3];

    ctx.fillText(`${item.width} × ${item.height} سم`, curX + colWidths[4] / 2, y + 14);
    curX += colWidths[4];

    ctx.fillText(item.frameNameSnapshot || '—', curX + colWidths[5] / 2, y + 14);
    curX += colWidths[5];

    ctx.fillText(`${item.quantity} باب`, curX + colWidths[6] / 2, y + 14);

    y += 48;
  });

  // Delivery statement
  y += 35;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  drawRoundRect(ctx, startX, y, tableWidth, 80, 8);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.font = 'bold 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('إقرار استلام البضاعة :', startX + tableWidth - 30, y + 15);

  ctx.font = 'normal 17px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('أقر أنا الموقع أسفله أنني استلمت كامل البضاعة والكميات المبينة أعلاه بحالة ممتازة ومطابقة للمواصفات.', startX + tableWidth - 30, y + 45);

  // Signatures
  const signY = 2050;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(canvas.width - 450, signY);
  ctx.lineTo(canvas.width - 100, signY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(100, signY);
  ctx.lineTo(450, signY);
  ctx.stroke();

  ctx.font = 'bold 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('إمضاء واستلام الزبون (استلمت بحالة جيدة)', canvas.width - 275, signY + 15);
  ctx.fillText('تأشيرة ومصلحة التسليم OTM DOOR', 275, signY + 15);

  // Footer
  ctx.font = 'normal 16px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('OTM DOOR — وصل تسليم رسمي مطابق للقانون التجاري (النسخة العربية)', canvas.width / 2, 2280);

  return canvas.toDataURL('image/png');
}

/**
 * Renders the Arabic copy of Payment Receipt (A5 resolution @ 200dpi: 1165 x 1654)
 */
async function renderArabicPaymentReceiptCanvas(
  payment: Payment,
  order?: Order,
  company?: CompanyInfo
): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1165;
  canvas.height = 1654;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, 45);

  const logoData = await loadLogoDataUrl(company?.logo);
  const logoImg = await loadLogoImage(logoData);
  if (logoImg) {
    try {
      ctx.drawImage(logoImg, canvas.width - 150, 65, 90, 90);
    } catch {}
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.direction = 'rtl';
  const headerTextRight = logoImg ? canvas.width - 170 : canvas.width - 60;

  ctx.font = 'bold 28px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(company?.name || 'شركة OTM DOOR', headerTextRight, 65);

  ctx.font = 'normal 16px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('وصل دفع وقبض مالي معتمد', headerTextRight, 105);

  // Receipt Box
  let y = 175;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, 60, y, 1045, 340, 10);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 20px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.fillText(`رقم الوصل : ${payment.receiptNumber}`, 1070, y + 25);
  ctx.fillText(`التاريخ : ${formatDateFr(payment.date)}`, 300, y + 25);

  ctx.font = 'normal 18px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`اسم الزبون : ${payment.clientNameSnapshot}`, 1070, y + 75);
  ctx.fillText(`الطلبية المرتبطة : ${payment.orderNumberSnapshot}`, 1070, y + 120);

  const paymentMethodAr =
    payment.paymentMethod === 'Espèces'
      ? 'نقداً (كاش)'
      : payment.paymentMethod === 'Virement'
      ? 'تحويل بنكي'
      : payment.paymentMethod === 'CCP'
      ? 'حساب بريدي جاري CCP'
      : (payment.paymentMethod as string);

  ctx.fillText(`طريقة الدفع : ${paymentMethodAr}`, 1070, y + 165);
  if (payment.reference) {
    ctx.fillText(`المرجع / الشيك : ${payment.reference}`, 1070, y + 210);
  }

  // Amount badge
  ctx.fillStyle = '#f0fdf4';
  ctx.strokeStyle = '#86efac';
  drawRoundRect(ctx, 80, y + 250, 1005, 65, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 22px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#15803d';
  ctx.fillText('المبلغ المقبوض :', 1050, y + 270);
  ctx.fillText(`${payment.amount.toLocaleString('fr-DZ')} دج`, 300, y + 270);

  // Order summary if available
  if (order) {
    y = 545;
    ctx.font = 'normal 17px "Amiri", Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(`إجمالي قيمة الطلبية : ${order.totalAmount.toLocaleString('fr-DZ')} دج`, 1070, y);
    ctx.fillText(`مجموع المدفوعات حتى الآن : ${order.paidAmount.toLocaleString('fr-DZ')} دج`, 1070, y + 35);

    ctx.font = 'bold 18px "Amiri", Arial, sans-serif';
    ctx.fillStyle = '#b91c1c';
    ctx.fillText(`الرصيد المتبقي للدفع : ${order.remainingAmount.toLocaleString('fr-DZ')} دج`, 1070, y + 75);
  }

  // Signature
  const signY = 1420;
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(canvas.width - 380, signY);
  ctx.lineTo(canvas.width - 80, signY);
  ctx.stroke();

  ctx.font = 'bold 16px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('ختم وتأشيرة أمين الصندوق OTM DOOR', canvas.width - 230, signY + 15);

  // Footer
  ctx.font = 'normal 15px "Amiri", Arial, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('OTM DOOR — وصل دفع معتمد وإثبات رسمي للمعاملة المالية (النسخة العربية)', canvas.width / 2, 1600);

  return canvas.toDataURL('image/png');
}

export async function generateOrderPdf(
  order: Order,
  items: OrderItem[],
  company?: CompanyInfo,
  isQuote: boolean = false
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // Header Background bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Try embedding logo
  const logoData = await loadLogoDataUrl(company?.logo);
  const textStartX = logoData ? 38 : 14;

  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 14, 12, 20, 20);
    } catch {}
  }

  // Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text(company?.name || 'OTM DOOR', textStartX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  y += 5;
  doc.text('Fabrication & Vente de Portes d’Intérieur et d’Extérieur (WPC - MDF - PVC)', textStartX, y);

  if (company) {
    y += 4;
    const addressLine = [company.address, company.commune, company.wilaya].filter(Boolean).join(', ');
    doc.text(addressLine || 'Zone Industrielle', textStartX, y);
    y += 4;
    const phoneLine = `Tél: ${company.phone1 || ''} ${company.phone2 ? ' / ' + company.phone2 : ''} - Email: ${company.email || 'contact@otmdoor.com'}`;
    doc.text(phoneLine, textStartX, y);
  }

  // Right box: Document Title & Number
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(pageWidth - 75, 12, 61, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isQuote ? 13 : 14);
  doc.setTextColor(15, 23, 42);
  doc.text(isQuote ? 'DEVIS ESTIMATIF' : 'BON DE COMMANDE', pageWidth - 70, 20);

  doc.setFontSize(11);
  doc.setTextColor(197, 155, 39); // Bronze gold
  doc.text(isQuote ? `DEV-${order.orderNumber}` : order.orderNumber, pageWidth - 70, 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${formatDateFr(order.date)}`, pageWidth - 70, 34);

  // Client Box
  y = 44;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('INFORMATIONS CLIENT', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Client : ${order.clientNameSnapshot}`, 18, y + 13);
  doc.text(`Téléphone : ${order.clientPhoneSnapshot || 'Non spécifié'}`, 18, y + 19);

  doc.text(`Adresse : ${order.clientAddressSnapshot || 'Non spécifiée'}`, pageWidth / 2 + 10, y + 13);
  doc.text(`Délai prévu : ${order.expectedDate ? formatDateFr(order.expectedDate) : 'À convenir'}`, pageWidth / 2 + 10, y + 19);

  // Items Table
  y = 74;
  const startX = 14;
  const colWidths = [10, 32, 22, 26, 26, 22, 14, 26]; // Total = 178 mm
  const headers = ['N°', 'Modèle', 'Matière', 'Couleur', 'Dimensions', 'Cadre', 'Qté', 'P.U (DA)'];

  // Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(startX, y, pageWidth - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  let currentX = startX + 2;
  headers.forEach((h, idx) => {
    doc.text(h, currentX, y + 5.5);
    currentX += colWidths[idx];
  });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  items.forEach((item, index) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    const rowBg = index % 2 === 0 ? 255 : 248;
    doc.setFillColor(rowBg, rowBg, rowBg);
    doc.rect(startX, y, pageWidth - 28, 8, 'F');

    currentX = startX + 2;
    doc.text(String(index + 1), currentX, y + 5.5);
    currentX += colWidths[0];

    doc.text(item.modelRefSnapshot || 'P-001', currentX, y + 5.5);
    currentX += colWidths[1];

    doc.text(item.materialName || 'WPC', currentX, y + 5.5);
    currentX += colWidths[2];

    doc.text(item.colourNameSnapshot || 'Standard', currentX, y + 5.5);
    currentX += colWidths[3];

    doc.text(`${item.width} x ${item.height} cm`, currentX, y + 5.5);
    currentX += colWidths[4];

    doc.text(item.frameNameSnapshot || '-', currentX, y + 5.5);
    currentX += colWidths[5];

    doc.text(String(item.quantity), currentX, y + 5.5);
    currentX += colWidths[6];

    doc.text(formatCurrency(item.unitPrice), currentX, y + 5.5);

    y += 8;
  });

  // Table bottom line
  doc.setDrawColor(203, 213, 225);
  doc.line(startX, y, pageWidth - 14, y);

  // Totals Section
  y += 6;
  const totalsX = pageWidth - 80;

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Sous-total :', totalsX, y);
  doc.text(formatCurrency(order.subtotal), pageWidth - 16, y, { align: 'right' });

  if (order.discount && order.discount > 0) {
    y += 5;
    doc.text('Remise exceptionnelle :', totalsX, y);
    doc.text(`- ${formatCurrency(order.discount)}`, pageWidth - 16, y, { align: 'right' });
  }

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(totalsX - 4, y - 4, 70, 8, 1, 1, 'F');
  doc.text('TOTAL COMMANDE :', totalsX, y + 2);
  doc.text(formatCurrency(order.totalAmount), pageWidth - 16, y + 2, { align: 'right' });

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(22, 101, 52); // Green
  doc.text('Total Encaissé / Acompte :', totalsX, y);
  doc.text(formatCurrency(order.paidAmount), pageWidth - 16, y, { align: 'right' });

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(185, 28, 28); // Red
  doc.text('Reste à Payer :', totalsX, y);
  doc.text(formatCurrency(order.remainingAmount), pageWidth - 16, y, { align: 'right' });

  // Observations / Notes
  if (order.notes) {
    y = Math.max(y + 12, 230);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Observations :', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(order.notes, 14, y + 5);
  }

  // Signatures
  const signY = 255;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, signY, 75, signY);
  doc.line(pageWidth - 75, signY, pageWidth - 14, signY);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Signature du Client & Bon pour accord', 14, signY + 5);
  doc.text('Cachet et Signature OTM DOOR', pageWidth - 75, signY + 5);

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const footerText = company?.footerText || 'OTM DOOR — Portes Haut de Gamme — Document généré localement hors ligne';
  doc.text(footerText, pageWidth / 2, 290, { align: 'center' });

  // Page 2: Arabic Version (RTL, translated labels, exact same data)
  try {
    const arabicImgData = await renderArabicOrderCanvas(order, items, company, isQuote);
    if (arabicImgData) {
      doc.addPage();
      doc.addImage(arabicImgData, 'PNG', 0, 0, pageWidth, doc.internal.pageSize.getHeight());
    }
  } catch (err) {
    console.error('Erreur génération page arabe:', err);
  }

  const filename = isQuote ? `Devis_${order.orderNumber}.pdf` : `Bon_Commande_${order.orderNumber}.pdf`;
  doc.save(filename);
}

export async function generateQuotePdf(
  order: Order,
  items: OrderItem[],
  company?: CompanyInfo
): Promise<void> {
  return generateOrderPdf(order, items, company, true);
}

export async function generateDeliveryNotePdf(
  order: Order,
  items: OrderItem[],
  company?: CompanyInfo
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 18;

  // Page 1: French Bon de Livraison
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 8, 'F');

  const logoData = await loadLogoDataUrl(company?.logo);
  const textStartX = logoData ? 38 : 14;
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', 14, 12, 20, 20); } catch {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text(company?.name || 'OTM DOOR', textStartX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  y += 5;
  doc.text('Fabrication & Vente de Portes d’Intérieur et d’Extérieur (WPC - MDF - PVC)', textStartX, y);

  if (company) {
    y += 4;
    const addressLine = [company.address, company.commune, company.wilaya].filter(Boolean).join(', ');
    doc.text(addressLine || 'Zone Industrielle', textStartX, y);
    y += 4;
    const phoneLine = `Tél: ${company.phone1 || ''} ${company.phone2 ? ' / ' + company.phone2 : ''} - Email: ${company.email || 'contact@otmdoor.com'}`;
    doc.text(phoneLine, textStartX, y);
  }

  // Right box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(pageWidth - 75, 12, 61, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('BON DE LIVRAISON', pageWidth - 70, 20);

  doc.setFontSize(11);
  doc.setTextColor(197, 155, 39);
  doc.text(`BL-${order.orderNumber}`, pageWidth - 70, 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${formatDateFr(new Date().toISOString())}`, pageWidth - 70, 34);

  // Client Box
  y = 44;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('INFORMATIONS DESTINATAIRE / CLIENT', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Client : ${order.clientNameSnapshot}`, 18, y + 13);
  doc.text(`Téléphone : ${order.clientPhoneSnapshot || 'Non spécifié'}`, 18, y + 19);
  doc.text(`Adresse de livraison : ${order.clientAddressSnapshot || 'Non spécifiée'}`, pageWidth / 2 + 10, y + 13);
  doc.text(`Réf. Commande : ${order.orderNumber}`, pageWidth / 2 + 10, y + 19);

  // Items table
  y = 74;
  const startX = 14;
  const colWidths = [12, 40, 28, 32, 34, 32];
  const headers = ['N°', 'Modèle', 'Matière', 'Couleur', 'Dimensions', 'Quantité livrée'];

  doc.setFillColor(30, 41, 59);
  doc.rect(startX, y, pageWidth - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);

  let currentX = startX + 2;
  headers.forEach((h, idx) => {
    doc.text(h, currentX, y + 5.5);
    currentX += colWidths[idx];
  });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  items.forEach((item, index) => {
    const rowBg = index % 2 === 0 ? 255 : 248;
    doc.setFillColor(rowBg, rowBg, rowBg);
    doc.rect(startX, y, pageWidth - 28, 8, 'F');

    currentX = startX + 2;
    doc.text(String(index + 1), currentX, y + 5.5);
    currentX += colWidths[0];
    doc.text(item.modelRefSnapshot || 'P-001', currentX, y + 5.5);
    currentX += colWidths[1];
    doc.text(item.materialName || 'WPC', currentX, y + 5.5);
    currentX += colWidths[2];
    doc.text(item.colourNameSnapshot || 'Standard', currentX, y + 5.5);
    currentX += colWidths[3];
    doc.text(`${item.width} x ${item.height} cm`, currentX, y + 5.5);
    currentX += colWidths[4];
    doc.text(`${item.quantity} porte(s)`, currentX, y + 5.5);

    y += 8;
  });

  // Receipt condition note
  y += 12;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('DÉCLARATION DE RÉCEPTION CONFORME :', 18, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Je soussigné certifie avoir reçu les marchandises susmentionnées en parfait état de conformité.', 18, y + 11);

  // Signatures
  const signY = 245;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, signY, 75, signY);
  doc.line(pageWidth - 75, signY, pageWidth - 14, signY);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Signature & Réception Client (Reçu conforme)', 14, signY + 5);
  doc.text('Visa & Cachet Expédition OTM DOOR', pageWidth - 75, signY + 5);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(company?.footerText || 'OTM DOOR — Bon de Livraison Officiel', pageWidth / 2, 290, { align: 'center' });

  // Page 2: Arabic Delivery Note Version
  try {
    const arabicImgData = await renderArabicDeliveryNoteCanvas(order, items, company);
    if (arabicImgData) {
      doc.addPage();
      doc.addImage(arabicImgData, 'PNG', 0, 0, pageWidth, pageHeight);
    }
  } catch (err) {
    console.error('Erreur génération BL arabe:', err);
  }

  doc.save(`Bon_Livraison_${order.orderNumber}.pdf`);
}

export async function generateProductionPdf(
  prodOrder: ProductionOrder,
  company?: CompanyInfo
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // Header Bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Try embedding logo
  const logoData = await loadLogoDataUrl(company?.logo);
  const textStartX = logoData ? 36 : 14;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 14, 11, 18, 18);
    } catch {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('BON DE FABRICATION / PRODUCTION', textStartX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(197, 155, 39);
  y += 6;
  doc.text(`N° Ordre : ${prodOrder.productionNumber}  —  Rattaché à la Commande : ${prodOrder.orderNumberSnapshot}`, textStartX, y);

  y += 10;
  // Box Door Specs
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 42, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('SPÉCIFICATIONS TECHNIQUES DE LA PORTE', 18, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Modèle : ${prodOrder.modelRefSnapshot} - ${prodOrder.modelNameSnapshot}`, 18, y + 16);
  doc.text(`Matière : ${prodOrder.materialName}`, 18, y + 23);
  doc.text(`Couleur : ${prodOrder.colourNameSnapshot}`, 18, y + 30);
  doc.text(`Cadre : ${prodOrder.frameNameSnapshot}`, 18, y + 37);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(`Dimensions : ${prodOrder.width} cm (Largeur) x ${prodOrder.height} cm (Hauteur)`, pageWidth / 2, y + 18);
  doc.text(`Quantité à produire : ${prodOrder.quantity} unité(s)`, pageWidth / 2, y + 28);

  y += 50;
  // BOM / Nomenclature checklist
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('NOMENCLATURE / COMPOSANTS NÉCESSAIRES (BOM)', 14, y);

  y += 6;
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y, pageWidth - 28, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Contrôle', 18, y + 5);
  doc.text('Article / Composant', 45, y + 5);
  doc.text('Quantité unitaire', 120, y + 5);
  doc.text('Total nécessaire', 160, y + 5);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  // Raw panel row
  doc.rect(18, y + 2, 4, 4); // Checkbox
  doc.text(`Panneau brut ${prodOrder.materialName}`, 45, y + 5);
  doc.text('1 panneau', 120, y + 5);
  doc.text(`${1 * prodOrder.quantity} panneau(x)`, 160, y + 5);
  y += 7;

  // Frame row
  doc.rect(18, y + 2, 4, 4); // Checkbox
  doc.text(`Cadre ${prodOrder.frameNameSnapshot}`, 45, y + 5);
  doc.text('1 kit cadre', 120, y + 5);
  doc.text(`${1 * prodOrder.quantity} kit(s)`, 160, y + 5);
  y += 7;

  // Components from BOM
  if (prodOrder.bomSnapshot?.items) {
    prodOrder.bomSnapshot.items.forEach((comp) => {
      doc.rect(18, y + 2, 4, 4);
      doc.text(comp.componentName, 45, y + 5);
      doc.text(`${comp.quantity} ${comp.unit}`, 120, y + 5);
      doc.text(`${comp.quantity * prodOrder.quantity} ${comp.unit}`, 160, y + 5);
      y += 7;
    });
  }

  y += 15;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  doc.text('CONTRÔLE QUALITÉ ATELIER CNC & ASSEMBLAGE', 18, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(120, 53, 15);
  doc.text('[ ] Usinage CNC conforme au dessin technique    [ ] Chants et placage parfaits    [ ] Accessoires ajustés', 18, y + 13);

  // Signatures
  y += 40;
  doc.line(14, y, 75, y);
  doc.line(pageWidth - 75, y, pageWidth - 14, y);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Responsable Production Atelier', 14, y + 5);
  doc.text('Visa Finition & Mise en Stock', pageWidth - 75, y + 5);

  doc.save(`Bon_Production_${prodOrder.productionNumber}.pdf`);
}

export async function generatePaymentReceiptPdf(
  payment: Payment,
  order?: Order,
  company?: CompanyInfo
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 6, 'F');

  // Try embedding logo
  const logoData = await loadLogoDataUrl(company?.logo);
  const textStartX = logoData ? 32 : 12;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 12, 10, 16, 16);
    } catch {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(company?.name || 'OTM DOOR', textStartX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  y += 4;
  doc.text('REÇU DE PAIEMENT & ENCAISSEMENT', textStartX, y);

  // Receipt details box
  y += 8;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, y, pageWidth - 24, 60, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Reçu N° : ${payment.receiptNumber}`, 16, y + 8);
  doc.text(`Date : ${formatDateFr(payment.date)}`, pageWidth - 45, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Client : ${payment.clientNameSnapshot}`, 16, y + 17);
  doc.text(`Commande rattachée : ${payment.orderNumberSnapshot}`, 16, y + 24);
  doc.text(`Mode de versement : ${payment.paymentMethod}`, 16, y + 31);
  if (payment.reference) {
    doc.text(`Référence : ${payment.reference}`, 16, y + 38);
  }

  // Amount badge
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(16, y + 43, pageWidth - 32, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(22, 101, 52); // Green
  doc.text('MONTANT VERSÉ :', 20, y + 51);
  doc.text(formatCurrency(payment.amount), pageWidth - 20, y + 51, { align: 'right' });

  // Remaining balance
  if (order) {
    y += 66;
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Commande : ${formatCurrency(order.totalAmount)}`, 14, y);
    doc.text(`Total Réglé à ce jour : ${formatCurrency(order.paidAmount)}`, 14, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(`Reste à payer : ${formatCurrency(order.remainingAmount)}`, 14, y + 11);
  }

  // Signature
  y = 120;
  doc.line(pageWidth - 55, y, pageWidth - 14, y);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Cachet & Signature OTM DOOR', pageWidth - 55, y + 4);

  // Page 2: Arabic Receipt copy
  try {
    const arabicReceiptImg = await renderArabicPaymentReceiptCanvas(payment, order, company);
    if (arabicReceiptImg) {
      doc.addPage();
      doc.addImage(arabicReceiptImg, 'PNG', 0, 0, pageWidth, doc.internal.pageSize.getHeight());
    }
  } catch (err) {
    console.error('Erreur génération reçu arabe:', err);
  }

  doc.save(`Recu_${payment.receiptNumber}.pdf`);
}

export function printBilingualDocument(
  title: string,
  contentFr: string,
  contentAr: string
): void {
  if (typeof window === 'undefined') return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: sans-serif; color: #0f172a; margin: 0; padding: 0; }
        .page { min-height: 90vh; }
        .page.arabic { direction: rtl; font-family: 'Amiri', Arial, sans-serif; text-align: right; }
        @media print {
          .page-break { break-after: page; page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="page french page-break">${contentFr}</div>
      <div class="page arabic">${contentAr}</div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export async function generateStockReportPdf(
  items: StockItem[],
  company?: CompanyInfo
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  // Try embedding logo
  const logoData = await loadLogoDataUrl(company?.logo);
  const textStartX = logoData ? 36 : 14;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 14, 10, 18, 18);
    } catch {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('OTM DOOR — ÉTAT D’INVENTAIRE ET STOCK ACTUEL', textStartX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, textStartX, y + 5);

  y += 12;
  const startX = 14;
  const headers = ['Type', 'Désignation de l’article', 'Physique', 'Réservé', 'Disponible', 'Seuil Alerte', 'Statut'];
  const colWidths = [30, 120, 25, 25, 25, 25, 20];

  doc.setFillColor(30, 41, 59);
  doc.rect(startX, y, pageWidth - 28, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  let curX = startX + 2;
  headers.forEach((h, i) => {
    doc.text(h, curX, y + 5);
    curX += colWidths[i];
  });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  items.forEach((it, idx) => {
    if (y > 185) {
      doc.addPage();
      y = 16;
    }

    const rowBg = idx % 2 === 0 ? 255 : 248;
    doc.setFillColor(rowBg, rowBg, rowBg);
    doc.rect(startX, y, pageWidth - 28, 7, 'F');

    curX = startX + 2;
    const typeLabel = it.itemType === 'FINISHED_DOOR' ? 'Porte Finie' : it.itemType === 'RAW_MATERIAL' ? 'Matière' : 'Composant';
    doc.text(typeLabel, curX, y + 5);
    curX += colWidths[0];

    const desc = it.itemType === 'FINISHED_DOOR'
      ? `${it.modelRef || ''} ${it.materialNameForDoor || ''} ${it.colourName || ''} (${it.width}x${it.height} cm) [Cadre ${it.frameRef || it.frameName || ''}]`
      : (it.materialName || it.componentName || 'Article');
    doc.text(desc.substring(0, 65), curX, y + 5);
    curX += colWidths[1];

    doc.text(`${it.physicalQuantity} ${it.unit}`, curX, y + 5);
    curX += colWidths[2];

    doc.text(`${it.reservedQuantity} ${it.unit}`, curX, y + 5);
    curX += colWidths[3];

    doc.setFont('helvetica', 'bold');
    doc.text(`${it.availableQuantity} ${it.unit}`, curX, y + 5);
    doc.setFont('helvetica', 'normal');
    curX += colWidths[4];

    doc.text(`${it.minAlertThreshold} ${it.unit}`, curX, y + 5);
    curX += colWidths[5];

    const isLow = it.availableQuantity <= it.minAlertThreshold;
    doc.setTextColor(isLow ? 185 : 22, isLow ? 28 : 101, isLow ? 28 : 52);
    doc.text(isLow ? 'Critique' : 'OK', curX, y + 5);
    doc.setTextColor(30, 41, 59);

    y += 7;
  });

  doc.save(`Rapport_Stock_${new Date().toISOString().split('T')[0]}.pdf`);
}
