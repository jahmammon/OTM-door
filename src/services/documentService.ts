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

  doc.save(`Recu_${payment.receiptNumber}.pdf`);
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
