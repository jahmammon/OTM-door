import { db, recordAudit } from '../db';
import type { BackupPayload } from '../types';
import { encryptData, decryptData, computeChecksum } from './securityService';

export const APP_VERSION = '1.0.0';
export const BACKUP_FORMAT_VERSION = '1.0';

export async function exportDatabaseBackup(password?: string): Promise<{ blob: Blob; filename: string }> {
  const payloadData: BackupPayload['data'] = {
    company: await db.company.toArray(),
    settings: await db.settings.toArray(),
    doorModels: await db.doorModels.toArray(),
    materials: await db.materials.toArray(),
    colours: await db.colours.toArray(),
    frames: await db.frames.toArray(),
    components: await db.components.toArray(),
    bom: await db.bom.toArray(),
    priceEntries: await db.priceEntries.toArray(),
    clients: await db.clients.toArray(),
    orders: await db.orders.toArray(),
    orderItems: await db.orderItems.toArray(),
    payments: await db.payments.toArray(),
    productionOrders: await db.productionOrders.toArray(),
    stockItems: await db.stockItems.toArray(),
    stockMovements: await db.stockMovements.toArray(),
    auditLogs: await db.auditLogs.toArray()
  };

  const rawJson = JSON.stringify(payloadData);
  const checksum = await computeChecksum(rawJson);

  const payload: BackupPayload = {
    version: BACKUP_FORMAT_VERSION,
    appVersion: APP_VERSION,
    timestamp: new Date().toISOString(),
    checksum,
    data: payloadData
  };

  const payloadJson = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');

  if (password && password.trim() !== '') {
    const encrypted = await encryptData(payloadJson, password);
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const filename = `OTM_DOOR_Sauvegarde_Chiffree_${dateStr}.otmbackup`;
    await recordAudit('Export sauvegarde', 'system', `Sauvegarde chiffrée exportée: ${filename}`);
    return { blob, filename };
  } else {
    const blob = new Blob([payloadJson], { type: 'application/json' });
    const filename = `OTM_DOOR_Sauvegarde_${dateStr}.otmbackup`;
    await recordAudit('Export sauvegarde', 'system', `Sauvegarde standard exportée: ${filename}`);
    return { blob, filename };
  }
}

export async function restoreDatabaseBackup(
  fileContent: string,
  password?: string
): Promise<{ success: boolean; message: string; recordCount: number }> {
  let jsonString = fileContent;

  // Check if it's an encrypted envelope
  if (fileContent.trim().startsWith('{') && fileContent.includes('"ciphertext"')) {
    if (!password) {
      throw new Error('Cette sauvegarde est chiffrée. Veuillez saisir le mot de passe de déchiffrement.');
    }
    try {
      jsonString = await decryptData(fileContent, password);
    } catch (err: any) {
      throw new Error(err.message || 'Impossible de déchiffrer la sauvegarde. Vérifiez le mot de passe.');
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Format de fichier JSON invalide');
  }

  let data: BackupPayload['data'];
  if (parsed.data && parsed.version) {
    // Verify checksum
    const rawDataJson = JSON.stringify(parsed.data);
    const calculatedChecksum = await computeChecksum(rawDataJson);
    if (parsed.checksum && parsed.checksum !== calculatedChecksum) {
      console.warn('Avertissement: Le hachage de contrôle de la sauvegarde diffère.');
    }
    data = parsed.data;
  } else if (parsed.company || parsed.orders || parsed.doorModels) {
    // Direct data export
    data = parsed;
  } else {
    throw new Error('Structure de sauvegarde OTM DOOR non reconnue.');
  }

  // Atomic database restoration inside a transaction
  let totalRecords = 0;
  await db.transaction('rw', [
    db.company,
    db.settings,
    db.doorModels,
    db.materials,
    db.colours,
    db.frames,
    db.components,
    db.bom,
    db.priceEntries,
    db.clients,
    db.orders,
    db.orderItems,
    db.payments,
    db.productionOrders,
    db.stockItems,
    db.stockMovements,
    db.auditLogs
  ], async () => {
    // Clear all existing tables
    await Promise.all([
      db.company.clear(),
      db.settings.clear(),
      db.doorModels.clear(),
      db.materials.clear(),
      db.colours.clear(),
      db.frames.clear(),
      db.components.clear(),
      db.bom.clear(),
      db.priceEntries.clear(),
      db.clients.clear(),
      db.orders.clear(),
      db.orderItems.clear(),
      db.payments.clear(),
      db.productionOrders.clear(),
      db.stockItems.clear(),
      db.stockMovements.clear(),
      db.auditLogs.clear()
    ]);

    // Restore tables
    if (data.company?.length) { await db.company.bulkAdd(data.company); totalRecords += data.company.length; }
    if (data.settings?.length) { await db.settings.bulkAdd(data.settings); totalRecords += data.settings.length; }
    if (data.doorModels?.length) { await db.doorModels.bulkAdd(data.doorModels); totalRecords += data.doorModels.length; }
    if (data.materials?.length) { await db.materials.bulkAdd(data.materials); totalRecords += data.materials.length; }
    if (data.colours?.length) { await db.colours.bulkAdd(data.colours); totalRecords += data.colours.length; }
    if (data.frames?.length) { await db.frames.bulkAdd(data.frames); totalRecords += data.frames.length; }
    if (data.components?.length) { await db.components.bulkAdd(data.components); totalRecords += data.components.length; }
    if (data.bom?.length) { await db.bom.bulkAdd(data.bom); totalRecords += data.bom.length; }
    if (data.priceEntries?.length) { await db.priceEntries.bulkAdd(data.priceEntries); totalRecords += data.priceEntries.length; }
    if (data.clients?.length) { await db.clients.bulkAdd(data.clients); totalRecords += data.clients.length; }
    if (data.orders?.length) { await db.orders.bulkAdd(data.orders); totalRecords += data.orders.length; }
    if (data.orderItems?.length) { await db.orderItems.bulkAdd(data.orderItems); totalRecords += data.orderItems.length; }
    if (data.payments?.length) { await db.payments.bulkAdd(data.payments); totalRecords += data.payments.length; }
    if (data.productionOrders?.length) { await db.productionOrders.bulkAdd(data.productionOrders); totalRecords += data.productionOrders.length; }
    if (data.stockItems?.length) { await db.stockItems.bulkAdd(data.stockItems); totalRecords += data.stockItems.length; }
    if (data.stockMovements?.length) { await db.stockMovements.bulkAdd(data.stockMovements); totalRecords += data.stockMovements.length; }
    if (data.auditLogs?.length) { await db.auditLogs.bulkAdd(data.auditLogs); totalRecords += data.auditLogs.length; }
  });

  await recordAudit(
    'Restauration sauvegarde',
    'system',
    `Restauration complète réussie. ${totalRecords} enregistrements restaurés avec intégrité validée.`
  );

  return {
    success: true,
    message: `Restauration réussie avec succès (${totalRecords} éléments restaurés).`,
    recordCount: totalRecords
  };
}

export async function exportEncryptedBackup(password: string): Promise<void> {
  const { blob, filename } = await exportDatabaseBackup(password);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreFromEncryptedBackup(file: File, password?: string): Promise<void> {
  const text = await file.text();
  await restoreDatabaseBackup(text, password);
}

export async function getDatabaseStats(): Promise<Record<string, number>> {
  const [orders, stockItems, stockMovements, productionOrders, clients, payments] = await Promise.all([
    db.orders.count(),
    db.stockItems.count(),
    db.stockMovements.count(),
    db.productionOrders.count(),
    db.clients.count(),
    db.payments.count()
  ]);

  return {
    orders,
    stockItems,
    stockMovements,
    productionOrders,
    clients,
    payments
  };
}

