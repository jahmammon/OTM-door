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
      `Opération de stock rejetée : Stock physique insuffisant pour l'article ${getArticleDisplayName(item)}. Stock actuel : ${item.physicalQuantity}, retrait demandé : ${Math.abs(quantityChange)}`
    );
  }

  // Reject reducing physical stock below reserved quantity
  if (newPhysical < item.reservedQuantity) {
    throw new Error(
      `Opération de stock rejetée : Le nouveau stock physique (${newPhysical}) ne peut pas être inférieur à la quantité réservée (${item.reservedQuantity}) pour ${getArticleDisplayName(item)}.`
    );
  }

  const newReserved = item.reservedQuantity;
  const newAvailable = newPhysical - newReserved;

  if (newPhysical < 0 || newReserved < 0 || newReserved > newPhysical || newAvailable < 0) {
    throw new Error(
      `Opération de stock rejetée : Violation des invariants d'inventaire (Physique: ${newPhysical}, Réservé: ${newReserved}, Disponible: ${newAvailable}).`
    );
  }

  const now = new Date().toISOString();

  await db.stockItems.update(stockItemId, {
    physicalQuantity: newPhysical,
    reservedQuantity: newReserved,
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
    `Stock ${direction === 'IN' ? '+' : '-'}${Math.abs(quantityChange)} ${item.unit} pour ${articleName}. Nouveau stock: ${newPhysical} (Dispo: ${newAvailable})`,
    stockItemId
  );

  return {
    ...item,
    physicalQuantity: newPhysical,
    reservedQuantity: newReserved,
    availableQuantity: newAvailable,
    updatedAt: now
  };
}

export async function reserveFinishedDoorStock(
  stockItemId: string,
  quantityToReserve: number,
  linkedDocument: string
): Promise<{ reserved: number; availableLeft: number }> {
  if (quantityToReserve <= 0) {
    return { reserved: 0, availableLeft: 0 };
  }

  const item = await db.stockItems.get(stockItemId);
  if (!item) {
    throw new Error('Article introuvable');
  }

  const currentAvailable = item.physicalQuantity - item.reservedQuantity;
  if (quantityToReserve > currentAvailable) {
    throw new Error(
      `Réservation rejetée : Impossible de réserver ${quantityToReserve} porte(s) pour ${getArticleDisplayName(item)}. Seulement ${currentAvailable} unité(s) disponible(s) (Physique : ${item.physicalQuantity}, Réservé : ${item.reservedQuantity}).`
    );
  }

  const newReserved = item.reservedQuantity + quantityToReserve;
  const newAvailable = item.physicalQuantity - newReserved;

  if (newReserved > item.physicalQuantity || newAvailable < 0 || newReserved < 0) {
    throw new Error(
      `Réservation rejetée : Violation des invariants de stock pour ${getArticleDisplayName(item)}.`
    );
  }

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
    quantity: quantityToReserve,
    direction: 'RESERVATION',
    type: 'RÉSERVATION',
    linkedDocument,
    motif: `Réservation ferme pour commande ${linkedDocument}`
  });

  return {
    reserved: quantityToReserve,
    availableLeft: newAvailable
  };
}

export async function releaseFinishedDoorReservation(
  stockItemId: string,
  quantityToRelease: number,
  linkedDocument: string
): Promise<void> {
  if (quantityToRelease <= 0) return;

  const item = await db.stockItems.get(stockItemId);
  if (!item) return;

  if (quantityToRelease > item.reservedQuantity) {
    throw new Error(
      `Libération rejetée : Impossible de libérer ${quantityToRelease} unité(s) pour ${getArticleDisplayName(item)} : seulement ${item.reservedQuantity} unité(s) sont réservées.`
    );
  }

  const newReserved = item.reservedQuantity - quantityToRelease;
  const newAvailable = item.physicalQuantity - newReserved;

  if (newReserved < 0 || newReserved > item.physicalQuantity || newAvailable < 0) {
    throw new Error(
      `Libération rejetée : Violation des invariants de stock pour ${getArticleDisplayName(item)}.`
    );
  }

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
    quantity: quantityToRelease,
    direction: 'RELEASE',
    type: 'ANNULATION_RÉSERVATION',
    linkedDocument,
    motif: `Annulation réservation (${linkedDocument})`
  });
}

export function validateStockInvariants(item: StockItem): boolean {
  if (item.physicalQuantity < 0) {
    throw new Error(`Violation d'invariant de stock : physicalQuantity (${item.physicalQuantity}) ne peut pas être négative.`);
  }
  if (item.reservedQuantity < 0) {
    throw new Error(`Violation d'invariant de stock : reservedQuantity (${item.reservedQuantity}) ne peut pas être négative.`);
  }
  if (item.reservedQuantity > item.physicalQuantity) {
    throw new Error(`Violation d'invariant de stock : reservedQuantity (${item.reservedQuantity}) ne peut pas être supérieure à physicalQuantity (${item.physicalQuantity}).`);
  }
  if (item.availableQuantity !== item.physicalQuantity - item.reservedQuantity) {
    throw new Error(`Violation d'invariant de stock : availableQuantity (${item.availableQuantity}) doit être égale à physicalQuantity (${item.physicalQuantity}) - reservedQuantity (${item.reservedQuantity}).`);
  }
  return true;
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
