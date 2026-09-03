import { db, recordAudit } from '../db';
import type {
  StockItem,
  StockMovement,
  StockMovementType,
  StockDirection,
  ItemType
} from '../types';

export interface RegisterMovementParams {
  itemType: ItemType;
  stockItemId: string;
  articleSnapshot: string;
  quantity: number;
  direction: StockDirection;
  type: StockMovementType;
  linkedDocument?: string;
  motif?: string;
  observation?: string;
}

export async function recordStockMovement(params: RegisterMovementParams): Promise<StockMovement> {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  const movement: StockMovement = {
    id: 'mvt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    date: dateStr,
    time: timeStr,
    articleSnapshot: params.articleSnapshot,
    itemType: params.itemType,
    stockItemId: params.stockItemId,
    quantity: params.quantity,
    direction: params.direction,
    type: params.type,
    linkedDocument: params.linkedDocument,
    motif: params.motif,
    observation: params.observation,
    createdAt: now.toISOString()
  };

  await db.stockMovements.add(movement);
  return movement;
}

export async function findOrCreateFinishedDoorStock(params: {
  modelId: string;
  modelRef: string;
  modelName: string;
  materialName: string;
  colourId: string;
  colourName: string;
  width: number;
  height: number;
  frameId: string;
  frameRef: string;
  frameName: string;
}): Promise<StockItem> {
  const existing = await db.stockItems
    .filter((s) => {
      return (
        s.itemType === 'FINISHED_DOOR' &&
        s.modelId === params.modelId &&
        s.materialNameForDoor?.toLowerCase() === params.materialName.toLowerCase() &&
        s.colourId === params.colourId &&
        Number(s.width) === Number(params.width) &&
        Number(s.height) === Number(params.height) &&
        s.frameId === params.frameId
      );
    })
    .first();

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const newItem: StockItem = {
    id: 'stk_door_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    itemType: 'FINISHED_DOOR',
    modelId: params.modelId,
    modelRef: params.modelRef,
    modelName: params.modelName,
    materialNameForDoor: params.materialName,
    colourId: params.colourId,
    colourName: params.colourName,
    width: Number(params.width),
    height: Number(params.height),
    frameId: params.frameId,
    frameRef: params.frameRef,
    frameName: params.frameName,
    physicalQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    minAlertThreshold: 1,
    unit: 'pièce',
    location: 'Entrepôt OTM DOOR',
    updatedAt: now
  };

  await db.stockItems.add(newItem);
  return newItem;
}

export async function adjustStockItemQuantity(
  stockItemId: string,
  quantityChange: number,
  movementType: StockMovementType,
  linkedDocument?: string,
  motif?: string,
  observation?: string
): Promise<StockItem> {
  const item = await db.stockItems.get(stockItemId);
  if (!item) {
    throw new Error(`Article de stock non trouvé (${stockItemId})`);
  }

  const newPhysical = item.physicalQuantity + quantityChange;
  if (newPhysical < 0) {
    throw new Error(
      `Stock insuffisant pour l'article ${getArticleDisplayName(item)}. Stock actuel: ${item.physicalQuantity}, demandé: ${Math.abs(quantityChange)}`
    );
  }

  const newAvailable = newPhysical - item.reservedQuantity;
  const now = new Date().toISOString();

  await db.stockItems.update(stockItemId, {
    physicalQuantity: newPhysical,
    availableQuantity: newAvailable,
    updatedAt: now
  });

  const direction: StockDirection = quantityChange >= 0 ? 'IN' : 'OUT';
  const articleName = getArticleDisplayName(item);

  await recordStockMovement({
    itemType: item.itemType,
    stockItemId,
    articleSnapshot: articleName,
    quantity: Math.abs(quantityChange),
    direction,
    type: movementType,
    linkedDocument,
    motif: motif || `Ajustement de stock (${quantityChange >= 0 ? '+' : ''}${quantityChange})`,
    observation
  });

  await recordAudit(
    'Ajustement stock',
    'stockItems',
    `Stock ${direction === 'IN' ? '+' : '-'}${Math.abs(quantityChange)} ${item.unit} pour ${articleName}. Nouveau stock: ${newPhysical}`,
    stockItemId
  );

  return {
    ...item,
    physicalQuantity: newPhysical,
    availableQuantity: newAvailable,
    updatedAt: now
  };
}

export async function reserveFinishedDoorStock(
  stockItemId: string,
  quantityToReserve: number,
  linkedDocument: string
): Promise<{ reserved: number; availableLeft: number }> {
  const item = await db.stockItems.get(stockItemId);
  if (!item) {
    throw new Error('Article introuvable');
  }

  const available = Math.max(0, item.physicalQuantity - item.reservedQuantity);
  const actualToReserve = Math.min(available, quantityToReserve);

  if (actualToReserve > 0) {
    const newReserved = item.reservedQuantity + actualToReserve;
    const newAvailable = item.physicalQuantity - newReserved;
    const now = new Date().toISOString();

    await db.stockItems.update(stockItemId, {
      reservedQuantity: newReserved,
      availableQuantity: newAvailable,
      updatedAt: now
    });

    await recordStockMovement({
      itemType: item.itemType,
      stockItemId,
      articleSnapshot: getArticleDisplayName(item),
      quantity: actualToReserve,
      direction: 'RESERVATION',
      type: 'RÉSERVATION',
      linkedDocument,
      motif: `Réservation pour commande ${linkedDocument}`
    });
  }

  return {
    reserved: actualToReserve,
    availableLeft: Math.max(0, available - actualToReserve)
  };
}

export async function releaseFinishedDoorReservation(
  stockItemId: string,
  quantityToRelease: number,
  linkedDocument: string
): Promise<void> {
  const item = await db.stockItems.get(stockItemId);
  if (!item) return;

  const actualRelease = Math.min(item.reservedQuantity, quantityToRelease);
  if (actualRelease > 0) {
    const newReserved = item.reservedQuantity - actualRelease;
    const newAvailable = item.physicalQuantity - newReserved;
    const now = new Date().toISOString();

    await db.stockItems.update(stockItemId, {
      reservedQuantity: newReserved,
      availableQuantity: newAvailable,
      updatedAt: now
    });

    await recordStockMovement({
      itemType: item.itemType,
      stockItemId,
      articleSnapshot: getArticleDisplayName(item),
      quantity: actualRelease,
      direction: 'RELEASE',
      type: 'ANNULATION_RÉSERVATION',
      linkedDocument,
      motif: `Annulation réservation (${linkedDocument})`
    });
  }
}

export function getArticleDisplayName(item: StockItem): string {
  if (item.itemType === 'FINISHED_DOOR') {
    return `Porte ${item.modelRef || ''} - ${item.materialNameForDoor || ''} - ${item.colourName || ''} (${item.width}x${item.height} cm) [Cadre ${item.frameRef || item.frameName || ''}]`.trim();
  }
  if (item.itemType === 'RAW_MATERIAL') {
    return `Matière première: ${item.materialName || item.location || 'Matière'}`;
  }
  return `Composant: ${item.componentName || item.componentRef || 'Composant'}`;
}
