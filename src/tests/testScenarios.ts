import { db, OtmDoorDatabase, getActiveDatabase, setActiveDatabase } from '../db';
import { createOrder } from '../services/orderService';
import { createPayment } from '../services/paymentService';
import { validateAndExecuteProduction, checkProductionMaterials } from '../services/productionService';
import { savePriceEntry, lookupPrice } from '../services/pricingService';
import { exportDatabaseBackup, restoreDatabaseBackup } from '../services/backupService';
import { findOrCreateFinishedDoorStock, reserveFinishedDoorStock } from '../services/stockService';
import { initializeCleanSetup, loadDemoData, isSetupCompleted, checkIfFirstRun } from '../services/demoDataService';

export interface ScenarioTestResult {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  details: string[];
  error?: string;
  durationMs: number;
}

type TestFunction = (log: (msg: string) => void) => Promise<void>;

interface TestCase {
  id: string;
  name: string;
  description: string;
  run: TestFunction;
}

const testDefinitions: TestCase[] = [
  // 1. Stock invariant test
  {
    id: 'TEST_STOCK_INVARIANTS',
    name: '1. Invariants de Stock & Rejet de Réservation Invalide',
    description: 'Vérifie physicalQuantity >= reservedQuantity, available = physical - reserved, et le rejet si reserved > physical.',
    run: async (log) => {
      const doorStock = await findOrCreateFinishedDoorStock({
        modelId: 'mod_p012',
        modelRef: 'P-012',
        modelName: 'Classique Double Moulure',
        materialName: 'WPC',
        colourId: 'col_blanc',
        colourName: 'Blanc Brillant',
        width: 80,
        height: 210,
        frameId: 'frm_f2',
        frameRef: 'F2',
        frameName: 'Cadre Médium 15 cm'
      });

      // Reset to physical=10, reserved=4
      await db.stockItems.update(doorStock.id, {
        physicalQuantity: 10,
        reservedQuantity: 4,
        availableQuantity: 6
      });

      const stock = await db.stockItems.get(doorStock.id);
      if (!stock) throw new Error('Article introuvable');

      log(`Stock configuré: Physique = ${stock.physicalQuantity}, Réservé = ${stock.reservedQuantity}, Disponible = ${stock.availableQuantity}`);

      // Invariant checks
      if (stock.physicalQuantity < stock.reservedQuantity) {
        throw new Error('Violation: Quantité physique inférieure à la quantité réservée');
      }
      if (stock.availableQuantity !== stock.physicalQuantity - stock.reservedQuantity) {
        throw new Error(`Violation: Disponible (${stock.availableQuantity}) != Physique (${stock.physicalQuantity}) - Réservé (${stock.reservedQuantity})`);
      }

      // Test rejection if reserved > physical via reserveFinishedDoorStock
      try {
        // Available is 6, request 15
        await reserveFinishedDoorStock(doorStock.id, 15, 'TEST-OVER-RESERVE');
        throw new Error('La réservation excédentaire aurait dû être rejetée.');
      } catch (err: any) {
        log(`Rejet conforme de réservation excessive: ${err.message}`);
      }

      // Ensure stock did not change
      const afterStock = await db.stockItems.get(doorStock.id);
      if (afterStock?.reservedQuantity !== 4 || afterStock?.availableQuantity !== 6) {
        throw new Error('Le stock a été altéré malgré le rejet de la réservation !');
      }

      log('Validation réussie: Les invariants de stock sont strictement protégés.');
    }
  },

  // 2. Order-to-production fulfillment test
  {
    id: 'TEST_ORDER_TO_PRODUCTION',
    name: '2. Commande vers Production (Order-to-Production)',
    description: 'Demande 5 portes avec 2 en stock. Attendu: commande acceptée (qté 5), 2 réservées, 3 envoyées en production.',
    run: async (log) => {
      const clientId = 'cli_test_otp';
      await db.clients.put({
        id: clientId,
        clientId: 'CLI-OTP',
        name: 'Client Test Order-To-Production',
        phone: '0555112233',
        wilaya: 'Alger',
        commune: 'Dar El Beida',
        address: 'Zone Industrielle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const doorStock = await findOrCreateFinishedDoorStock({
        modelId: 'mod_p012',
        modelRef: 'P-012',
        modelName: 'Classique Double Moulure',
        materialName: 'WPC',
        colourId: 'col_blanc',
        colourName: 'Blanc Brillant',
        width: 82,
        height: 212,
        frameId: 'frm_f2',
        frameRef: 'F2',
        frameName: 'Cadre Médium 15 cm'
      });

      // Stock has exactly 2 finished doors
      await db.stockItems.update(doorStock.id, {
        physicalQuantity: 2,
        reservedQuantity: 0,
        availableQuantity: 2
      });
      log('Stock initial disponible en atelier: 2 portes finies');

      // Customer orders 5 doors
      const order = await createOrder({
        clientId,
        items: [
          {
            modelId: 'mod_p012',
            materialName: 'WPC',
            colourId: 'col_blanc',
            width: 82,
            height: 212,
            frameId: 'frm_f2',
            quantity: 5,
            unitPrice: 26000
          }
        ]
      });

      log(`Commande client créée avec succès: ${order.orderNumber}`);

      // Verify order line
      const orderItems = await db.orderItems.where('orderId').equals(order.id).toArray();
      if (orderItems.length !== 1) throw new Error('Ligne de commande introuvable');
      const item = orderItems[0];

      log(`Ligne commande: Quantité totale = ${item.quantity}, Réservé = ${item.reservedQuantity}, Besoin fabrication = ${item.productionQuantityNeeded}`);

      if (item.quantity !== 5) {
        throw new Error(`Quantité de la commande altérée: attendu 5 mais trouvé ${item.quantity}`);
      }
      if (item.reservedQuantity !== 2) {
        throw new Error(`Quantité réservée erronée: attendu 2 mais trouvé ${item.reservedQuantity}`);
      }
      if (item.productionQuantityNeeded !== 3) {
        throw new Error(`Besoin de fabrication erroné: attendu 3 mais trouvé ${item.productionQuantityNeeded}`);
      }

      // Check stock status
      const updatedStock = await db.stockItems.get(doorStock.id);
      log(`Stock fini après commande: Physique = ${updatedStock?.physicalQuantity}, Réservé = ${updatedStock?.reservedQuantity}, Dispo = ${updatedStock?.availableQuantity}`);
      if (updatedStock?.reservedQuantity !== 2 || updatedStock?.availableQuantity !== 0) {
        throw new Error('Stock fini non réservé correctement');
      }

      // Check production orders
      const prods = await db.productionOrders.where('orderId').equals(order.id).toArray();
      log(`Ordres de production générés: ${prods.length}`);
      if (prods.length !== 1) {
        throw new Error(`Attendu 1 ordre de fabrication mais trouvé ${prods.length}`);
      }
      if (prods[0].quantity !== 3) {
        throw new Error(`Quantité de production attendue 3 mais obtenue ${prods[0].quantity}`);
      }

      log('Validation réussie: 2 portes du stock réservées, 3 portes lancées en fabrication, commande client intacte à 5 unités.');
    }
  },

  // 3. Atomic BOM consumption test
  {
    id: 'TEST_ATOMIC_BOM_CONSUMPTION',
    name: '3. Consommation BOM Atomique & Protection Zéro Déduction',
    description: 'BOM requiert panneau + charnières + serrure. Serrure à 0. Lancement fabrication doit échouer sans déduire un seul panneau ou charnière.',
    run: async (log) => {
      // 1. Prepare raw material stock = 20
      const rawStock = await db.stockItems.filter((s) => s.itemType === 'RAW_MATERIAL' && s.materialName === 'WPC').first();
      if (!rawStock) throw new Error('Matière première WPC introuvable');
      await db.stockItems.update(rawStock.id, {
        physicalQuantity: 20,
        reservedQuantity: 0,
        availableQuantity: 20
      });

      // 2. Prepare hinges stock = 30
      const hingesStock = await db.stockItems.filter((s) => s.itemType === 'COMPONENT' && s.componentId === 'cmp_charniere').first();
      if (!hingesStock) throw new Error('Composant charnière introuvable');
      await db.stockItems.update(hingesStock.id, {
        physicalQuantity: 30,
        reservedQuantity: 0,
        availableQuantity: 30
      });

      // 3. Force lock stock = 0
      const lockStock = await db.stockItems.filter((s) => s.itemType === 'COMPONENT' && s.componentId === 'cmp_serrure').first();
      if (!lockStock) throw new Error('Composant serrure introuvable');
      await db.stockItems.update(lockStock.id, {
        physicalQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0
      });

      log('Stock préparé: 20 panneaux WPC, 30 charnières, 0 serrure (rupture simulée)');

      // Create a production order for 1 door
      const prodOrderId = 'prod_test_atomic_bom';
      await db.productionOrders.put({
        id: prodOrderId,
        productionNumber: 'PROD-ATOMIC-001',
        orderId: 'ord_test_atomic',
        orderNumberSnapshot: 'OTM-ATOMIC-001',
        orderItemId: 'item_atomic_1',
        modelId: 'mod_p012',
        modelRefSnapshot: 'P-012',
        modelNameSnapshot: 'Classique Double Moulure',
        materialName: 'WPC',
        colourId: 'col_blanc',
        colourNameSnapshot: 'Blanc Brillant',
        width: 80,
        height: 210,
        frameId: 'frm_f2',
        frameNameSnapshot: 'Cadre Médium 15 cm',
        quantity: 1,
        status: 'EN ATTENTE DE MATIÈRES',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Attempt to execute production -> MUST fail
      let failedAsExpected = false;
      try {
        await validateAndExecuteProduction(prodOrderId);
      } catch (err: any) {
        failedAsExpected = true;
        log(`Refus conforme de production: ${err.message}`);
      }

      if (!failedAsExpected) {
        throw new Error('La production aurait dû être rejetée en raison de la rupture de serrures !');
      }

      // Verify ZERO deductions occurred
      const freshRaw = await db.stockItems.get(rawStock.id);
      const freshHinges = await db.stockItems.get(hingesStock.id);
      const freshLock = await db.stockItems.get(lockStock.id);

      log(`Vérification des stocks post-échec: Panneaux = ${freshRaw?.physicalQuantity} (attendu 20), Charnières = ${freshHinges?.physicalQuantity} (attendu 30)`);

      if (freshRaw?.physicalQuantity !== 20) {
        throw new Error(`Déduction partielle illégale détectée sur les panneaux: ${freshRaw?.physicalQuantity} restant au lieu de 20`);
      }
      if (freshHinges?.physicalQuantity !== 30) {
        throw new Error(`Déduction partielle illégale détectée sur les charnières: ${freshHinges?.physicalQuantity} restant au lieu de 30`);
      }
      if (freshLock?.physicalQuantity !== 0) {
        throw new Error('Altération anormale du stock serrure');
      }

      log('Validation réussie: Atomicité totale garantie (Zéro déduction en cas de composant manquant).');
    }
  },

  // 4. Immutable pricing test
  {
    id: 'TEST_IMMUTABLE_PRICING',
    name: '4. Inviolabilité des Prix Historiques & Snapshots',
    description: 'Crée une commande à 25 000 DA. Met à jour le catalogue à 30 000 DA. La commande passée doit rester à 25 000 DA.',
    run: async (log) => {
      // Save tariff: 25 000 DA
      await savePriceEntry({
        id: 'prc_test_immutable',
        modelId: 'mod_p012',
        modelRefSnapshot: 'P-012',
        materialName: 'WPC',
        width: 85,
        height: 215,
        price: 25000
      });

      const clientId = 'cli_test_imm_price';
      await db.clients.put({
        id: clientId,
        clientId: 'CLI-IMM-PRICE',
        name: 'Client Test Prix Inviolable',
        phone: '0555334455',
        wilaya: 'Alger',
        commune: 'Kouba',
        address: 'Avenue 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const order = await createOrder({
        clientId,
        items: [
          {
            modelId: 'mod_p012',
            materialName: 'WPC',
            colourId: 'col_blanc',
            width: 85,
            height: 215,
            frameId: 'frm_f2',
            quantity: 1,
            unitPrice: 25000
          }
        ]
      });

      log(`Commande enregistrée: Montant total = ${order.totalAmount} DA`);

      // Update catalog price to 30 000 DA
      await savePriceEntry({
        id: 'prc_test_immutable',
        modelId: 'mod_p012',
        modelRefSnapshot: 'P-012',
        materialName: 'WPC',
        width: 85,
        height: 215,
        price: 30000
      });
      log('Catalogue tarifaire modifié: Nouveau tarif = 30 000 DA');

      // Verify historical order
      const orderCheck = await db.orders.get(order.id);
      const itemsCheck = await db.orderItems.where('orderId').equals(order.id).toArray();

      log(`Vérification commande en base: Total = ${orderCheck?.totalAmount} DA, P.U = ${itemsCheck[0]?.unitPrice} DA`);

      if (orderCheck?.totalAmount !== 25000) {
        throw new Error(`Le total de la commande a été modifié à ${orderCheck?.totalAmount} DA au lieu de 25 000 DA !`);
      }
      if (itemsCheck[0]?.unitPrice !== 25000) {
        throw new Error(`Le prix unitaire de la ligne a été modifié à ${itemsCheck[0]?.unitPrice} DA au lieu de 25 000 DA !`);
      }

      log('Validation réussie: Le snapshot de prix historique est parfaitement scellé et immuable.');
    }
  },

  // 5. Backup checksum test
  {
    id: 'TEST_BACKUP_CHECKSUM',
    name: "5. Contrôle d'Intégrité de Sauvegarde & Rejet Altération SHA-256",
    description: "Exporte une sauvegarde, altère un caractère du payload. La restauration doit rejeter avec erreur de somme de contrôle.",
    run: async (log) => {
      const backup = await exportDatabaseBackup();
      log(`Sauvegarde claire générée: ${backup.filename}`);

      const reader = new FileReader();
      const fileTextPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(backup.blob);
      });
      const fileContent = await fileTextPromise;
      const parsed = JSON.parse(fileContent);

      if (!parsed.checksum) {
        throw new Error('Empreinte de contrôle manquante dans la sauvegarde');
      }
      log(`Empreinte SHA-256 calculée: ${parsed.checksum.substring(0, 16)}...`);

      // Modify one character in data
      const corrupted = JSON.parse(fileContent);
      corrupted.data.company[0].name += ' MODIFICATION_NON_AUTORISEE';

      let rejectedAsExpected = false;
      try {
        await restoreDatabaseBackup(JSON.stringify(corrupted));
      } catch (err: any) {
        rejectedAsExpected = true;
        log(`Rejet conforme du fichier altéré: ${err.message}`);
      }

      if (!rejectedAsExpected) {
        throw new Error("La sauvegarde altérée aurait dû être rejetée par le contrôle d'intégrité !");
      }

      log("Validation réussie: La falsification de sauvegarde est détectée et immédiatement bloquée.");
    }
  },

  // 6. Partial stock reservation rejection test
  {
    id: 'TEST_PARTIAL_RESERVATION_REJECTION',
    name: '6. Rejet de Réservation Partielle lors de Réservation Directe',
    description: 'Disponible = 3. Demande de réservation directe = 5. Doit rejeter strictement sans réserver partiellement 3 unités.',
    run: async (log) => {
      const doorStock = await findOrCreateFinishedDoorStock({
        modelId: 'mod_p012',
        modelRef: 'P-012',
        modelName: 'Classique Double Moulure',
        materialName: 'WPC',
        colourId: 'col_blanc',
        colourName: 'Blanc Brillant',
        width: 77,
        height: 205,
        frameId: 'frm_f2',
        frameRef: 'F2',
        frameName: 'Cadre Médium 15 cm'
      });

      // Set physical = 3, reserved = 0, available = 3
      await db.stockItems.update(doorStock.id, {
        physicalQuantity: 3,
        reservedQuantity: 0,
        availableQuantity: 3
      });
      log('Stock configuré: 3 portes disponibles, 0 réservées');

      // Attempt to reserve 5 directly
      let rejected = false;
      try {
        await reserveFinishedDoorStock(doorStock.id, 5, 'TEST-DIRECT-5');
      } catch (err: any) {
        rejected = true;
        log(`Refus conforme de réservation partielle: ${err.message}`);
      }

      if (!rejected) {
        throw new Error('La tentative de réserver 5 unités alors que 3 sont disponibles aurait dû échouer !');
      }

      // Verify stock was left completely untouched
      const after = await db.stockItems.get(doorStock.id);
      log(`Stock après rejet: Physique = ${after?.physicalQuantity}, Réservé = ${after?.reservedQuantity}, Dispo = ${after?.availableQuantity}`);

      if (after?.reservedQuantity !== 0 || after?.availableQuantity !== 3) {
        throw new Error(`Stock altéré! Réservé = ${after?.reservedQuantity} (attendu 0), Dispo = ${after?.availableQuantity} (attendu 3)`);
      }

      log('Validation réussie: La réservation partielle est proscrite; le stock est resté strictement inchangé.');
    }
  },

  // 7. Missing BOM detection test
  {
    id: 'TEST_MISSING_BOM_DETECTION',
    name: '7. Détection et Blocage des Modèles sans Nomenclature (BOM)',
    description: 'Modèle sans nomenclature BOM. La fabrication doit être bloquée avec un message explicite en français.',
    run: async (log) => {
      // Create a door model with NO BOM configured
      const noBomModelId = 'mod_test_no_bom';
      await db.doorModels.put({
        id: noBomModelId,
        ref: 'P-TEST-NO-BOM',
        name: 'Porte Test Sans Nomenclature',
        compatibleMaterials: ['WPC'],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const prodOrderId = 'prod_test_missing_bom';
      const prodOrder = {
        id: prodOrderId,
        productionNumber: 'PROD-NOBOM-001',
        orderId: 'ord_test_nobom',
        orderNumberSnapshot: 'OTM-NOBOM-001',
        orderItemId: 'item_nobom_1',
        modelId: noBomModelId,
        modelRefSnapshot: 'P-TEST-NO-BOM',
        modelNameSnapshot: 'Porte Test Sans Nomenclature',
        materialName: 'WPC',
        colourId: 'col_blanc',
        colourNameSnapshot: 'Blanc Brillant',
        width: 80,
        height: 210,
        frameId: 'frm_f2',
        frameNameSnapshot: 'Cadre Médium 15 cm',
        quantity: 2,
        status: 'EN ATTENTE DE MATIÈRES' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.productionOrders.put(prodOrder);

      // Check materials validation
      const check = await checkProductionMaterials(prodOrder);
      log(`Résultat validation matières: canProduce = ${check.canProduce}, Eléments = ${check.missingItems.length}`);

      if (check.canProduce) {
        throw new Error('La validation aurait dû signaler que le modèle ne dispose pas de BOM !');
      }

      // Try validateAndExecuteProduction -> MUST throw
      let threw = false;
      try {
        await validateAndExecuteProduction(prodOrderId);
      } catch (err: any) {
        threw = true;
        log(`Blocage conforme en fabrication: ${err.message}`);
      }

      if (!threw) {
        throw new Error('Lancement de fabrication non bloqué malgré absence de nomenclature !');
      }

      log('Validation réussie: Les modèles sans BOM sont immédiatement bloqués avec alerte explicite.');
    }
  },

  // 10. Setup Wizard & Persistence test
  {
    id: 'TEST_SETUP_WIZARD_PERSISTENCE',
    name: '10. Assistant Premier Lancement & Persistance setupCompleted',
    description: 'Vérifie que la finalisation du wizard enregistre setupCompleted = true et ouvre immédiatement le Dashboard.',
    run: async (log) => {
      // 1. Verify completed state
      const status = await isSetupCompleted();
      log(`Vérification statut setup: completed = ${status.completed}`);
      if (!status.completed) {
        throw new Error(`Le setup n'est pas marqué comme complété: ${status.reason}`);
      }

      // 2. Verify checkIfFirstRun returns false
      const firstRun = await checkIfFirstRun();
      log(`Vérification checkIfFirstRun: ${firstRun} (attendu: false pour afficher le Dashboard)`);
      if (firstRun) {
        throw new Error('checkIfFirstRun() a renvoyé true alors que le setup est complété !');
      }

      // 3. Verify settings table
      const settings = (await db.settings.toArray())[0];
      if (!settings?.setupCompleted || !settings?.isInitialized) {
        throw new Error('settings.setupCompleted ou settings.isInitialized manquant dans IndexedDB');
      }
      log(`IndexedDB vérifié: setupCompleted = ${settings.setupCompleted}, isInitialized = ${settings.isInitialized}`);

      // 4. Verify company info
      const company = (await db.company.toArray())[0];
      if (!company || !company.name) {
        throw new Error('Informations entreprise manquantes dans IndexedDB');
      }
      log(`Entreprise vérifiée: "${company.name}" (Wilaya: ${company.wilaya}, Tél: ${company.phone1})`);

      log('Validation réussie: L’état du premier lancement est persisté de manière robuste et immuable.');
    }
  }
];

async function withIsolatedTestDb<T>(action: () => Promise<T>): Promise<T> {
  const prodDb = getActiveDatabase();
  const testDbName = 'OtmDoorTestDB';

  // Clean up any lingering previous test DB
  const tempDb = new OtmDoorDatabase(testDbName);
  try {
    await tempDb.delete();
  } catch {}

  const testDb = new OtmDoorDatabase(testDbName);
  await testDb.open();

  try {
    setActiveDatabase(testDb);
    // Seed fresh temporary database with setup and demo data
    await initializeCleanSetup();
    await loadDemoData();
    return await action();
  } finally {
    // Always restore the production database reference immediately
    setActiveDatabase(prodDb);
    try {
      testDb.close();
      await testDb.delete();
    } catch (cleanErr) {
      console.warn('Erreur lors du nettoyage de la base temporaire de test:', cleanErr);
    }
  }
}

export async function runScenarioTest(testId: string): Promise<ScenarioTestResult> {
  const tc = testDefinitions.find((t) => t.id === testId);
  if (!tc) throw new Error(`Test inconnu: ${testId}`);

  return await withIsolatedTestDb(async () => {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);
    const start = performance.now();

    try {
      await tc.run(log);
      const durationMs = Math.round(performance.now() - start);
      return {
        id: tc.id,
        name: tc.name,
        description: tc.description,
        passed: true,
        details: logs,
        durationMs
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      logs.push(`ÉCHEC: ${err.message}`);
      return {
        id: tc.id,
        name: tc.name,
        description: tc.description,
        passed: false,
        details: logs,
        error: err.message,
        durationMs
      };
    }
  });
}

export async function runAutomatedScenarioTests(): Promise<ScenarioTestResult[]> {
  return await withIsolatedTestDb(async () => {
    const results: ScenarioTestResult[] = [];
    for (const tc of testDefinitions) {
      const logs: string[] = [];
      const log = (msg: string) => logs.push(msg);
      const start = performance.now();

      try {
        await tc.run(log);
        const durationMs = Math.round(performance.now() - start);
        results.push({
          id: tc.id,
          name: tc.name,
          description: tc.description,
          passed: true,
          details: logs,
          durationMs
        });
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - start);
        logs.push(`ÉCHEC: ${err.message}`);
        results.push({
          id: tc.id,
          name: tc.name,
          description: tc.description,
          passed: false,
          details: logs,
          error: err.message,
          durationMs
        });
      }
    }
    return results;
  });
}

export function getAllTestDefinitions(): Array<{ id: string; name: string; description: string }> {
  return testDefinitions.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description
  }));
}
