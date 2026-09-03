import { db, recordAudit, getSettings } from '../db';
import type {
  Order,
  OrderItem,
  OrderStatus,
  ProductionOrder,
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
import { findApplicableBom } from './productionService';

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
  const settings = await getSettings();
  const prefix = settings?.orderPrefix || 'OTM-2026-';
  const nextNum = settings?.nextOrderNum || 1;
  const numStr = String(nextNum).padStart(4, '0');
  
  if (settings) {
    await db.settings.update(settings.id!, {
      nextOrderNum: nextNum + 1,
      updatedAt: new Date().toISOString()
    });
  }

  return `${prefix}${numStr}`;
}

export async function generateNextProductionNumber(): Promise<string> {
  const settings = await getSettings();
  const prefix = settings?.productionPrefix || 'PROD-2026-';
  const nextNum = settings?.nextProductionNum || 1;
  const numStr = String(nextNum).padStart(4, '0');

  if (settings) {
    await db.settings.update(settings.id!, {
      nextProductionNum: nextNum + 1,
      updatedAt: new Date().toISOString()
    });
  }

  return `${prefix}${numStr}`;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const client = await db.clients.get(input.clientId);
  if (!client) {
    throw new Error('Client introuvable');
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('La commande doit comporter au moins un article');
  }

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
    const frame = await db.frames.get(it.frameId);

    const modelRef = model?.ref || 'MOD';
    const modelName = model?.name || 'Porte';
    const colourName = colour?.name || 'Standard';
    const frameName = frame?.name || (frame?.ref ? `Cadre ${frame.ref}` : 'Standard');

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

    const reservation = await reserveFinishedDoorStock(
      doorStock.id,
      it.quantity,
      orderNumber
    );

    const reservedQuantity = reservation.reserved;
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
      isStockReserved: reservedQuantity > 0,
      reservedQuantity,
      productionQuantityNeeded: neededProduction,
      notes: it.notes,
      createdAt: now,
      updatedAt: now
    };

    preparedItems.push(orderItem);

    // If production is needed, create a production order
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
    const receiptNum = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
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

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Commande introuvable');

  const oldStatus = order.status;
  if (oldStatus === newStatus) return;

  const now = new Date().toISOString();

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

      // Deduct from physical stock and release reservation
      const deductQty = Math.min(doorStock.physicalQuantity, item.quantity);
      if (deductQty > 0) {
        // Adjust physical stock directly with VENTE
        const newPhysical = doorStock.physicalQuantity - deductQty;
        const newReserved = Math.max(0, doorStock.reservedQuantity - item.reservedQuantity);
        const newAvailable = Math.max(0, newPhysical - newReserved);

        await db.stockItems.update(doorStock.id, {
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
          stockItemId: doorStock.id,
          quantity: deductQty,
          direction: 'OUT',
          type: 'VENTE',
          linkedDocument: `Commande ${order.orderNumber}`,
          motif: `Sortie définitive pour livraison commande`,
          createdAt: now
        });
      }
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
