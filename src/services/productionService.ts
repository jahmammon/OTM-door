import { db, recordAudit } from '../db';
import type { ProductionOrder, BillOfMaterials } from '../types';
import {
  findOrCreateFinishedDoorStock,
  adjustStockItemQuantity,
  recordStockMovement
} from './stockService';

export interface ProductionValidationCheck {
  canProduce: boolean;
  missingItems: Array<{
    name: string;
    needed: number;
    available: number;
    unit: string;
  }>;
}

export async function findApplicableBom(
  modelId: string,
  materialName: string,
  frameId?: string
): Promise<BillOfMaterials | undefined> {
  const boms = await db.bom.filter((b) => b.active).toArray();

  // 1. Exact match model + material + frame
  if (frameId) {
    const exact = boms.find(
      (b) =>
        b.modelId === modelId &&
        b.materialName?.toLowerCase() === materialName.toLowerCase() &&
        b.frameId === frameId
    );
    if (exact) return exact;
  }

  // 2. Match model + material
  const modelMaterial = boms.find(
    (b) =>
      b.modelId === modelId &&
      b.materialName?.toLowerCase() === materialName.toLowerCase()
  );
  if (modelMaterial) return modelMaterial;

  // 3. Match material only
  const materialOnly = boms.find(
    (b) =>
      !b.modelId &&
      b.materialName?.toLowerCase() === materialName.toLowerCase()
  );
  if (materialOnly) return materialOnly;

  // 4. Otherwise: NO BOM. Never fallback to an arbitrary or unrelated active BOM!
  return undefined;
}

export async function checkProductionMaterials(
  prodOrder: ProductionOrder,
  customBom?: BillOfMaterials
): Promise<ProductionValidationCheck> {
  const bom = customBom || prodOrder.bomSnapshot || (await findApplicableBom(
    prodOrder.modelId,
    prodOrder.materialName,
    prodOrder.frameId
  ));

  const missingItems: ProductionValidationCheck['missingItems'] = [];

  if (!bom) {
    return {
      canProduce: false,
      missingItems: [
        {
          name: `Nomenclature (BOM) manquante : aucune nomenclature active n'est configurée pour le modèle "${prodOrder.modelNameSnapshot}" (${prodOrder.materialName}). Veuillez d'abord créer et assigner une nomenclature dans le Catalogue.`,
          needed: 1,
          available: 0,
          unit: 'BOM'
        }
      ]
    };
  }

  const multiplier = prodOrder.quantity;

  // 1. Check raw material (panels)
  if (bom.rawMaterialUnitsNeeded > 0) {
    const rawStock = await db.stockItems
      .filter(
        (s) =>
          s.itemType === 'RAW_MATERIAL' &&
          s.materialName?.toLowerCase() === prodOrder.materialName.toLowerCase()
      )
      .first();

    const neededRaw = bom.rawMaterialUnitsNeeded * multiplier;
    const availableRaw = rawStock ? rawStock.availableQuantity : 0;

    if (availableRaw < neededRaw) {
      missingItems.push({
        name: `Panneau ${prodOrder.materialName}`,
        needed: neededRaw,
        available: availableRaw,
        unit: rawStock?.unit || 'panneaux'
      });
    }
  }

  // 2. Check each component in BOM
  for (const item of bom.items) {
    const compStock = await db.stockItems
      .filter((s) => s.itemType === 'COMPONENT' && s.componentId === item.componentId)
      .first();

    const needed = item.quantity * multiplier;
    const available = compStock ? compStock.availableQuantity : 0;

    if (available < needed) {
      missingItems.push({
        name: item.componentName,
        needed,
        available,
        unit: item.unit
      });
    }
  }

  return {
    canProduce: missingItems.length === 0,
    missingItems
  };
}

export async function completeProduction(
  prodOrderId: string,
  customBom?: BillOfMaterials
): Promise<void> {
  // 1. Verify production order exists
  const prodOrder = await db.productionOrders.get(prodOrderId);
  if (!prodOrder) {
    throw new Error('Ordre de production introuvable');
  }

  // 2. Verify parent order exists
  const parentOrder = await db.orders.get(prodOrder.orderId);
  if (!parentOrder) {
    throw new Error(`Commande parente introuvable pour l'ordre de production ${prodOrder.productionNumber}`);
  }

  // 3. Verify order is not cancelled
  if (parentOrder.status === 'ANNULÉE') {
    throw new Error(`Impossible de terminer la fabrication : La commande parente ${parentOrder.orderNumber} est annulée.`);
  }

  // 4. Verify production order itself is not cancelled
  if (prodOrder.status === 'ANNULÉE') {
    throw new Error(`Impossible de fabriquer : L'ordre de production ${prodOrder.productionNumber} est annulé.`);
  }

  // 5. Verify production is not already completed
  if (prodOrder.status === 'TERMINÉE') {
    throw new Error('Cet ordre de production est déjà marqué comme terminé.');
  }

  // 5. Load stored BOM snapshot (strictly prefer stored snapshot over dynamic catalogue)
  const bom = customBom || prodOrder.bomSnapshot || (await findApplicableBom(
    prodOrder.modelId,
    prodOrder.materialName,
    prodOrder.frameId
  ));

  if (!bom) {
    throw new Error(
      `Impossible de lancer la production : Aucune nomenclature (BOM) valide n'est configurée pour le modèle "${prodOrder.modelNameSnapshot}" (${prodOrder.materialName}). Veuillez d'abord créer et affecter une nomenclature dans le Catalogue pour ce modèle ou cette matière.`
    );
  }

  const multiplier = prodOrder.quantity;
  const missingItems: string[] = [];

  // 6 & 7. Calculate ALL required quantities and check ALL stock availability BEFORE consuming any stock
  let rawStockItem: any = null;
  let neededRaw = 0;
  if (bom && bom.rawMaterialUnitsNeeded > 0) {
    neededRaw = bom.rawMaterialUnitsNeeded * multiplier;
    rawStockItem = await db.stockItems
      .filter(
        (s) =>
          s.itemType === 'RAW_MATERIAL' &&
          s.materialName?.toLowerCase() === prodOrder.materialName.toLowerCase()
      )
      .first();

    const availableRaw = rawStockItem ? rawStockItem.availableQuantity : 0;
    if (availableRaw < neededRaw) {
      missingItems.push(
        `Panneaux ${prodOrder.materialName} (besoin: ${neededRaw}, disponible en stock: ${availableRaw})`
      );
    }
  }

  const componentConsumptions: { stockItem: any; needed: number; compName: string; unit: string }[] = [];
  if (bom && bom.items) {
    for (const item of bom.items) {
      const compStock = await db.stockItems
        .filter((s) => s.itemType === 'COMPONENT' && s.componentId === item.componentId)
        .first();

      const needed = item.quantity * multiplier;
      const available = compStock ? compStock.availableQuantity : 0;

      if (available < needed) {
        missingItems.push(
          `${item.componentName} (besoin: ${needed} ${item.unit}, disponible en stock: ${available} ${item.unit})`
        );
      } else if (compStock) {
        componentConsumptions.push({
          stockItem: compStock,
          needed,
          compName: item.componentName,
          unit: item.unit
        });
      }
    }
  }

  // Strict enforcement: STOP if anything is missing. Consume NOTHING, add NO finished doors.
  if (missingItems.length > 0) {
    throw new Error(
      `Impossible d'exécuter la fabrication — rupture de composants : ${missingItems.join(' ; ')}. Veuillez réapprovisionner le stock avant de relancer l'ordre.`
    );
  }

  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];
  const timeStr = new Date().toTimeString().split(' ')[0];
  const docRef = `Ordre ${prodOrder.productionNumber} (Commande ${prodOrder.orderNumberSnapshot})`;

  // 8. ATOMIC EXECUTION inside a single Dexie transaction
  await db.transaction(
    'rw',
    [
      db.productionOrders,
      db.orders,
      db.orderItems,
      db.stockItems,
      db.stockMovements,
      db.auditLogs
    ],
    async () => {
      // Step A: Deduct raw material
      if (rawStockItem && neededRaw > 0) {
        const freshRaw = await db.stockItems.get(rawStockItem.id);
        if (!freshRaw || freshRaw.availableQuantity < neededRaw) {
          throw new Error(`Stock disponible insuffisant pour ${rawStockItem.materialName}`);
        }
        const newPhysical = freshRaw.physicalQuantity - neededRaw;
        const newReserved = freshRaw.reservedQuantity;
        const newAvailable = newPhysical - newReserved;

        if (newPhysical < 0 || newReserved > newPhysical || newAvailable < 0) {
          throw new Error(`Violation d'invariants de stock pour ${rawStockItem.materialName}`);
        }

        await db.stockItems.update(freshRaw.id, {
          physicalQuantity: newPhysical,
          reservedQuantity: newReserved,
          availableQuantity: newAvailable,
          updatedAt: now
        });

        await db.stockMovements.add({
          id: 'mvt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          date: dateStr,
          time: timeStr,
          articleSnapshot: `Panneau ${prodOrder.materialName}`,
          itemType: 'RAW_MATERIAL',
          stockItemId: freshRaw.id,
          quantity: neededRaw,
          direction: 'OUT',
          type: 'CONSOMMATION',
          linkedDocument: docRef,
          motif: `Consommation nomenclature pour fabrication de ${multiplier} porte(s)`,
          createdAt: now
        });
      }

      // Step B: Deduct components
      for (const comp of componentConsumptions) {
        const freshComp = await db.stockItems.get(comp.stockItem.id);
        if (!freshComp || freshComp.availableQuantity < comp.needed) {
          throw new Error(`Stock disponible insuffisant pour le composant ${comp.compName}`);
        }
        const newPhysical = freshComp.physicalQuantity - comp.needed;
        const newReserved = freshComp.reservedQuantity;
        const newAvailable = newPhysical - newReserved;

        if (newPhysical < 0 || newReserved > newPhysical || newAvailable < 0) {
          throw new Error(`Violation d'invariants de stock pour le composant ${comp.compName}`);
        }

        await db.stockItems.update(freshComp.id, {
          physicalQuantity: newPhysical,
          reservedQuantity: newReserved,
          availableQuantity: newAvailable,
          updatedAt: now
        });

        await db.stockMovements.add({
          id: 'mvt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          date: dateStr,
          time: timeStr,
          articleSnapshot: comp.compName,
          itemType: 'COMPONENT',
          stockItemId: freshComp.id,
          quantity: comp.needed,
          direction: 'OUT',
          type: 'CONSOMMATION',
          linkedDocument: docRef,
          motif: `Consommation quincaillerie/composant nomenclature atelier`,
          createdAt: now
        });
      }

      // Step C: Add finished doors to stock
      const doorStock = await findOrCreateFinishedDoorStock({
        modelId: prodOrder.modelId,
        modelRef: prodOrder.modelRefSnapshot,
        modelName: prodOrder.modelNameSnapshot,
        materialName: prodOrder.materialName,
        colourId: prodOrder.colourId,
        colourName: prodOrder.colourNameSnapshot,
        width: prodOrder.width,
        height: prodOrder.height,
        frameId: prodOrder.frameId,
        frameRef: prodOrder.frameNameSnapshot,
        frameName: prodOrder.frameNameSnapshot
      });

      const freshDoor = (await db.stockItems.get(doorStock.id)) || doorStock;
      const newDoorPhysical = freshDoor.physicalQuantity + multiplier;
      
      // If produced for a linked order item, automatically reserve it for that order
      let newDoorReserved = freshDoor.reservedQuantity;
      if (prodOrder.orderItemId) {
        const orderItem = await db.orderItems.get(prodOrder.orderItemId);
        if (orderItem) {
          const updatedReserved = (orderItem.reservedQuantity || 0) + multiplier;
          const updatedNeeded = Math.max(0, (orderItem.productionQuantityNeeded || 0) - multiplier);
          newDoorReserved = (freshDoor.reservedQuantity || 0) + multiplier;
          await db.orderItems.update(orderItem.id, {
            reservedQuantity: updatedReserved,
            productionQuantityNeeded: updatedNeeded,
            isStockReserved: updatedReserved >= orderItem.quantity,
            updatedAt: now
          });
        }
      }

      const newDoorAvailable = Math.max(0, newDoorPhysical - newDoorReserved);

      await db.stockItems.update(freshDoor.id, {
        physicalQuantity: newDoorPhysical,
        reservedQuantity: newDoorReserved,
        availableQuantity: newDoorAvailable,
        updatedAt: now
      });

      await db.stockMovements.add({
        id: 'mvt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        date: dateStr,
        time: timeStr,
        articleSnapshot: `Porte ${prodOrder.modelRefSnapshot} (${prodOrder.width}x${prodOrder.height} cm)`,
        itemType: 'FINISHED_DOOR',
        stockItemId: freshDoor.id,
        quantity: multiplier,
        direction: 'IN',
        type: 'PRODUCTION',
        linkedDocument: docRef,
        motif: `Entrée en stock de fabrication achevée (${multiplier} unité(s))`,
        createdAt: now
      });

      // Step D: Update production order status to TERMINÉE
      await db.productionOrders.update(prodOrderId, {
        status: 'TERMINÉE',
        completedAt: now,
        updatedAt: now
      });

      // Step E: Update parent order status if all production orders are finished
      const freshParentOrder = await db.orders.get(prodOrder.orderId);
      if (freshParentOrder) {
        const allProdForOrder = await db.productionOrders
          .where('orderId')
          .equals(prodOrder.orderId)
          .toArray();

        const allFinished = allProdForOrder.every((p) =>
          p.id === prodOrderId ? true : p.status === 'TERMINÉE'
        );

        if (allFinished && (freshParentOrder.status === 'À PRODUIRE' || freshParentOrder.status === 'EN PRODUCTION')) {
          await db.orders.update(freshParentOrder.id, {
            status: 'PRÊTE',
            updatedAt: now
          });
          await recordAudit(
            'Commande prête',
            'orders',
            `Commande ${freshParentOrder.orderNumber} passée au statut PRÊTE suite à la fin de fabrication`,
            freshParentOrder.id
          );
        }
      }

      await recordAudit(
        'Production terminée',
        'productionOrders',
        `Validation production ${prodOrder.productionNumber}: ${multiplier}x ${prodOrder.modelRefSnapshot} achevée avec déduction BOM`,
        prodOrderId
      );
    }
  );
}

// Keep validateAndExecuteProduction as alias for backwards compatibility
export const validateAndExecuteProduction = completeProduction;
