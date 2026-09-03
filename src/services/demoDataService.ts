import { db, recordAudit } from '../db';
import type {
  DoorModel,
  Material,
  Colour,
  Frame,
  ComponentItem,
  BillOfMaterials,
  PriceEntry,
  Client,
  StockItem,
  CompanyInfo,
  AppSettings
} from '../types';
import { hashPassword } from './securityService';

export const CNC_DRAWING_P001 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" fill="%231e293b"><rect width="400" height="800" fill="%230f172a"/><rect x="30" y="40" width="340" height="720" rx="8" fill="none" stroke="%2338bdf8" stroke-width="4"/><line x1="60" y1="200" x2="340" y2="200" stroke="%2338bdf8" stroke-width="3" stroke-dasharray="6,6"/><line x1="60" y1="350" x2="340" y2="350" stroke="%2338bdf8" stroke-width="3" stroke-dasharray="6,6"/><line x1="60" y1="500" x2="340" y2="500" stroke="%2338bdf8" stroke-width="3" stroke-dasharray="6,6"/><circle cx="330" cy="420" r="10" fill="%23f59e0b"/><text x="200" y="740" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">CNC P-001 LIGNES MODERNES</text></svg>`;

export const CNC_DRAWING_P012 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" fill="%231e293b"><rect width="400" height="800" fill="%230f172a"/><rect x="30" y="40" width="340" height="720" rx="8" fill="none" stroke="%23c59b27" stroke-width="4"/><rect x="60" y="80" width="280" height="260" rx="6" fill="none" stroke="%23c59b27" stroke-width="5"/><rect x="80" y="100" width="240" height="220" rx="4" fill="none" stroke="%23c59b27" stroke-width="2"/><rect x="60" y="380" width="280" height="320" rx="6" fill="none" stroke="%23c59b27" stroke-width="5"/><rect x="80" y="400" width="240" height="280" rx="4" fill="none" stroke="%23c59b27" stroke-width="2"/><circle cx="330" cy="430" r="10" fill="%23f59e0b"/><text x="200" y="740" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">CNC P-012 DOUBLE MOULURE</text></svg>`;

export const CNC_DRAWING_P024 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" fill="%231e293b"><rect width="400" height="800" fill="%230f172a"/><rect x="30" y="40" width="340" height="720" rx="8" fill="none" stroke="%23e2e8f0" stroke-width="4"/><rect x="70" y="120" width="20" height="560" fill="%2394a3b8"/><line x1="110" y1="200" x2="330" y2="200" stroke="%2394a3b8" stroke-width="4"/><line x1="110" y1="280" x2="330" y2="280" stroke="%2394a3b8" stroke-width="4"/><line x1="110" y1="360" x2="330" y2="360" stroke="%2394a3b8" stroke-width="4"/><circle cx="330" cy="420" r="10" fill="%23f59e0b"/><text x="200" y="740" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">CNC P-024 INSERTS MÉTAL</text></svg>`;

export async function initializeCleanSetup(companyInput?: Partial<CompanyInfo>, password?: string): Promise<void> {
  const now = new Date().toISOString();

  // 1. Company
  const company: CompanyInfo = {
    id: 'comp_default',
    name: companyInput?.name || 'OTM DOOR',
    logo: companyInput?.logo || '/otm-door-logo.png',
    address: companyInput?.address || 'Zone Industrielle Oued Smar, Lot N° 45',
    wilaya: companyInput?.wilaya || 'Alger',
    commune: companyInput?.commune || 'Oued Smar',
    phone1: companyInput?.phone1 || '0550 12 34 56',
    phone2: companyInput?.phone2 || '0661 98 76 54',
    email: companyInput?.email || 'contact@otmdoor.dz',
    website: companyInput?.website || 'www.otmdoor.dz',
    facebook: companyInput?.facebook || 'facebook.com/otmdoor',
    instagram: companyInput?.instagram || '@otmdoor.officiel',
    legalInfo: companyInput?.legalInfo || 'RC: 16/00-1234567B22 — NIF: 002216012345678 — NIS: 0022160100123',
    headerText: 'OTM DOOR — Usine de Fabrication & Vente de Portes',
    footerText: 'OTM DOOR Algérie — Tous droits réservés — Document officiel certifié',
    updatedAt: now
  };
  await db.company.put(company);

  // 2. Settings & Security
  let passHash = '';
  let passSalt = '';
  if (password && password.trim()) {
    const hashed = await hashPassword(password);
    passHash = hashed.hash;
    passSalt = hashed.salt;
  }

  const settings: AppSettings = {
    id: 'sett_default',
    currency: 'DA',
    isInitialized: true,
    passwordHash: passHash,
    passwordSalt: passSalt,
    autoLockMinutes: 15,
    orderPrefix: 'OTM-2026-',
    receiptPrefix: 'REC-2026-',
    productionPrefix: 'PROD-2026-',
    nextOrderNum: 1,
    nextReceiptNum: 1,
    nextProductionNum: 1,
    updatedAt: now
  };
  await db.settings.put(settings);

  // 3. Initial Materials (WPC, MDF, PVC)
  const initialMaterials: Material[] = [
    {
      id: 'mat_wpc',
      ref: 'MAT-WPC',
      name: 'WPC',
      unit: 'panneau',
      description: 'Wood Plastic Composite — Résistant à l’eau et imputrescible',
      minThreshold: 10,
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'mat_mdf',
      ref: 'MAT-MDF',
      name: 'MDF',
      unit: 'panneau',
      description: 'Panneau MDF haute densité pour usinage CNC fin et laquage',
      minThreshold: 10,
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'mat_pvc',
      ref: 'MAT-PVC',
      name: 'PVC',
      unit: 'panneau',
      description: 'PVC structure alvéolaire isolant thermique et phonique',
      minThreshold: 8,
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ];
  for (const m of initialMaterials) {
    const exists = await db.materials.get(m.id);
    if (!exists) await db.materials.put(m);
  }

  // 4. Initial 3 Frames (F1, F2, F3)
  const initialFrames: Frame[] = [
    {
      id: 'frm_f1',
      ref: 'F1',
      name: 'Cadre Standard 10 cm',
      width: '10 cm',
      price: 3500,
      description: 'Cadre dormant fin pour cloisons intérieures 10 cm',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'frm_f2',
      ref: 'F2',
      name: 'Cadre Médium 15 cm',
      width: '15 cm',
      price: 4500,
      description: 'Cadre robuste pour murs standards de 15 cm',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'frm_f3',
      ref: 'F3',
      name: 'Cadre Large 20 cm',
      width: '20 cm',
      price: 5500,
      description: 'Cadre enveloppant pour murs épais de 20 cm avec couvre-joints',
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ];
  for (const f of initialFrames) {
    const exists = await db.frames.get(f.id);
    if (!exists) await db.frames.put(f);
  }

  await recordAudit('Initialisation système', 'system', 'Configuration initiale OTM DOOR validée');
}

export async function loadDemoData(): Promise<{ success: boolean; message: string }> {
  const now = new Date().toISOString();

  // Door models
  const demoModels: DoorModel[] = [
    {
      id: 'mod_p001',
      ref: 'P-001',
      name: 'Lignes Géométriques Modernes',
      compatibleMaterials: ['WPC', 'MDF', 'PVC'],
      cncImage: CNC_DRAWING_P001,
      description: 'Modèle épuré contemporain avec 3 rainures horizontales gravées au laser CNC',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'mod_p012',
      ref: 'P-012',
      name: 'Classique Double Moulure Prestige',
      compatibleMaterials: ['WPC', 'MDF'],
      cncImage: CNC_DRAWING_P012,
      description: 'Design néoclassique indémodable à deux caissons travaillés en relief',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'mod_p024',
      ref: 'P-024',
      name: 'Contemporain Insert Inox Brossé',
      compatibleMaterials: ['WPC', 'MDF', 'PVC'],
      cncImage: CNC_DRAWING_P024,
      description: 'Modèle haut de gamme mariant textures mates et liserés en acier inoxydable',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'mod_p031',
      ref: 'P-031',
      name: 'Minimaliste Plein Zen',
      compatibleMaterials: ['WPC', 'PVC'],
      cncImage: CNC_DRAWING_P001,
      description: 'Finition plane lisse acoustique idéale pour bureaux et chambres d’hôtel',
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ];

  // Colours
  const demoColours: Colour[] = [
    {
      id: 'col_blanc',
      ref: 'COL-01',
      name: 'Blanc Brillant',
      compatibleMaterials: ['WPC', 'MDF', 'PVC'],
      photo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f8fafc"/><text x="50" y="55" font-size="12" fill="%2364748b" text-anchor="middle">Blanc</text></svg>',
      description: 'Blanc pur lumineux laqué résistant aux UV',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'col_gris',
      ref: 'COL-02',
      name: 'Gris Anthracite RAL 7016',
      compatibleMaterials: ['WPC', 'MDF', 'PVC'],
      photo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23374151"/><text x="50" y="55" font-size="12" fill="%23f9fafb" text-anchor="middle">Gris</text></svg>',
      description: 'Gris anthracite mat très moderne',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'col_chene',
      ref: 'COL-03',
      name: 'Chêne Doré Naturel',
      compatibleMaterials: ['WPC', 'MDF'],
      photo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23b45309"/><text x="50" y="55" font-size="12" fill="%23fef3c7" text-anchor="middle">Chêne</text></svg>',
      description: 'Texture bois chaleureuse veinée en relief',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'col_noir',
      ref: 'COL-04',
      name: 'Noir Satiné Intense',
      compatibleMaterials: ['WPC', 'PVC'],
      photo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23111827"/><text x="50" y="55" font-size="12" fill="%23f3f4f6" text-anchor="middle">Noir</text></svg>',
      description: 'Noir mat velouté anti-traces de doigts',
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ];

  // Components
  const demoComponents: ComponentItem[] = [
    {
      id: 'cmp_charniere',
      ref: 'CMP-CH304',
      name: 'Charnière Inox 304 4 pouces',
      category: 'Charnières',
      unit: 'pièce',
      stock: 350,
      minStock: 50,
      price: 450,
      description: 'Charnières invisibles réglables 3D en acier inoxydable 304',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'cmp_serrure',
      ref: 'CMP-SRMG',
      name: 'Serrure Magnétique Silencieuse',
      category: 'Serrure',
      unit: 'pièce',
      stock: 120,
      minStock: 20,
      price: 2200,
      description: 'Boîtier de serrure magnétique à fermeture ultra-silencieuse avec clé',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'cmp_poignee',
      ref: 'CMP-PGAL',
      name: 'Poignée Aluminium Design Bronze',
      category: 'Poignée',
      unit: 'pièce',
      stock: 95,
      minStock: 15,
      price: 2800,
      description: 'Paire de poignées ergonomiques finition champagne/bronze brossé',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'cmp_visserie',
      ref: 'CMP-VIS',
      name: 'Kit Visserie & Fixation Dormant',
      category: 'Visserie',
      unit: 'sachet',
      stock: 200,
      minStock: 30,
      price: 250,
      description: 'Lot de vis trempées + chevilles expansion haute résistance',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'cmp_joint',
      ref: 'CMP-JNT',
      name: 'Joint Acoustique Isophonique EPDM',
      category: 'Joint',
      unit: 'mètre',
      stock: 500,
      minStock: 60,
      price: 150,
      description: 'Joint étanchéité périphérique anti-poussière et amortisseur de bruit',
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ];

  // BOM
  const demoBoms: BillOfMaterials[] = [
    {
      id: 'bom_p012_wpc_f2',
      name: 'BOM Standard P-012 WPC Cadre F2',
      modelId: 'mod_p012',
      materialName: 'WPC',
      frameId: 'frm_f2',
      items: [
        { componentId: 'cmp_charniere', componentName: 'Charnière Inox 304 4 pouces', quantity: 3, unit: 'pièce' },
        { componentId: 'cmp_serrure', componentName: 'Serrure Magnétique Silencieuse', quantity: 1, unit: 'pièce' },
        { componentId: 'cmp_poignee', componentName: 'Poignée Aluminium Design Bronze', quantity: 1, unit: 'pièce' },
        { componentId: 'cmp_visserie', componentName: 'Kit Visserie & Fixation Dormant', quantity: 1, unit: 'sachet' },
        { componentId: 'cmp_joint', componentName: 'Joint Acoustique Isophonique EPDM', quantity: 5, unit: 'mètre' }
      ],
      rawMaterialUnitsNeeded: 1,
      notes: 'Nomenclature standard usine pour modèle P-012 WPC avec Cadre F2 (consomme 1 panneau + 1 cadre + quincaillerie)',
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'bom_generic_wpc',
      name: 'BOM Générique Portes WPC',
      materialName: 'WPC',
      items: [
        { componentId: 'cmp_charniere', componentName: 'Charnière Inox 304 4 pouces', quantity: 3, unit: 'pièce' },
        { componentId: 'cmp_serrure', componentName: 'Serrure Magnétique Silencieuse', quantity: 1, unit: 'pièce' },
        { componentId: 'cmp_poignee', componentName: 'Poignée Aluminium Design Bronze', quantity: 1, unit: 'pièce' },
        { componentId: 'cmp_visserie', componentName: 'Kit Visserie & Fixation Dormant', quantity: 1, unit: 'sachet' }
      ],
      rawMaterialUnitsNeeded: 1,
      notes: 'BOM de repli pour portes WPC',
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ];

  // Pricing Matrix Entries
  const demoPrices: PriceEntry[] = [
    {
      id: 'prc_p012_wpc_80x210',
      modelId: 'mod_p012',
      modelRefSnapshot: 'P-012',
      materialName: 'WPC',
      width: 80,
      height: 210,
      price: 25000,
      notes: 'Tarif officiel P-012 WPC 80x210 cm',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'prc_p012_wpc_90x210',
      modelId: 'mod_p012',
      modelRefSnapshot: 'P-012',
      materialName: 'WPC',
      width: 90,
      height: 210,
      price: 27000,
      notes: 'Tarif officiel P-012 WPC 90x210 cm',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'prc_p012_mdf_80x210',
      modelId: 'mod_p012',
      modelRefSnapshot: 'P-012',
      materialName: 'MDF',
      width: 80,
      height: 210,
      price: 23000,
      notes: 'Tarif officiel P-012 MDF 80x210 cm',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'prc_p001_wpc_80x210',
      modelId: 'mod_p001',
      modelRefSnapshot: 'P-001',
      materialName: 'WPC',
      width: 80,
      height: 210,
      price: 24000,
      notes: 'Tarif officiel P-001 WPC 80x210 cm',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'prc_p024_mdf_90x210',
      modelId: 'mod_p024',
      modelRefSnapshot: 'P-024',
      materialName: 'MDF',
      width: 90,
      height: 210,
      price: 28000,
      notes: 'Tarif officiel P-024 MDF 90x210 cm',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'prc_p031_pvc_85x215',
      modelId: 'mod_p031',
      modelRefSnapshot: 'P-031',
      materialName: 'PVC',
      width: 85,
      height: 215,
      price: 22000,
      notes: 'Tarif officiel P-031 PVC 85x215 cm',
      createdAt: now,
      updatedAt: now
    }
  ];

  // Clients
  const demoClients: Client[] = [
    {
      id: 'cli_001',
      clientId: 'CLI-001',
      name: 'Promotion Immobilière El Bahia',
      phone: '0555 23 45 67',
      phoneSecondary: '0770 12 34 89',
      wilaya: 'Oran',
      commune: 'Bir El Djir',
      address: 'Résidence Les Palmiers, Bloc B',
      notes: 'Client promoteur régulier — Projets résidentiels standing',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'cli_002',
      clientId: 'CLI-002',
      name: 'EURL Batiment Moderne',
      phone: '0560 98 76 54',
      wilaya: 'Alger',
      commune: 'Hydra',
      address: '14 Boulevard des Martyrs',
      notes: 'Rénovation de villas de maître',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'cli_003',
      clientId: 'CLI-003',
      name: 'M. Karim Benali',
      phone: '0662 44 55 66',
      wilaya: 'Blida',
      commune: 'Ouled Yaïch',
      address: 'Cité 500 Logements, Villa 12',
      notes: 'Client particulier — Villa individuelle',
      createdAt: now,
      updatedAt: now
    }
  ];

  // Initial Stock Setup (includes 5 units of P-012 WPC Blanc 80x210 F2 for Scenario A!)
  const demoStock: StockItem[] = [
    // Finished Doors Stock
    {
      id: 'stk_door_p012_white_80x210_f2',
      itemType: 'FINISHED_DOOR',
      modelId: 'mod_p012',
      modelRef: 'P-012',
      modelName: 'Classique Double Moulure Prestige',
      materialNameForDoor: 'WPC',
      colourId: 'col_blanc',
      colourName: 'Blanc Brillant',
      width: 80,
      height: 210,
      frameId: 'frm_f2',
      frameRef: 'F2',
      frameName: 'Cadre Médium 15 cm',
      physicalQuantity: 5,
      reservedQuantity: 0,
      availableQuantity: 5,
      minAlertThreshold: 2,
      unit: 'pièce',
      location: 'Rack A-04 (Portes finies)',
      notes: 'Stock initial disponible conforme scénario A',
      updatedAt: now
    },
    {
      id: 'stk_door_p001_gris_80x210_f1',
      itemType: 'FINISHED_DOOR',
      modelId: 'mod_p001',
      modelRef: 'P-001',
      modelName: 'Lignes Géométriques Modernes',
      materialNameForDoor: 'WPC',
      colourId: 'col_gris',
      colourName: 'Gris Anthracite RAL 7016',
      width: 80,
      height: 210,
      frameId: 'frm_f1',
      frameRef: 'F1',
      frameName: 'Cadre Standard 10 cm',
      physicalQuantity: 3,
      reservedQuantity: 0,
      availableQuantity: 3,
      minAlertThreshold: 1,
      unit: 'pièce',
      location: 'Rack A-02',
      updatedAt: now
    },
    // Raw materials stock
    {
      id: 'stk_raw_wpc',
      itemType: 'RAW_MATERIAL',
      materialId: 'mat_wpc',
      materialName: 'WPC',
      physicalQuantity: 80,
      reservedQuantity: 0,
      availableQuantity: 80,
      minAlertThreshold: 15,
      unit: 'panneau',
      location: 'Zone Brute Hangar 1',
      updatedAt: now
    },
    {
      id: 'stk_raw_mdf',
      itemType: 'RAW_MATERIAL',
      materialId: 'mat_mdf',
      materialName: 'MDF',
      physicalQuantity: 50,
      reservedQuantity: 0,
      availableQuantity: 50,
      minAlertThreshold: 10,
      unit: 'panneau',
      location: 'Zone Brute Hangar 1',
      updatedAt: now
    },
    {
      id: 'stk_raw_pvc',
      itemType: 'RAW_MATERIAL',
      materialId: 'mat_pvc',
      materialName: 'PVC',
      physicalQuantity: 40,
      reservedQuantity: 0,
      availableQuantity: 40,
      minAlertThreshold: 10,
      unit: 'panneau',
      location: 'Zone Brute Hangar 2',
      updatedAt: now
    }
  ];

  // Component stock items
  for (const c of demoComponents) {
    demoStock.push({
      id: `stk_comp_${c.id}`,
      itemType: 'COMPONENT',
      componentId: c.id,
      componentRef: c.ref,
      componentName: c.name,
      physicalQuantity: c.stock,
      reservedQuantity: 0,
      availableQuantity: c.stock,
      minAlertThreshold: c.minStock,
      unit: c.unit,
      location: 'Magasin Accessoires',
      updatedAt: now
    });
  }

  // Put into Dexie
  await db.doorModels.bulkPut(demoModels);
  await db.colours.bulkPut(demoColours);
  await db.components.bulkPut(demoComponents);
  await db.bom.bulkPut(demoBoms);
  await db.priceEntries.bulkPut(demoPrices);
  await db.clients.bulkPut(demoClients);
  await db.stockItems.bulkPut(demoStock);

  // Initial movements
  await db.stockMovements.put({
    id: 'mvt_init_demo',
    date: now.split('T')[0],
    time: new Date().toTimeString().split(' ')[0],
    articleSnapshot: 'Stock initial de démonstration OTM DOOR',
    itemType: 'RAW_MATERIAL',
    quantity: 1,
    direction: 'IN',
    type: 'ENTRÉE_INITIALE',
    motif: 'Chargement des données de démonstration métier',
    createdAt: now
  });

  await recordAudit(
    'Données de démonstration',
    'system',
    'Chargement complet du catalogue, stock et tarifs de démonstration'
  );

  return {
    success: true,
    message: 'Données de démonstration OTM DOOR chargées avec succès !'
  };
}

export async function checkIfFirstRun(): Promise<boolean> {
  try {
    const settings = await db.settings.get('company_settings');
    const modelsCount = await db.doorModels.count();
    return !settings && modelsCount === 0;
  } catch {
    return true;
  }
}

export async function seedInitialData(force: boolean = false): Promise<void> {
  await loadDemoData();
}

