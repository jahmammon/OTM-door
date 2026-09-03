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

  // 4. Default active BOM
  return boms[0];
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
    // If no BOM is found, we allow production with a warning or basic panel check
    return { canProduce: true, missingItems: [] };
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

export async function validateAndExecuteProduction(
  prodOrderId: string,
  customBom?: BillOfMaterials,
  forceProduce: boolean = false
): Promise<void> {
  const prodOrder = await db.productionOrders.get(prodOrderId);
  if (!prodOrder) {
    throw new Error('Ordre de production introuvable');
  }

  if (prodOrder.status === 'TERMINÉE') {
    throw new Error('Cet ordre de production est déjà terminé.');
  }

  const bom = customBom || prodOrder.bomSnapshot || (await findApplicableBom(
    prodOrder.modelId,
    prodOrder.materialName,
    prodOrder.frameId
  ));

  const check = await checkProductionMaterials(prodOrder, bom);
  if (!check.canProduce && !forceProduce) {
    const missingDesc = check.missingItems
      .map((m) => `${m.name} (manque ${m.needed - m.available} ${m.unit})`)
      .join(', ');
    throw new Error(`Matières insuffisantes pour la production: ${missingDesc}`);
  }

  const multiplier = prodOrder.quantity;
  const docRef = `Production ${prodOrder.productionNumber} (Commande ${prodOrder.orderNumberSnapshot})`;

  // 1. Consume raw materials
  if (bom && bom.rawMaterialUnitsNeeded > 0) {
    const rawStock = await db.stockItems
      .filter(
        (s) =>
          s.itemType === 'RAW_MATERIAL' &&
          s.materialName?.toLowerCase() === prodOrder.materialName.toLowerCase()
      )
      .first();

    if (rawStock) {
      const neededRaw = bom.rawMaterialUnitsNeeded * multiplier;
      const deduct = Math.min(rawStock.physicalQuantity, neededRaw);
      if (deduct > 0) {
        await adjustStockItemQuantity(
          rawStock.id,
          -deduct,
          'CONSOMMATION',
          docRef,
          `Consommation BOM pour ${multiplier}x ${prodOrder.modelRefSnapshot} ${prodOrder.materialName}`
        );
      }
    }
  }

  // 2. Consume components
  if (bom && bom.items) {
    for (const comp of bom.items) {
      const compStock = await db.stockItems
        .filter((s) => s.itemType === 'COMPONENT' && s.componentId === comp.componentId)
        .first();

      if (compStock) {
        const needed = comp.quantity * multiplier;
        const deduct = Math.min(compStock.physicalQuantity, needed);
        if (deduct > 0) {
          await adjustStockItemQuantity(
            compStock.id,
            -deduct,
            'CONSOMMATION',
            docRef,
            `Consommation BOM composant: ${comp.componentName}`
          );
        }
      }
    }
  }

  // 3. Add finished doors to stock
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

  await adjustStockItemQuantity(
    doorStock.id,
    prodOrder.quantity,
    'PRODUCTION',
    docRef,
    `Fabrication terminée: ${prodOrder.quantity}x ${prodOrder.modelRefSnapshot} (${prodOrder.width}x${prodOrder.height} cm)`
  );

  // 4. Update production order status to TERMINÉE
  const now = new Date().toISOString();
  await db.productionOrders.update(prodOrderId, {
    status: 'TERMINÉE',
    completedAt: now,
    updatedAt: now
  });

  // 5. Update order item & check if all production orders for parent order are completed
  const parentOrder = await db.orders.get(prodOrder.orderId);
  if (parentOrder) {
    const allProdForOrder = await db.productionOrders
      .where('orderId')
      .equals(prodOrder.orderId)
      .toArray();

    const allFinished = allProdForOrder.every((p) => p.id === prodOrderId ? true : p.status === 'TERMINÉE');
    if (allFinished && (parentOrder.status === 'À PRODUIRE' || parentOrder.status === 'EN PRODUCTION')) {
      await db.orders.update(parentOrder.id, {
        status: 'PRÊTE',
        updatedAt: now
      });
      await recordAudit(
        'Commande prête',
        'orders',
        `Commande ${parentOrder.orderNumber} passée au statut PRÊTE (fabrication achevée)`,
        parentOrder.id
      );
    }
  }

  await recordAudit(
    'Production terminée',
    'productionOrders',
    `Validation production ${prodOrder.productionNumber}: ${prodOrder.quantity}x ${prodOrder.modelRefSnapshot}`,
    prodOrderId
  );
}
