import { db, recordAudit, getSettings } from '../db';
import type {
  Order,
  OrderItem,
  OrderStatus,
  ProductionOrder,
  ProductionStatus,
  Client,
  DoorModel,
  Colour,
  Frame
} from '../types';
import {
  findOrCreateFinishedDoorStock,
  reserveFinishedDoorStock,
  releaseFinishedDoorReservation,
  adjustStockItemQuantity
} from './stockService';
import { findApplicableBom, checkProductionMaterials } from './productionService';
import { generateSafeSequence } from './sequenceService';

export interface CreateOrderItemInput {
  modelId: string;
  materialName: string;
  colourId: string;
  width: number;
  height: number;
  frameId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface CreateOrderInput {
  clientId: string;
  date?: string;
  expectedDate?: string;
  notes?: string;
  discount?: number;
  initialDeposit?: number;
  depositPaymentMethod?: string;
  items: CreateOrderItemInput[];
}

export async function generateNextOrderNumber(): Promise<string> {
  return await generateSafeSequence('ORDER');
}

export async function generateNextProductionNumber(): Promise<string> {
  return await generateSafeSequence('PRODUCTION');
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const client = await db.clients.get(input.clientId);
  if (!client) {
    throw new Error('Client introuvable');
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('La commande doit comporter au moins un article');
  }

  // Execute all operations atomically inside a Dexie transaction
  return await db.transaction(
    'rw',
    [
      db.settings,
      db.clients,
      db.doorModels,
      db.colours,
      db.frames,
      db.bom,
      db.orders,
      db.orderItems,
      db.productionOrders,
      db.stockItems,
      db.stockMovements,
      db.payments,
      db.auditLogs
    ],
    async () => {
      const orderNumber = await generateNextOrderNumber();
      const orderId = 'ord_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const now = new Date().toISOString();
      const dateStr = input.date || now.split('T')[0];

      let subtotal = 0;
      const preparedItems: OrderItem[] = [];
      let hasProductionNeeded = false;

      // Process and calculate each line
      for (const it of input.items) {
        const model = await db.doorModels.get(it.modelId);
        const colour = await db.colours.get(it.colourId);
        const frame = it.frameId ? await db.frames.get(it.frameId) : undefined;

        const modelRef = model?.ref || 'MOD';
        const modelName = model?.name || 'Porte';
        const colourName = colour?.name || 'Standard';
        const frameName = frame?.name || (frame?.ref ? `Cadre ${frame.ref}` : 'Sans cadre');

        const lineTotal = Number(it.quantity) * Number(it.unitPrice);
        subtotal += lineTotal;

        const itemId = 'ordi_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

        // Check stock for finished door
        const doorStock = await findOrCreateFinishedDoorStock({
          modelId: it.modelId,
          modelRef,
          modelName,
          materialName: it.materialName,
          colourId: it.colourId,
          colourName,
          width: it.width,
          height: it.height,
          frameId: it.frameId,
          frameRef: frame?.ref || '',
          frameName
        });

        // Check available stock for finished door (never reserve more than physically available)
        const availableInStock = Math.max(0, doorStock.physicalQuantity - doorStock.reservedQuantity);
        const toReserve = Math.min(it.quantity, availableInStock);

        let reservedQuantity = 0;
        if (toReserve > 0) {
          const reservation = await reserveFinishedDoorStock(
            doorStock.id,
            toReserve,
            orderNumber
          );
          reservedQuantity = reservation.reserved;
        }

        const neededProduction = it.quantity - reservedQuantity;

        if (neededProduction > 0) {
          hasProductionNeeded = true;
        }

        const orderItem: OrderItem = {
          id: itemId,
          orderId,
          modelId: it.modelId,
          modelRefSnapshot: modelRef,
          modelNameSnapshot: modelName,
          materialName: it.materialName,
          colourId: it.colourId,
          colourNameSnapshot: colourName,
          width: Number(it.width),
          height: Number(it.height),
          frameId: it.frameId,
          frameNameSnapshot: frameName,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          totalLine: lineTotal,
          isStockReserved: reservedQuantity === it.quantity,
          reservedQuantity,
          productionQuantityNeeded: neededProduction,
          notes: it.notes,
          createdAt: now,
          updatedAt: now
        };

        preparedItems.push(orderItem);

        // If production is needed, create a production order for missing units
        if (neededProduction > 0) {
          const prodNum = await generateNextProductionNumber();
          const bom = await findApplicableBom(it.modelId, it.materialName, it.frameId);

          const prodOrder: ProductionOrder = {
            id: 'prod_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            productionNumber: prodNum,
            orderId,
            orderNumberSnapshot: orderNumber,
            orderItemId: itemId,
            modelId: it.modelId,
            modelRefSnapshot: modelRef,
            modelNameSnapshot: modelName,
            materialName: it.materialName,
            colourId: it.colourId,
            colourNameSnapshot: colourName,
            width: Number(it.width),
            height: Number(it.height),
            frameId: it.frameId,
            frameNameSnapshot: frameName,
            quantity: neededProduction,
            status: 'À PRODUIRE',
            cncImageSnapshot: model?.cncImage,
            bomSnapshot: bom,
            createdAt: now,
            updatedAt: now
          };

          // Check materials for this production order
          const matCheck = await checkProductionMaterials(prodOrder, bom);
          if (!matCheck.canProduce) {
            prodOrder.status = 'EN ATTENTE DE MATIÈRES';
            prodOrder.notes = `En attente de matières : ${matCheck.missingItems
              .map((m) => `${m.name} (manquant: ${Math.max(0, m.needed - m.available)} ${m.unit})`)
              .join(' ; ')}`;
          } else {
            prodOrder.status = 'À PRODUIRE';
            prodOrder.notes = 'Matières premières et composants disponibles en stock';
          }

          await db.productionOrders.add(prodOrder);
        }
      }

      const discount = Math.max(0, Number(input.discount || 0));
      const totalAmount = Math.max(0, subtotal - discount);

      // Initial status: if production needed -> À PRODUIRE, else PRÊTE
      const initialStatus: OrderStatus = hasProductionNeeded ? 'À PRODUIRE' : 'PRÊTE';

      const order: Order = {
        id: orderId,
        orderNumber,
        date: dateStr,
        clientId: client.id,
        clientNameSnapshot: client.name,
        clientPhoneSnapshot: client.phone,
        clientAddressSnapshot: `${client.address}, ${client.commune}, ${client.wilaya}`,
        expectedDate: input.expectedDate,
        notes: input.notes,
        status: initialStatus,
        subtotal,
        discount,
        totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        createdAt: now,
        updatedAt: now
      };

      await db.orders.add(order);
      await db.orderItems.bulkAdd(preparedItems);

      if (input.initialDeposit && input.initialDeposit > 0) {
        const depositAmount = Math.min(input.initialDeposit, totalAmount);
        const receiptNum = await generateSafeSequence('RECEIPT');
        const paymentId = 'pay_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

        await db.payments.add({
          id: paymentId,
          receiptNumber: receiptNum,
          orderId,
          orderNumberSnapshot: orderNumber,
          clientId: client.id,
          clientNameSnapshot: client.name,
          date: dateStr,
          amount: depositAmount,
          paymentMethod: (input.depositPaymentMethod as any) || 'Espèces',
          note: 'Versement initial / Acompte à la commande',
          createdAt: now
        });

        order.paidAmount = depositAmount;
        order.remainingAmount = Math.max(0, totalAmount - depositAmount);
        await db.orders.update(orderId, {
          paidAmount: order.paidAmount,
          remainingAmount: order.remainingAmount,
          updatedAt: now
        });
      }

      await recordAudit(
        'Création commande',
        'orders',
        `Commande ${orderNumber} créée pour client ${client.name}. Total: ${totalAmount.toLocaleString('fr-DZ')} DA. Statut: ${initialStatus}`,
        orderId
      );

      return order;
    }
  );
}

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Commande introuvable');

  const oldStatus = order.status;
  if (oldStatus === newStatus) return;

  const now = new Date().toISOString();

  await db.transaction(
    'rw',
    [
      db.orders,
      db.orderItems,
      db.productionOrders,
      db.stockItems,
      db.stockMovements,
      db.auditLogs
    ],
    async () => {
      // If cancelling order: release all reserved stocks and cancel production orders
      if (newStatus === 'ANNULÉE') {
        const items = await db.orderItems.where('orderId').equals(orderId).toArray();
        for (const item of items) {
          if (item.reservedQuantity > 0) {
            const doorStock = await findOrCreateFinishedDoorStock({
              modelId: item.modelId,
              modelRef: item.modelRefSnapshot,
              modelName: item.modelNameSnapshot,
              materialName: item.materialName,
              colourId: item.colourId,
              colourName: item.colourNameSnapshot,
              width: item.width,
              height: item.height,
              frameId: item.frameId,
              frameRef: item.frameNameSnapshot,
              frameName: item.frameNameSnapshot
            });

            await releaseFinishedDoorReservation(
              doorStock.id,
              item.reservedQuantity,
              order.orderNumber
            );
          }
        }

        const prodOrders = await db.productionOrders.where('orderId').equals(orderId).toArray();
        for (const p of prodOrders) {
          if (p.status !== 'TERMINÉE') {
            await db.productionOrders.update(p.id, {
              status: 'ANNULÉE',
              updatedAt: now
            });
          }
        }
      }

      // If closing / delivering order: deduct reserved stock permanently as VENTE
      if (newStatus === 'CLÔTURÉE' && oldStatus !== 'CLÔTURÉE') {
        const items = await db.orderItems.where('orderId').equals(orderId).toArray();
        const pendingShortages: string[] = [];
        const stockItemsToDeduct: { doorStock: any; item: OrderItem }[] = [];

        // 1. Pre-validation: verify all order lines are physically present in stock
        for (const item of items) {
          const doorStock = await findOrCreateFinishedDoorStock({
            modelId: item.modelId,
            modelRef: item.modelRefSnapshot,
            modelName: item.modelNameSnapshot,
            materialName: item.materialName,
            colourId: item.colourId,
            colourName: item.colourNameSnapshot,
            width: item.width,
            height: item.height,
            frameId: item.frameId,
            frameRef: item.frameNameSnapshot,
            frameName: item.frameNameSnapshot
          });

          if (doorStock.physicalQuantity < item.quantity) {
            const shortage = item.quantity - doorStock.physicalQuantity;
            pendingShortages.push(
              `• ${item.modelRefSnapshot} (${item.width}x${item.height} cm) : Requis = ${item.quantity}, Stock physique disponible = ${doorStock.physicalQuantity} (manque ${shortage} unité(s))`
            );
          } else {
            stockItemsToDeduct.push({ doorStock, item });
          }
        }

        if (pendingShortages.length > 0) {
          throw new Error(
            `Impossible de clôturer la commande ${order.orderNumber} — Stock de portes finies insuffisant :\n` +
            pendingShortages.join('\n') +
            '\nLa commande reste ouverte et aucune déduction partielle n\'a été effectuée. La quantité commandée reste inchangée.'
          );
        }

        // 2. All items available: deduct exact required quantity
        for (const { doorStock, item } of stockItemsToDeduct) {
          const freshDoor = (await db.stockItems.get(doorStock.id)) || doorStock;
          const newPhysical = freshDoor.physicalQuantity - item.quantity;
          const newReserved = Math.max(0, freshDoor.reservedQuantity - item.reservedQuantity);
          const newAvailable = newPhysical - newReserved;

          if (newPhysical < 0 || newReserved < 0 || newReserved > newPhysical || newAvailable < 0) {
            throw new Error(
              `Violation d'invariants de stock lors de la clôture de la commande ${order.orderNumber} pour ${item.modelRefSnapshot}`
            );
          }

          await db.stockItems.update(freshDoor.id, {
            physicalQuantity: newPhysical,
            reservedQuantity: newReserved,
            availableQuantity: newAvailable,
            updatedAt: now
          });

          await db.stockMovements.add({
            id: 'mvt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            date: now.split('T')[0],
            time: new Date().toTimeString().split(' ')[0],
            articleSnapshot: `Porte ${item.modelRefSnapshot} (${item.width}x${item.height} cm)`,
            itemType: 'FINISHED_DOOR',
            stockItemId: freshDoor.id,
            quantity: item.quantity,
            direction: 'OUT',
            type: 'VENTE',
            linkedDocument: `Commande ${order.orderNumber}`,
            motif: `Sortie définitive pour livraison commande`,
            createdAt: now
          });
        }
      }

      await db.orders.update(orderId, {
        status: newStatus,
        updatedAt: now
      });

      await recordAudit(
        'Changement statut commande',
        'orders',
        `Commande ${order.orderNumber}: ${oldStatus} -> ${newStatus}`,
        orderId
      );
    }
  );
}

export async function cancelOrder(orderId: string, reason?: string): Promise<void> {
  await updateOrderStatus(orderId, 'ANNULÉE');
  if (reason) {
    await recordAudit('Annulation commande', 'orders', `Motif: ${reason}`, orderId);
  }
}

export async function recalculateOrderTotals(orderId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) return;

  const items = await db.orderItems.where('orderId').equals(orderId).toArray();
  const payments = await db.payments.where('orderId').equals(orderId).toArray();

  const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
  const totalAmount = Math.max(0, subtotal - (order.discount || 0));
  const paidAmount = payments.reduce((acc, p) => acc + p.amount, 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  await db.orders.update(orderId, {
    subtotal,
    totalAmount,
    paidAmount,
    remainingAmount,
    updatedAt: new Date().toISOString()
  });
}
