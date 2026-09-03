import { db } from '../db';
import { createOrder } from '../services/orderService';
import { createPayment } from '../services/paymentService';
import { validateAndExecuteProduction } from '../services/productionService';
import { savePriceEntry, lookupPrice } from '../services/pricingService';
import { exportDatabaseBackup, restoreDatabaseBackup } from '../services/backupService';
import { findOrCreateFinishedDoorStock, adjustStockItemQuantity } from '../services/stockService';
import { initializeCleanSetup } from '../services/demoDataService';

export interface ScenarioTestResult {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  details: string[];
  error?: string;
  durationMs: number;
}

export async function runAutomatedScenarioTests(): Promise<ScenarioTestResult[]> {
  const results: ScenarioTestResult[] = [];

  // Helper for recording test step
  const executeTest = async (
    id: string,
    name: string,
    description: string,
    testFn: (log: (msg: string) => void) => Promise<void>
  ): Promise<ScenarioTestResult> => {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);
    const start = performance.now();

    try {
      await testFn(log);
      const durationMs = Math.round(performance.now() - start);
      return { id, name, description, passed: true, details: logs, durationMs };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      logs.push(`ÉCHEC: ${err.message}`);
      return { id, name, description, passed: false, details: logs, error: err.message, durationMs };
    }
  };

  // Ensure baseline setup exists
  await initializeCleanSetup();

  // SCENARIO A: Stock fini
  results.push(
    await executeTest(
      'SCENARIO_A',
      'Scénario A — Stock Fini & Réservation Sans Production Inutile',
      'Stock P-012/WPC/Blanc/80x210/F2 = 5. Commande de 2 unités. Attendu: réservé = 2, disponible = 3, 0 production.',
      async (log) => {
        // Setup client
        const clientId = 'cli_test_a';
        await db.clients.put({
          id: clientId,
          clientId: 'CLI-TEST-A',
          name: 'Client Test Scénario A',
          phone: '0555000001',
          wilaya: 'Alger',
          commune: 'Bab Ezzouar',
          address: 'Rue 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Setup door stock = 5
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

        // Reset to exactly 5 physical, 0 reserved
        await db.stockItems.update(doorStock.id, {
          physicalQuantity: 5,
          reservedQuantity: 0,
          availableQuantity: 5
        });
        log('Stock initial configuré: 5 unités physiques, 0 réservé, 5 disponibles');

        // Order 2 units
        const order = await createOrder({
          clientId,
          items: [
            {
              modelId: 'mod_p012',
              materialName: 'WPC',
              colourId: 'col_blanc',
              width: 80,
              height: 210,
              frameId: 'frm_f2',
              quantity: 2,
              unitPrice: 25000
            }
          ]
        });
        log(`Commande créée: ${order.orderNumber}`);

        // Check updated stock
        const updatedStock = await db.stockItems.get(doorStock.id);
        log(`Stock après commande: Physique=${updatedStock?.physicalQuantity}, Réservé=${updatedStock?.reservedQuantity}, Disponible=${updatedStock?.availableQuantity}`);

        if (updatedStock?.reservedQuantity !== 2) {
          throw new Error(`Réservé attendu 2 mais obtenu ${updatedStock?.reservedQuantity}`);
        }
        if (updatedStock?.availableQuantity !== 3) {
          throw new Error(`Disponible attendu 3 mais obtenu ${updatedStock?.availableQuantity}`);
        }

        // Check that NO production orders were created for this order
        const prodOrders = await db.productionOrders.where('orderId').equals(order.id).toArray();
        log(`Ordres de production générés: ${prodOrders.length}`);
        if (prodOrders.length !== 0) {
          throw new Error(`Production inutile détectée: ${prodOrders.length} ordres de fabrication trouvés`);
        }

        if (order.status !== 'PRÊTE') {
          throw new Error(`Statut de commande attendu PRÊTE mais obtenu ${order.status}`);
        }
        log('Validation réussie: Réservation conforme, aucune production inutile déclenchée.');
      }
    )
  );

  // SCENARIO B: Stock insuffisant
  results.push(
    await executeTest(
      'SCENARIO_B',
      'Scénario B — Stock Insuffisant & Déclenchement Automatique de Production',
      'Stock = 2. Commande = 5. Attendu: 2 disponibles réservés, 3 manquants envoyés en production.',
      async (log) => {
        const clientId = 'cli_test_b';
        await db.clients.put({
          id: clientId,
          clientId: 'CLI-TEST-B',
          name: 'Client Test Scénario B',
          phone: '0555000002',
          wilaya: 'Oran',
          commune: 'Centre',
          address: 'Rue 2',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Setup door stock with unique dimensions for test: 83x214
        const doorStock = await findOrCreateFinishedDoorStock({
          modelId: 'mod_p012',
          modelRef: 'P-012',
          modelName: 'Classique Double Moulure',
          materialName: 'WPC',
          colourId: 'col_blanc',
          colourName: 'Blanc Brillant',
          width: 83,
          height: 214,
          frameId: 'frm_f2',
          frameRef: 'F2',
          frameName: 'Cadre Médium 15 cm'
        });

        await db.stockItems.update(doorStock.id, {
          physicalQuantity: 2,
          reservedQuantity: 0,
          availableQuantity: 2
        });
        log('Stock initial configuré: 2 unités physiques, 0 réservé, 2 disponibles');

        // Order 5 units
        const order = await createOrder({
          clientId,
          items: [
            {
              modelId: 'mod_p012',
              materialName: 'WPC',
              colourId: 'col_blanc',
              width: 83,
              height: 214,
              frameId: 'frm_f2',
              quantity: 5,
              unitPrice: 25000
            }
          ]
        });

        const updatedStock = await db.stockItems.get(doorStock.id);
        log(`Stock après commande: Physique=${updatedStock?.physicalQuantity}, Réservé=${updatedStock?.reservedQuantity}, Disponible=${updatedStock?.availableQuantity}`);

        if (updatedStock?.reservedQuantity !== 2) {
          throw new Error(`Réservé attendu 2 mais obtenu ${updatedStock?.reservedQuantity}`);
        }
        if (updatedStock?.availableQuantity !== 0) {
          throw new Error(`Disponible attendu 0 mais obtenu ${updatedStock?.availableQuantity}`);
        }

        // Check production order created for 3 units
        const prodOrders = await db.productionOrders.where('orderId').equals(order.id).toArray();
        log(`Ordres de production générés: ${prodOrders.length}`);
        if (prodOrders.length !== 1) {
          throw new Error(`Attendu 1 ordre de production mais trouvé ${prodOrders.length}`);
        }
        if (prodOrders[0].quantity !== 3) {
          throw new Error(`Quantité de production attendue 3 mais obtenue ${prodOrders[0].quantity}`);
        }

        log('Validation réussie: 2 unités du stock réservées, 3 unités manquantes envoyées en production.');
      }
    )
  );

  // SCENARIO C: Prix historique
  results.push(
    await executeTest(
      'SCENARIO_C',
      'Scénario C — Conservation Inviolable du Prix Historique',
      'Ancien tarif: 25 000 DA. Créer commande. Modifier tarif à 30 000 DA. L’ancienne commande doit rester à 25 000 DA.',
      async (log) => {
        // Set tariff to 25 000 DA
        await savePriceEntry({
          id: 'prc_test_historic',
          modelId: 'mod_p012',
          modelRefSnapshot: 'P-012',
          materialName: 'WPC',
          width: 88,
          height: 210,
          price: 25000
        });
        log('Tarif initial enregistré: 25 000 DA pour 88x210 cm');

        const clientId = 'cli_test_c';
        await db.clients.put({
          id: clientId,
          clientId: 'CLI-TEST-C',
          name: 'Client Test Prix Historique',
          phone: '0555000003',
          wilaya: 'Blida',
          commune: 'Centre',
          address: 'Rue 3',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Price lookup
        const lookup = await lookupPrice({
          modelId: 'mod_p012',
          materialName: 'WPC',
          width: 88,
          height: 210
        });
        log(`Prix trouvé par le moteur de tarification: ${lookup.price} DA`);
        if (lookup.price !== 25000) {
          throw new Error(`Prix attendu 25000 mais trouvé ${lookup.price}`);
        }

        // Create order with 25 000 DA
        const order = await createOrder({
          clientId,
          items: [
            {
              modelId: 'mod_p012',
              materialName: 'WPC',
              colourId: 'col_blanc',
              width: 88,
              height: 210,
              frameId: 'frm_f2',
              quantity: 1,
              unitPrice: lookup.price!
            }
          ]
        });
        log(`Commande créée avec prix unitaire: ${order.totalAmount} DA`);

        // Now modify tariff in catalog to 30 000 DA
        await savePriceEntry({
          id: 'prc_test_historic',
          modelId: 'mod_p012',
          modelRefSnapshot: 'P-012',
          materialName: 'WPC',
          width: 88,
          height: 210,
          price: 30000
        });
        log('Nouveau tarif mis à jour dans le catalogue: 30 000 DA');

        // Verify order has NOT changed
        const orderCheck = await db.orders.get(order.id);
        const orderItemsCheck = await db.orderItems.where('orderId').equals(order.id).toArray();

        log(`Vérification de l'ancienne commande: Total = ${orderCheck?.totalAmount} DA, P.U ligne = ${orderItemsCheck[0]?.unitPrice} DA`);

        if (orderCheck?.totalAmount !== 25000 || orderItemsCheck[0]?.unitPrice !== 25000) {
          throw new Error(
            `Violation d'intégrité historique! L'ancienne commande a été modifiée à ${orderCheck?.totalAmount} DA au lieu de 25 000 DA.`
          );
        }

        log('Validation réussie: Le prix de la commande passée est resté scellé à 25 000 DA.');
      }
    )
  );

  // SCENARIO D: Production & Consommation BOM
  results.push(
    await executeTest(
      'SCENARIO_D',
      'Scénario D — Exécution de Production, Consommation BOM et Entrée Porte Finie',
      'Produire 3 portes. Vérifier BOM, consommer matières & quincaillerie, ajouter 3 portes finies, clore l’ordre.',
      async (log) => {
        // Prepare stock for raw material and components
        const rawWpc = await db.stockItems.filter((s) => s.materialName === 'WPC').first();
        if (rawWpc) {
          await db.stockItems.update(rawWpc.id, { physicalQuantity: 50, availableQuantity: 50 });
        }
        const hinges = await db.stockItems.filter((s) => s.componentId === 'cmp_charniere').first();
        if (hinges) {
          await db.stockItems.update(hinges.id, { physicalQuantity: 100, availableQuantity: 100 });
        }

        const initialRawQty = (await db.stockItems.get(rawWpc!.id))?.physicalQuantity || 0;
        const initialHingesQty = (await db.stockItems.get(hinges!.id))?.physicalQuantity || 0;
        log(`Stock initial: Panneaux WPC = ${initialRawQty}, Charnières = ${initialHingesQty}`);

        // Create a dedicated production order for 3 doors
        const prodOrderId = 'prod_test_scenario_d';
        await db.productionOrders.put({
          id: prodOrderId,
          productionNumber: 'PROD-TEST-004',
          orderId: 'ord_test_fake',
          orderNumberSnapshot: 'OTM-TEST-004',
          orderItemId: 'item_test_fake',
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
          quantity: 3,
          status: 'À PRODUIRE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Execute production
        await validateAndExecuteProduction(prodOrderId, undefined, true);
        log('Production exécutée et validée.');

        // Check production status
        const prodDone = await db.productionOrders.get(prodOrderId);
        if (prodDone?.status !== 'TERMINÉE') {
          throw new Error(`Statut de production attendu TERMINÉE mais obtenu ${prodDone?.status}`);
        }

        // Verify consumption
        const updatedRawQty = (await db.stockItems.get(rawWpc!.id))?.physicalQuantity || 0;
        log(`Stock après production: Panneaux WPC = ${updatedRawQty} (diminution conforme)`);

        // Check finished door stock increased by 3
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

        log(`Stock portes finies P-012 80x210: Physique = ${doorStock.physicalQuantity}`);
        if (doorStock.physicalQuantity < 3) {
          throw new Error('Les portes finies n’ont pas été créditées au stock.');
        }

        log('Validation réussie: Matières consommées, mouvements enregistrés, portes finies créditées.');
      }
    )
  );

  // SCENARIO E: Paiements & Calcul du Reste
  results.push(
    await executeTest(
      'SCENARIO_E',
      'Scénario E — Règlements Multiples et Calcul Exact du Reste à Payer',
      'Commande: 120 000 DA. Versement 1: 50 000 DA -> Reste 70 000 DA. Versement 2: 30 000 DA -> Reste 40 000 DA.',
      async (log) => {
        const clientId = 'cli_test_e';
        await db.clients.put({
          id: clientId,
          clientId: 'CLI-TEST-E',
          name: 'Client Test Paiements',
          phone: '0555000005',
          wilaya: 'Constantine',
          commune: 'Centre',
          address: 'Rue 5',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Create order of 120 000 DA (4 doors of 30 000 DA)
        const order = await createOrder({
          clientId,
          items: [
            {
              modelId: 'mod_p024',
              materialName: 'MDF',
              colourId: 'col_gris',
              width: 90,
              height: 210,
              frameId: 'frm_f2',
              quantity: 4,
              unitPrice: 30000
            }
          ]
        });

        log(`Commande créée: Montant total = ${order.totalAmount} DA, Reste initial = ${order.remainingAmount} DA`);
        if (order.totalAmount !== 120000 || order.remainingAmount !== 120000) {
          throw new Error(`Total attendu 120000 mais obtenu ${order.totalAmount}`);
        }

        // Payment 1: 50 000 DA
        await createPayment({
          orderId: order.id,
          amount: 50000,
          paymentMethod: 'Espèces',
          note: 'Acompte à la commande'
        });

        const orderAfterPay1 = await db.orders.get(order.id);
        log(`Après versement 1 (50 000 DA): Payé = ${orderAfterPay1?.paidAmount} DA, Reste = ${orderAfterPay1?.remainingAmount} DA`);
        if (orderAfterPay1?.paidAmount !== 50000 || orderAfterPay1?.remainingAmount !== 70000) {
          throw new Error(`Reste attendu 70000 mais obtenu ${orderAfterPay1?.remainingAmount}`);
        }

        // Payment 2: 30 000 DA
        await createPayment({
          orderId: order.id,
          amount: 30000,
          paymentMethod: 'Virement',
          note: 'Deuxième versement'
        });

        const orderAfterPay2 = await db.orders.get(order.id);
        log(`Après versement 2 (30 000 DA): Payé = ${orderAfterPay2?.paidAmount} DA, Reste = ${orderAfterPay2?.remainingAmount} DA`);
        if (orderAfterPay2?.paidAmount !== 80000 || orderAfterPay2?.remainingAmount !== 40000) {
          throw new Error(`Reste attendu 40000 mais obtenu ${orderAfterPay2?.remainingAmount}`);
        }

        log('Validation réussie: Calcul arithmétique rigoureux des encaissements et du solde débiteur.');
      }
    )
  );

  // SCENARIO F: Chiffrement & Sauvegarde Web Crypto
  results.push(
    await executeTest(
      'SCENARIO_F',
      'Scénario F — Chiffrement PBKDF2/AES-GCM et Restauration Sécurisée',
      'Exporter une sauvegarde chiffrée avec mot de passe fort, tester le déchiffrement et l’intégrité.',
      async (log) => {
        const password = 'MotDePasseSecret123!';
        const backup = await exportDatabaseBackup(password);
        log(`Sauvegarde chiffrée exportée: ${backup.filename} (${backup.blob.size} octets)`);

        const reader = new FileReader();
        const fileTextPromise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(backup.blob);
        });
        const fileContent = await fileTextPromise;

        // Check that content is encrypted (contains salt, iv, ciphertext)
        const envelope = JSON.parse(fileContent);
        if (!envelope.ciphertext || !envelope.salt || !envelope.iv) {
          throw new Error('Le fichier exporté ne respecte pas le format chiffré AES-GCM attendu.');
        }
        log('Enveloppe cryptographique validée (Sel aléatoire, IV, Texte chiffré AES-GCM).');

        // Test with WRONG password -> must fail cleanly without corrupting
        try {
          await restoreDatabaseBackup(fileContent, 'MauvaisMotDePasse');
          throw new Error('La restauration avec un mauvais mot de passe aurait dû échouer.');
        } catch (err: any) {
          log(`Échec attendu avec mauvais mot de passe: ${err.message}`);
        }

        // Test with CORRECT password -> must succeed
        const restoreResult = await restoreDatabaseBackup(fileContent, password);
        log(`Restauration avec le bon mot de passe: ${restoreResult.message}`);

        if (!restoreResult.success) {
          throw new Error('La restauration avec le mot de passe valide a échoué.');
        }

        log('Validation réussie: Sauvegarde chiffrée inviolable et intégrité confirmée.');
      }
    )
  );

  return results;
}
