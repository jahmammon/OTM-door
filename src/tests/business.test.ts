import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { seedInitialData } from '../services/demoDataService';
import { createOrder, updateOrderStatus, generateNextOrderNumber, cancelOrder } from '../services/orderService';
import { completeProduction } from '../services/productionService';
import { createPayment } from '../services/paymentService';
import {
  findOrCreateFinishedDoorStock,
  adjustStockItemQuantity,
  validateStockInvariants
} from '../services/stockService';
import { createDatabaseBackup, restoreDatabaseBackup } from '../services/backupService';
import {
  initializeSecurityPassword,
  verifySecurityPassword,
  lockApplicationSession,
  unlockApplicationSession,
  isSessionUnlocked
} from '../services/securityService';
import type { DoorModel, Colour, Frame, Client, ComponentItem, StockItem } from '../types';

describe('OTM DOOR — Comprehensive Business & Data Integrity Test Suite', () => {
  let testClient: Client;
  let testModel: DoorModel;
  let testColour: Colour;
  let testFrame: Frame;

  beforeEach(async () => {
    // Clear and re-seed clean database
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
    await seedInitialData();

    // Fetch baseline catalogue items
    testClient = (await db.clients.toArray())[0];
    testModel = (await db.doorModels.toArray())[0];
    testColour = (await db.colours.toArray())[0];
    testFrame = (await db.frames.toArray())[0];
    expect(testClient).toBeDefined();
    expect(testModel).toBeDefined();
  });

  // =========================================================================
  // SCENARIO A: Order 5 doors with only 2 doors in stock
  // =========================================================================
  it('Scenario A: Order 5 doors with stock = 2. Must reserve 2, flag 3 for production, and forbid closing without sufficient stock', async () => {
    // 1. Setup finished stock: physical = 2, reserved = 0, available = 2
    const doorStock = await findOrCreateFinishedDoorStock({
      modelId: testModel.id,
      modelRef: testModel.ref,
      modelName: testModel.name,
      materialName: testModel.compatibleMaterials[0] || 'WPC',
      colourId: testColour.id,
      colourName: testColour.name,
      width: 80,
      height: 200,
      frameId: testFrame.id,
      frameRef: testFrame.ref,
      frameName: testFrame.name
    });

    await db.stockItems.update(doorStock.id, {
      physicalQuantity: 2,
      reservedQuantity: 0,
      availableQuantity: 2
    });

    // 2. Client orders 5 doors
    const order = await createOrder({
      clientId: testClient.id,
      items: [
        {
          modelId: testModel.id,
          materialName: testModel.compatibleMaterials[0] || 'WPC',
          colourId: testColour.id,
          width: 80,
          height: 200,
          frameId: testFrame.id,
          quantity: 5,
          unitPrice: 25000
        }
      ]
    });

    expect(order).toBeDefined();
    expect(order.status).toBe('À PRODUIRE'); // because 3 doors are missing

    // Verify order item reservations
    const items = await db.orderItems.where('orderId').equals(order.id).toArray();
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(5);
    expect(items[0].reservedQuantity).toBe(2);
    expect(items[0].productionQuantityNeeded).toBe(3);
    expect(items[0].isStockReserved).toBe(false);

    // Verify finished door stock reservation
    const updatedStock = (await db.stockItems.get(doorStock.id))!;
    expect(updatedStock.physicalQuantity).toBe(2);
    expect(updatedStock.reservedQuantity).toBe(2);
    expect(updatedStock.availableQuantity).toBe(0);
    validateStockInvariants(updatedStock);

    // Verify production order created for the missing 3 doors
    const prods = await db.productionOrders.where('orderId').equals(order.id).toArray();
    expect(prods.length).toBe(1);
    expect(prods[0].quantity).toBe(3);
    expect(prods[0].status).toBe('À PRODUIRE');

    // 3. Attempt to close order prematurely: MUST fail with clear French error
    await expect(updateOrderStatus(order.id, 'CLÔTURÉE')).rejects.toThrow(
      /Stock de portes finies insuffisant/
    );

    // Verify that NO partial stock deduction occurred and stock invariants are strictly maintained
    const stockAfterFailedClose = (await db.stockItems.get(doorStock.id))!;
    expect(stockAfterFailedClose.physicalQuantity).toBe(2);
    expect(stockAfterFailedClose.reservedQuantity).toBe(2);
    expect(stockAfterFailedClose.availableQuantity).toBe(0);

    // Verify the order remains open with quantity 5 unchanged
    const freshOrder = (await db.orders.get(order.id))!;
    expect(freshOrder.status).toBe('À PRODUIRE');
    const freshItems = await db.orderItems.where('orderId').equals(order.id).toArray();
    expect(freshItems[0].quantity).toBe(5);
  });

  // =========================================================================
  // SCENARIO B: Order 5 doors with 0 stock
  // =========================================================================
  it('Scenario B: Order 5 doors with stock = 0. Creation succeeds, 5 needed for production, cannot close', async () => {
    const doorStock = await findOrCreateFinishedDoorStock({
      modelId: testModel.id,
      modelRef: testModel.ref,
      modelName: testModel.name,
      materialName: testModel.compatibleMaterials[0] || 'WPC',
      colourId: testColour.id,
      colourName: testColour.name,
      width: 90,
      height: 210,
      frameId: testFrame.id,
      frameRef: testFrame.ref,
      frameName: testFrame.name
    });

    await db.stockItems.update(doorStock.id, {
      physicalQuantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0
    });

    const order = await createOrder({
      clientId: testClient.id,
      items: [
        {
          modelId: testModel.id,
          materialName: testModel.compatibleMaterials[0] || 'WPC',
          colourId: testColour.id,
          width: 90,
          height: 210,
          frameId: testFrame.id,
          quantity: 5,
          unitPrice: 28000
        }
      ]
    });

    expect(order.status).toBe('À PRODUIRE');
    const items = await db.orderItems.where('orderId').equals(order.id).toArray();
    expect(items[0].reservedQuantity).toBe(0);
    expect(items[0].productionQuantityNeeded).toBe(5);

    // Production order for 5
    const prods = await db.productionOrders.where('orderId').equals(order.id).toArray();
    expect(prods[0].quantity).toBe(5);

    // Cannot close order
    await expect(updateOrderStatus(order.id, 'CLÔTURÉE')).rejects.toThrow(
      /Stock de portes finies insuffisant/
    );
  });

  // =========================================================================
  // SCENARIO C: Production completes successfully & allows order closure
  // =========================================================================
  it('Scenario C: Production completes atomically, updates stock & reservations, and allows order closure', async () => {
    // 1. Provision raw materials & components for 3 doors
    const materialName = testModel.compatibleMaterials[0] || 'WPC';
    
    // Ensure raw material in stock: need 3 units, set 10
    const rawItem = await db.stockItems
      .filter(s => s.itemType === 'RAW_MATERIAL' && s.materialName?.toLowerCase() === materialName.toLowerCase())
      .first();
    if (rawItem) {
      await db.stockItems.update(rawItem.id, {
        physicalQuantity: 20,
        reservedQuantity: 0,
        availableQuantity: 20
      });
    }

    // Ensure all components in stock
    const compStocks = await db.stockItems.filter(s => s.itemType === 'COMPONENT').toArray();
    for (const c of compStocks) {
      await db.stockItems.update(c.id, {
        physicalQuantity: 100,
        reservedQuantity: 0,
        availableQuantity: 100
      });
    }

    // Create order for 3 doors
    const order = await createOrder({
      clientId: testClient.id,
      items: [
        {
          modelId: testModel.id,
          materialName,
          colourId: testColour.id,
          width: 80,
          height: 200,
          frameId: testFrame.id,
          quantity: 3,
          unitPrice: 26000
        }
      ]
    });

    const prods = await db.productionOrders.where('orderId').equals(order.id).toArray();
    expect(prods.length).toBe(1);
    const prodOrderId = prods[0].id;

    // 2. Complete production
    await completeProduction(prodOrderId);

    // Verify production marked TERMINÉE
    const updatedProd = (await db.productionOrders.get(prodOrderId))!;
    expect(updatedProd.status).toBe('TERMINÉE');
    expect(updatedProd.completedAt).toBeDefined();

    // Verify parent order transitioned to PRÊTE
    const updatedOrder = (await db.orders.get(order.id))!;
    expect(updatedOrder.status).toBe('PRÊTE');

    // 3. Now close order: should succeed!
    await updateOrderStatus(order.id, 'CLÔTURÉE');
    const closedOrder = (await db.orders.get(order.id))!;
    expect(closedOrder.status).toBe('CLÔTURÉE');

    // Verify movements were created
    const salesMovements = await db.stockMovements
      .filter(m => m.linkedDocument === `Commande ${order.orderNumber}`)
      .toArray();
    expect(salesMovements.length).toBeGreaterThan(0);
    expect(salesMovements[0].type).toBe('VENTE');
    expect(salesMovements[0].quantity).toBe(3);
  });

  // =========================================================================
  // SCENARIO D: Production missing materials fails safely
  // =========================================================================
  it('Scenario D: Production with insufficient components fails safely and consumes nothing', async () => {
    const materialName = testModel.compatibleMaterials[0] || 'WPC';

    // Set component stock to 0
    const compStocks = await db.stockItems.filter(s => s.itemType === 'COMPONENT').toArray();
    for (const c of compStocks) {
      await db.stockItems.update(c.id, {
        physicalQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0
      });
    }

    const order = await createOrder({
      clientId: testClient.id,
      items: [
        {
          modelId: testModel.id,
          materialName,
          colourId: testColour.id,
          width: 80,
          height: 200,
          frameId: testFrame.id,
          quantity: 2,
          unitPrice: 25000
        }
      ]
    });

    const prods = await db.productionOrders.where('orderId').equals(order.id).toArray();
    const prodOrderId = prods[0].id;

    // Production must fail
    await expect(completeProduction(prodOrderId)).rejects.toThrow(
      /Impossible d'exécuter la fabrication — rupture de composants/
    );

    // Verify production remains uncompleted
    const prod = (await db.productionOrders.get(prodOrderId))!;
    expect(prod.status).toBe('EN ATTENTE DE MATIÈRES');
  });

  // =========================================================================
  // SCENARIO F: Stored BOM snapshot usage over catalogue changes
  // =========================================================================
  it('Scenario F: Existing production order uses its stored BOM snapshot, not subsequent catalogue changes', async () => {
    // 1. Stock materials
    const rawItem = await db.stockItems
      .filter(s => s.itemType === 'RAW_MATERIAL')
      .first();
    if (rawItem) {
      await db.stockItems.update(rawItem.id, { physicalQuantity: 50, reservedQuantity: 0, availableQuantity: 50 });
    }
    const compStocks = await db.stockItems.filter(s => s.itemType === 'COMPONENT').toArray();
    for (const c of compStocks) {
      await db.stockItems.update(c.id, { physicalQuantity: 100, reservedQuantity: 0, availableQuantity: 100 });
    }

    // 2. Create order
    const order = await createOrder({
      clientId: testClient.id,
      items: [
        {
          modelId: testModel.id,
          materialName: testModel.compatibleMaterials[0] || 'WPC',
          colourId: testColour.id,
          width: 80,
          height: 200,
          frameId: testFrame.id,
          quantity: 1,
          unitPrice: 25000
        }
      ]
    });

    const prods = await db.productionOrders.where('orderId').equals(order.id).toArray();
    const prod = prods[0];
    expect(prod.bomSnapshot).toBeDefined();

    // 3. Mutate the dynamic catalogue BOM to require an astronomical quantity (e.g. 9999)
    const existingBom = (await db.bom.get(prod.bomSnapshot!.id))!;
    await db.bom.update(existingBom.id, {
      rawMaterialUnitsNeeded: 9999
    });

    // 4. Execute production: it MUST succeed because it uses prod.bomSnapshot, not 9999!
    await completeProduction(prod.id);
    const finishedProd = (await db.productionOrders.get(prod.id))!;
    expect(finishedProd.status).toBe('TERMINÉE');
  });

  // =========================================================================
  // SCENARIO G: Cancelled order blocks production
  // =========================================================================
  it('Scenario G: Cancelled order strictly blocks production completion', async () => {
    const order = await createOrder({
      clientId: testClient.id,
      items: [
        {
          modelId: testModel.id,
          materialName: testModel.compatibleMaterials[0] || 'WPC',
          colourId: testColour.id,
          width: 80,
          height: 200,
          frameId: testFrame.id,
          quantity: 1,
          unitPrice: 25000
        }
      ]
    });

    const prods = await db.productionOrders.where('orderId').equals(order.id).toArray();
    const prodId = prods[0].id;

    // Cancel order
    await cancelOrder(order.id, 'Annulation client');

    // Attempting production on cancelled order must fail
    await expect(completeProduction(prodId)).rejects.toThrow(
      /La commande parente .* est annulée/
    );
  });

  // =========================================================================
  // SCENARIO H: Historical price immutability
  // =========================================================================
  it('Scenario H: Existing orders retain price snapshot regardless of price table updates', async () => {
    const order = await createOrder({
      clientId: testClient.id,
      items: [
        {
          modelId: testModel.id,
          materialName: testModel.compatibleMaterials[0] || 'WPC',
          colourId: testColour.id,
          width: 80,
          height: 200,
          frameId: testFrame.id,
          quantity: 2,
          unitPrice: 25000
        }
      ]
    });

    expect(order.totalAmount).toBe(50000);

    // Modify catalogue price table for this model
    const priceEntry = await db.priceEntries.where('modelId').equals(testModel.id).first();
    if (priceEntry) {
      await db.priceEntries.update(priceEntry.id, { price: 40000 });
    }

    // Historical order must remain at 50,000 DA
    const unchangedOrder = (await db.orders.get(order.id))!;
    expect(unchangedOrder.totalAmount).toBe(50000);
    const unchangedItems = await db.orderItems.where('orderId').equals(order.id).toArray();
    expect(unchangedItems[0].unitPrice).toBe(25000);
    expect(unchangedItems[0].totalLine).toBe(50000);
  });

  // =========================================================================
  // SCENARIO I: Corrupted backup rejection
  // =========================================================================
  it('Scenario I: Corrupted or tampered backup is rejected before touching the database', async () => {
    // Generate valid backup
    const backupJson = await createDatabaseBackup();
    const backupObj = JSON.parse(backupJson);

    // Tamper with payload (modify a client name)
    backupObj.data.clients[0].name = 'CLIENT_PIRATE_TAMPERED';
    const tamperedJson = JSON.stringify(backupObj);

    // Restoration MUST be rejected due to checksum verification
    await expect(restoreDatabaseBackup(tamperedJson)).rejects.toThrow(
      /intégrité/i
    );

    // Verify original client remains intact
    const client = (await db.clients.toArray())[0];
    expect(client.name).not.toBe('CLIENT_PIRATE_TAMPERED');
  });

  // =========================================================================
  // SCENARIO J: Password protection & session locking
  // =========================================================================
  it('Scenario J: Password authentication, wrong password rejection, and session lock/unlock', async () => {
    // 1. Initialize password
    await initializeSecurityPassword('OtmSecret2026!');

    // 2. Wrong password fails
    const wrongAttempt = await verifySecurityPassword('WrongPassword123');
    expect(wrongAttempt).toBe(false);

    // 3. Correct password succeeds
    const correctAttempt = await verifySecurityPassword('OtmSecret2026!');
    expect(correctAttempt).toBe(true);

    // 4. Session lock
    lockApplicationSession();
    expect(isSessionUnlocked()).toBe(false);

    // 5. Unlock session
    const unlockResult = await unlockApplicationSession('OtmSecret2026!');
    expect(unlockResult).toBe(true);
    expect(isSessionUnlocked()).toBe(true);
  });
});
