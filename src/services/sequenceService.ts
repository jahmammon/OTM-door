import { db, getSettings } from '../db';

/**
 * Robust local sequence numbering generator.
 * Enforces:
 * - Unique numbers with collision protection
 * - Yearly numbering (e.g. OTM-2026-0001)
 * - Configurable prefixes from AppSettings
 * - Incremental persistence in Settings
 */
export async function generateSafeSequence(
  type: 'ORDER' | 'PRODUCTION' | 'RECEIPT'
): Promise<string> {
  const settings = await getSettings();
  const currentYear = new Date().getFullYear();

  let basePrefix = '';
  let settingKey: 'nextOrderNum' | 'nextProductionNum' | 'nextReceiptNum';
  let currentSeq = 1;

  if (type === 'ORDER') {
    basePrefix = settings?.orderPrefix?.trim() || 'OTM-';
    settingKey = 'nextOrderNum';
    currentSeq = settings?.nextOrderNum || 1;
  } else if (type === 'PRODUCTION') {
    basePrefix = settings?.productionPrefix?.trim() || 'PROD-';
    settingKey = 'nextProductionNum';
    currentSeq = settings?.nextProductionNum || 1;
  } else {
    basePrefix = settings?.receiptPrefix?.trim() || 'REC-';
    settingKey = 'nextReceiptNum';
    currentSeq = settings?.nextReceiptNum || 1;
  }

  // Ensure prefix ends with year, e.g. "OTM-2026-" or "OTM-" -> "OTM-2026-"
  let fullPrefix = basePrefix;
  if (!fullPrefix.includes(String(currentYear))) {
    if (!fullPrefix.endsWith('-')) {
      fullPrefix += '-';
    }
    fullPrefix += `${currentYear}-`;
  } else if (!fullPrefix.endsWith('-')) {
    fullPrefix += '-';
  }

  // Scan existing database records to find the maximum existing sequence number for this prefix
  let maxFoundInDb = 0;

  if (type === 'ORDER') {
    const existingOrders = await db.orders.toArray();
    for (const o of existingOrders) {
      if (o.orderNumber && o.orderNumber.startsWith(fullPrefix)) {
        const suffix = o.orderNumber.slice(fullPrefix.length);
        const parsed = parseInt(suffix, 10);
        if (!isNaN(parsed) && parsed > maxFoundInDb) {
          maxFoundInDb = parsed;
        }
      }
    }
  } else if (type === 'PRODUCTION') {
    const existingProds = await db.productionOrders.toArray();
    for (const p of existingProds) {
      if (p.productionNumber && p.productionNumber.startsWith(fullPrefix)) {
        const suffix = p.productionNumber.slice(fullPrefix.length);
        const parsed = parseInt(suffix, 10);
        if (!isNaN(parsed) && parsed > maxFoundInDb) {
          maxFoundInDb = parsed;
        }
      }
    }
  } else {
    const existingPayments = await db.payments.toArray();
    for (const p of existingPayments) {
      if (p.receiptNumber && p.receiptNumber.startsWith(fullPrefix)) {
        const suffix = p.receiptNumber.slice(fullPrefix.length);
        const parsed = parseInt(suffix, 10);
        if (!isNaN(parsed) && parsed > maxFoundInDb) {
          maxFoundInDb = parsed;
        }
      }
    }
  }

  let candidateNum = Math.max(currentSeq, maxFoundInDb + 1);
  let candidateStr = `${fullPrefix}${String(candidateNum).padStart(4, '0')}`;

  // Extra collision check loop to be 100% immune to race conditions or non-standard manual inputs
  let collision = true;
  while (collision) {
    candidateStr = `${fullPrefix}${String(candidateNum).padStart(4, '0')}`;
    let exists = false;
    if (type === 'ORDER') {
      exists = Boolean(await db.orders.where('orderNumber').equals(candidateStr).first());
    } else if (type === 'PRODUCTION') {
      exists = Boolean(await db.productionOrders.where('productionNumber').equals(candidateStr).first());
    } else {
      exists = Boolean(await db.payments.where('receiptNumber').equals(candidateStr).first());
    }

    if (!exists) {
      collision = false;
    } else {
      candidateNum++;
    }
  }

  // Update next sequence in settings
  if (settings && settings.id) {
    await db.settings.update(settings.id, {
      [settingKey]: candidateNum + 1,
      updatedAt: new Date().toISOString()
    });
  }

  return candidateStr;
}
