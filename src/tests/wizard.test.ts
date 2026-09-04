import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, getCompanyInfo, getSettings } from '../db';
import {
  initializeCleanSetup,
  checkIfFirstRun,
  isSetupCompleted
} from '../services/demoDataService';
import { verifyPassword } from '../services/securityService';
import type { CompanyInfo, AppSettings } from '../types';

describe('OTM DOOR — Wizard de Premier Lancement & Persistance du Setup', () => {
  beforeEach(async () => {
    // Clear all tables before each test to guarantee fresh, isolated state
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
  });

  // TEST 1 : Configuration initiale absente → Wizard affiché
  it('TEST 1 : Configuration initiale absente → Wizard affiché (checkIfFirstRun = true)', async () => {
    const status = await isSetupCompleted();
    expect(status.completed).toBe(false);
    expect(status.reason).toContain('Paramètres système (settings) manquants');

    const firstRun = await checkIfFirstRun();
    expect(firstRun).toBe(true);
  });

  // TEST 2 : Les 6 étapes sont complétées → sauvegarde de la configuration
  it('TEST 2 : Les 6 étapes sont complétées → sauvegarde intégrale de la configuration dans IndexedDB', async () => {
    const companyInput: Partial<CompanyInfo> = {
      name: 'OTM DOOR USINE TEST',
      address: 'Zone Industrielle Oued Smar, Lot 100',
      wilaya: 'Alger',
      commune: 'Oued Smar',
      phone1: '0550 00 11 22',
      phone2: '0660 33 44 55',
      email: 'contact@otmdoor-test.dz',
      legalInfo: 'RC: 16/00-9999999 — NIF: 002216099999999',
      logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    };

    const passwordInput = 'AdminMaster2026!';

    const settingsInput: Partial<AppSettings> = {
      orderPrefix: 'CMD-TEST-',
      receiptPrefix: 'REC-TEST-',
      productionPrefix: 'FAB-TEST-',
      currency: 'DA',
      autoLockMinutes: 15
    };

    await initializeCleanSetup(companyInput, passwordInput, settingsInput);

    // Verify company persisted
    const savedCompany = await getCompanyInfo();
    expect(savedCompany).toBeDefined();
    expect(savedCompany?.name).toBe('OTM DOOR USINE TEST');
    expect(savedCompany?.phone1).toBe('0550 00 11 22');
    expect(savedCompany?.phone2).toBe('0660 33 44 55');
    expect(savedCompany?.logo).toContain('data:image/png');

    // Verify settings persisted
    const savedSettings = await getSettings();
    expect(savedSettings).toBeDefined();
    expect(savedSettings?.orderPrefix).toBe('CMD-TEST-');
    expect(savedSettings?.receiptPrefix).toBe('REC-TEST-');
    expect(savedSettings?.productionPrefix).toBe('FAB-TEST-');
    expect(savedSettings?.passwordHash).toBeTruthy();
    expect(savedSettings?.passwordSalt).toBeTruthy();

    // Verify password hash validity
    const isPassValid = await verifyPassword(
      passwordInput,
      savedSettings!.passwordHash!,
      savedSettings!.passwordSalt!
    );
    expect(isPassValid).toBe(true);

    // Verify initial materials created (WPC, MDF, PVC)
    const materials = await db.materials.toArray();
    expect(materials.length).toBe(3);
    const materialNames = materials.map((m) => m.name);
    expect(materialNames).toContain('WPC');
    expect(materialNames).toContain('MDF');
    expect(materialNames).toContain('PVC');

    // Verify initial frames created (F1, F2, F3)
    const frames = await db.frames.toArray();
    expect(frames.length).toBe(3);
    const frameRefs = frames.map((f) => f.ref);
    expect(frameRefs).toContain('F1');
    expect(frameRefs).toContain('F2');
    expect(frameRefs).toContain('F3');
  });

  // TEST 3 : Finalisation → setupCompleted = true
  it('TEST 3 : Finalisation du wizard → setupCompleted = true persisté dans la base', async () => {
    await initializeCleanSetup({ name: 'OTM DOOR' });

    const settings = await getSettings();
    expect(settings).toBeDefined();
    expect(settings?.setupCompleted).toBe(true);
    expect(settings?.isInitialized).toBe(true);
  });

  // TEST 4 : Après finalisation → Dashboard affiché
  it('TEST 4 : Après finalisation → isSetupCompleted = true et checkIfFirstRun = false (Dashboard affiché)', async () => {
    await initializeCleanSetup({ name: 'OTM DOOR' });

    const status = await isSetupCompleted();
    expect(status.completed).toBe(true);

    const firstRun = await checkIfFirstRun();
    expect(firstRun).toBe(false); // false means wizard is not displayed, dashboard is shown!
  });

  // TEST 5 : Après rechargement de l'application → Dashboard affiché directement
  it('TEST 5 : Après rechargement simulé (F5) → Dashboard affiché directement sans wizard', async () => {
    // 1. Initial setup
    await initializeCleanSetup({
      name: 'OTM DOOR FABRICATION',
      phone1: '0555 12 34 56'
    });

    // 2. Simulate application reload (new read of DB state on app startup)
    const statusOnReload = await isSetupCompleted();
    expect(statusOnReload.completed).toBe(true);

    const firstRunOnReload = await checkIfFirstRun();
    expect(firstRunOnReload).toBe(false);

    const company = await getCompanyInfo();
    expect(company?.name).toBe('OTM DOOR FABRICATION');
  });

  // TEST 6 : Un champ optionnel vide → le setup peut quand même être finalisé
  it('TEST 6 : Tous les champs optionnels vides (phone2, email, legalInfo, password) → finalisation réussie sans erreur', async () => {
    // Only mandatory info provided; optional fields are empty strings
    const minimalCompany: Partial<CompanyInfo> = {
      name: 'OTM DOOR ALGER',
      address: 'Zone Industrielle Oued Smar',
      wilaya: 'Alger',
      commune: 'Oued Smar',
      phone1: '0550 11 22 33',
      phone2: '', // Optionnel vide
      email: '', // Optionnel vide
      legalInfo: '', // Optionnel vide
      logo: '' // Optionnel vide
    };

    // Password empty (optional)
    await expect(initializeCleanSetup(minimalCompany, '')).resolves.not.toThrow();

    const settings = await getSettings();
    expect(settings?.setupCompleted).toBe(true);
    expect(settings?.passwordHash).toBe('');

    const status = await isSetupCompleted();
    expect(status.completed).toBe(true);

    const firstRun = await checkIfFirstRun();
    expect(firstRun).toBe(false);
  });

  // TEST 7 : Échec de sauvegarde → setupCompleted ne doit PAS devenir true
  it('TEST 7 : Échec de sauvegarde → transaction annulée et setupCompleted ne devient PAS true', async () => {
    // Provide an invalid table hook or trigger to force failure during transaction
    const originalPut = db.company.put.bind(db.company);
    db.company.put = (() => {
      throw new Error('Erreur simulée d’écriture IndexedDB');
    }) as any;

    try {
      await expect(initializeCleanSetup({ name: 'OTM DOOR FAIL' })).rejects.toThrow(
        /Erreur simulée/
      );
    } finally {
      // Restore original method
      db.company.put = originalPut;
    }

    // Verify setupCompleted was NOT persisted
    const settings = await getSettings();
    expect(settings).toBeUndefined();

    const status = await isSetupCompleted();
    expect(status.completed).toBe(false);

    const firstRun = await checkIfFirstRun();
    expect(firstRun).toBe(true);
  });
});
