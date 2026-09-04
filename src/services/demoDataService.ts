import { db, recordAudit, getCompanyInfo, getSettings } from '../db';
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
  AppSettings,
  Worker,
  WorkerAdvance,
  WorkerBonus
} from '../types';
import { hashPassword } from './securityService';

export const CNC_DRAWING_P001 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" fill="%231e293b"><rect width="400" height="800" fill="%230f172a"/><rect x="30" y="40" width="340" height="720" rx="8" fill="none" stroke="%2338bdf8" stroke-width="4"/><line x1="60" y1="200" x2="340" y2="200" stroke="%2338bdf8" stroke-width="3" stroke-dasharray="6,6"/><line x1="60" y1="350" x2="340" y2="350" stroke="%2338bdf8" stroke-width="3" stroke-dasharray="6,6"/><line x1="60" y1="500" x2="340" y2="500" stroke="%2338bdf8" stroke-width="3" stroke-dasharray="6,6"/><circle cx="330" cy="420" r="10" fill="%23f59e0b"/><text x="200" y="740" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">CNC P-001 LIGNES MODERNES</text></svg>`;

export const CNC_DRAWING_P012 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" fill="%231e293b"><rect width="400" height="800" fill="%230f172a"/><rect x="30" y="40" width="340" height="720" rx="8" fill="none" stroke="%23c59b27" stroke-width="4"/><rect x="60" y="80" width="280" height="260" rx="6" fill="none" stroke="%23c59b27" stroke-width="5"/><rect x="80" y="100" width="240" height="220" rx="4" fill="none" stroke="%23c59b27" stroke-width="2"/><rect x="60" y="380" width="280" height="320" rx="6" fill="none" stroke="%23c59b27" stroke-width="5"/><rect x="80" y="400" width="240" height="280" rx="4" fill="none" stroke="%23c59b27" stroke-width="2"/><circle cx="330" cy="430" r="10" fill="%23f59e0b"/><text x="200" y="740" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">CNC P-012 DOUBLE MOULURE</text></svg>`;

export const CNC_DRAWING_P024 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" fill="%231e293b"><rect width="400" height="800" fill="%230f172a"/><rect x="30" y="40" width="340" height="720" rx="8" fill="none" stroke="%23e2e8f0" stroke-width="4"/><rect x="70" y="120" width="20" height="560" fill="%2394a3b8"/><line x1="110" y1="200" x2="330" y2="200" stroke="%2394a3b8" stroke-width="4"/><line x1="110" y1="280" x2="330" y2="280" stroke="%2394a3b8" stroke-width="4"/><line x1="110" y1="360" x2="330" y2="360" stroke="%2394a3b8" stroke-width="4"/><circle cx="330" cy="420" r="10" fill="%23f59e0b"/><text x="200" y="740" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">CNC P-024 INSERTS MÉTAL</text></svg>`;

// =========================================================================
// Authoritative Initial Catalogue Constants
// =========================================================================
export const INITIAL_MATERIALS: Material[] = [
  {
    id: 'mat_wpc',
    ref: 'MAT-WPC',
    name: 'WPC',
    unit: 'panneau',
    description: 'Wood Plastic Composite — Résistant à l’eau et imputrescible',
    minThreshold: 10,
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'mat_mdf',
    ref: 'MAT-MDF',
    name: 'MDF',
    unit: 'panneau',
    description: 'Panneau MDF haute densité pour usinage CNC fin et laquage',
    minThreshold: 10,
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'mat_pvc',
    ref: 'MAT-PVC',
    name: 'PVC',
    unit: 'panneau',
    description: 'PVC structure alvéolaire isolant thermique et phonique',
    minThreshold: 8,
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  }
];

export const INITIAL_FRAMES: Frame[] = [
  {
    id: 'frm_f1',
    ref: 'F1',
    name: 'Cadre Standard 10 cm',
    width: '10 cm',
    price: 3500,
    description: 'Cadre dormant fin pour cloisons intérieures 10 cm',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'frm_f2',
    ref: 'F2',
    name: 'Cadre Médium 15 cm',
    width: '15 cm',
    price: 4500,
    description: 'Cadre robuste pour murs standards de 15 cm',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'frm_f3',
    ref: 'F3',
    name: 'Cadre Large 20 cm',
    width: '20 cm',
    price: 5500,
    description: 'Cadre enveloppant pour murs épais de 20 cm avec couvre-joints',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  }
];

export const INITIAL_DOOR_MODELS: DoorModel[] = [
  {
    id: 'mod_p001',
    ref: 'P-001',
    name: 'Lignes Géométriques Modernes',
    compatibleMaterials: ['WPC', 'MDF', 'PVC'],
    standardWidth: 80,
    standardHeight: 210,
    defaultDimensions: '80 x 210 cm',
    compatibleColours: ['col_blanc', 'col_gris', 'col_noir'],
    defaultFrameId: 'frm_f1',
    cncImage: CNC_DRAWING_P001,
    description: 'Modèle épuré contemporain avec 3 rainures horizontales gravées au laser CNC',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'mod_p012',
    ref: 'P-012',
    name: 'Classique Double Moulure Prestige',
    compatibleMaterials: ['WPC', 'MDF'],
    standardWidth: 80,
    standardHeight: 210,
    defaultDimensions: '80 x 210 cm',
    compatibleColours: ['col_blanc', 'col_chene'],
    defaultFrameId: 'frm_f2',
    cncImage: CNC_DRAWING_P012,
    description: 'Design néoclassique indémodable à deux caissons travaillés en relief',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'mod_p024',
    ref: 'P-024',
    name: 'Contemporain Insert Inox Brossé',
    compatibleMaterials: ['WPC', 'MDF', 'PVC'],
    standardWidth: 90,
    standardHeight: 210,
    defaultDimensions: '90 x 210 cm',
    compatibleColours: ['col_blanc', 'col_gris', 'col_noir'],
    defaultFrameId: 'frm_f3',
    cncImage: CNC_DRAWING_P024,
    description: 'Modèle haut de gamme mariant textures mates et liserés en acier inoxydable',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'mod_p031',
    ref: 'P-031',
    name: 'Minimaliste Plein Zen',
    compatibleMaterials: ['WPC', 'PVC'],
    standardWidth: 85,
    standardHeight: 215,
    defaultDimensions: '85 x 215 cm',
    compatibleColours: ['col_blanc', 'col_noir'],
    defaultFrameId: 'frm_f1',
    cncImage: CNC_DRAWING_P001,
    description: 'Finition plane lisse acoustique idéale pour bureaux et chambres d’hôtel',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  }
];

export const INITIAL_COLOURS: Colour[] = [
  {
    id: 'col_blanc',
    ref: 'COL-01',
    name: 'Blanc Brillant',
    compatibleMaterials: ['WPC', 'MDF', 'PVC'],
    photo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f8fafc"/><text x="50" y="55" font-size="12" fill="%2364748b" text-anchor="middle">Blanc</text></svg>',
    description: 'Blanc pur lumineux laqué résistant aux UV',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'col_gris',
    ref: 'COL-02',
    name: 'Gris Anthracite RAL 7016',
    compatibleMaterials: ['WPC', 'MDF', 'PVC'],
    photo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23374151"/><text x="50" y="55" font-size="12" fill="%23f9fafb" text-anchor="middle">Gris</text></svg>',
    description: 'Gris anthracite mat très moderne',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'col_chene',
    ref: 'COL-03',
    name: 'Chêne Doré Naturel',
    compatibleMaterials: ['WPC', 'MDF'],
    photo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23b45309"/><text x="50" y="55" font-size="12" fill="%23fef3c7" text-anchor="middle">Chêne</text></svg>',
    description: 'Texture bois chaleureuse veinée en relief',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'col_noir',
    ref: 'COL-04',
    name: 'Noir Satiné Intense',
    compatibleMaterials: ['WPC', 'PVC'],
    photo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23111827"/><text x="50" y="55" font-size="12" fill="%23f3f4f6" text-anchor="middle">Noir</text></svg>',
    description: 'Noir mat velouté anti-traces de doigts',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  }
];

export const INITIAL_COMPONENTS: ComponentItem[] = [
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  }
];

export const INITIAL_BOMS: BillOfMaterials[] = [
  {
    id: 'bom_p001_standard',
    name: 'BOM Standard P-001 (Lignes Géométriques)',
    modelId: 'mod_p001',
    materialName: 'WPC',
    items: [
      { componentId: 'cmp_charniere', componentName: 'Charnière Inox 304 4 pouces', quantity: 3, unit: 'pièce' },
      { componentId: 'cmp_serrure', componentName: 'Serrure Magnétique Silencieuse', quantity: 1, unit: 'pièce' },
      { componentId: 'cmp_poignee', componentName: 'Poignée Aluminium Design Bronze', quantity: 1, unit: 'pièce' },
      { componentId: 'cmp_visserie', componentName: 'Kit Visserie & Fixation Dormant', quantity: 1, unit: 'sachet' },
      { componentId: 'cmp_joint', componentName: 'Joint Acoustique Isophonique EPDM', quantity: 5, unit: 'mètre' }
    ],
    rawMaterialUnitsNeeded: 1,
    notes: 'Nomenclature standard pour modèle P-001 rainuré',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
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
    notes: 'Nomenclature standard usine pour modèle P-012 WPC avec Cadre F2',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'bom_p012_standard',
    name: 'BOM Standard P-012 (Double Moulure)',
    modelId: 'mod_p012',
    materialName: 'WPC',
    items: [
      { componentId: 'cmp_charniere', componentName: 'Charnière Inox 304 4 pouces', quantity: 3, unit: 'pièce' },
      { componentId: 'cmp_serrure', componentName: 'Serrure Magnétique Silencieuse', quantity: 1, unit: 'pièce' },
      { componentId: 'cmp_poignee', componentName: 'Poignée Aluminium Design Bronze', quantity: 1, unit: 'pièce' },
      { componentId: 'cmp_visserie', componentName: 'Kit Visserie & Fixation Dormant', quantity: 1, unit: 'sachet' },
      { componentId: 'cmp_joint', componentName: 'Joint Acoustique Isophonique EPDM', quantity: 5, unit: 'mètre' }
    ],
    rawMaterialUnitsNeeded: 1,
    notes: 'Nomenclature modèle P-012 tous cadres',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'bom_p024_standard',
    name: 'BOM Standard P-024 (Insert Inox Brossé)',
    modelId: 'mod_p024',
    materialName: 'WPC',
    items: [
      { componentId: 'cmp_charniere', componentName: 'Charnière Inox 304 4 pouces', quantity: 3, unit: 'pièce' },
      { componentId: 'cmp_serrure', componentName: 'Serrure Magnétique Silencieuse', quantity: 1, unit: 'pièce' },
      { componentId: 'cmp_poignee', componentName: 'Poignée Aluminium Design Bronze', quantity: 1, unit: 'pièce' },
      { componentId: 'cmp_visserie', componentName: 'Kit Visserie & Fixation Dormant', quantity: 1, unit: 'sachet' },
      { componentId: 'cmp_joint', componentName: 'Joint Acoustique Isophonique EPDM', quantity: 5, unit: 'mètre' }
    ],
    rawMaterialUnitsNeeded: 1,
    notes: 'Nomenclature modèle P-024 avec insert inox',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'bom_p031_standard',
    name: 'BOM Standard P-031 (Minimaliste Plein Zen)',
    modelId: 'mod_p031',
    materialName: 'WPC',
    items: [
      { componentId: 'cmp_charniere', componentName: 'Charnière Inox 304 4 pouces', quantity: 3, unit: 'pièce' },
      { componentId: 'cmp_serrure', componentName: 'Serrure Magnétique Silencieuse', quantity: 1, unit: 'pièce' },
      { componentId: 'cmp_poignee', componentName: 'Poignée Aluminium Design Bronze', quantity: 1, unit: 'pièce' },
      { componentId: 'cmp_visserie', componentName: 'Kit Visserie & Fixation Dormant', quantity: 1, unit: 'sachet' },
      { componentId: 'cmp_joint', componentName: 'Joint Acoustique Isophonique EPDM', quantity: 5, unit: 'mètre' }
    ],
    rawMaterialUnitsNeeded: 1,
    notes: 'Nomenclature modèle P-031 panneau plein',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  }
];

export const INITIAL_PRICES: PriceEntry[] = [
  {
    id: 'prc_p012_wpc_80x210',
    modelId: 'mod_p012',
    modelRefSnapshot: 'P-012',
    materialName: 'WPC',
    width: 80,
    height: 210,
    price: 25000,
    notes: 'Tarif officiel P-012 WPC 80x210 cm',
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
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
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  }
];

export async function initializeCleanSetup(
  companyInput?: Partial<CompanyInfo>,
  password?: string,
  settingsInput?: Partial<AppSettings>
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Company
  const company: CompanyInfo = {
    id: 'comp_default',
    name: companyInput?.name?.trim() || 'OTM DOOR',
    logo: companyInput?.logo || '/otm-door-logo.png',
    address: companyInput?.address?.trim() || 'Zone Industrielle Oued Smar, Lot N° 45',
    wilaya: companyInput?.wilaya?.trim() || 'Alger',
    commune: companyInput?.commune?.trim() || 'Oued Smar',
    phone1: companyInput?.phone1?.trim() || '0550 12 34 56',
    phone2: companyInput?.phone2?.trim() || '',
    email: companyInput?.email?.trim() || '',
    website: companyInput?.website?.trim() || '',
    facebook: companyInput?.facebook?.trim() || '',
    instagram: companyInput?.instagram?.trim() || '',
    legalInfo: companyInput?.legalInfo?.trim() || '',
    headerText: companyInput?.headerText || 'OTM DOOR — Usine de Fabrication & Vente de Portes',
    footerText: companyInput?.footerText || 'OTM DOOR Algérie — Tous droits réservés — Document officiel certifié',
    updatedAt: now
  };

  // 2. Settings & Security - hash password before Dexie transaction
  let passHash = '';
  let passSalt = '';
  if (password && password.trim()) {
    const hashed = await hashPassword(password);
    passHash = hashed.hash;
    passSalt = hashed.salt;
  }

  const settings: AppSettings = {
    id: 'sett_default',
    currency: settingsInput?.currency || 'DA',
    isInitialized: true,
    setupCompleted: true,
    passwordHash: passHash,
    passwordSalt: passSalt,
    autoLockMinutes: settingsInput?.autoLockMinutes ?? 15,
    orderPrefix: settingsInput?.orderPrefix?.trim() || 'OTM-2026-',
    receiptPrefix: settingsInput?.receiptPrefix?.trim() || 'REC-2026-',
    productionPrefix: settingsInput?.productionPrefix?.trim() || 'PROD-2026-',
    nextOrderNum: settingsInput?.nextOrderNum ?? 1,
    nextReceiptNum: settingsInput?.nextReceiptNum ?? 1,
    nextProductionNum: settingsInput?.nextProductionNum ?? 1,
    updatedAt: now
  };

  // Atomic database transaction ensuring all setup records are committed together
  await db.transaction('rw', [
    db.company,
    db.settings,
    db.materials,
    db.frames,
    db.colours,
    db.doorModels,
    db.components,
    db.bom,
    db.priceEntries,
    db.stockItems,
    db.auditLogs
  ], async () => {
    await db.company.put(company);
    await db.settings.put(settings);

    // Initial Materials
    for (const m of INITIAL_MATERIALS) {
      const exists = await db.materials.get(m.id);
      if (!exists) await db.materials.put(m);
    }

    // Initial Frames
    for (const f of INITIAL_FRAMES) {
      const exists = await db.frames.get(f.id);
      if (!exists) await db.frames.put(f);
    }

    // Initial Colours
    for (const c of INITIAL_COLOURS) {
      const exists = await db.colours.get(c.id);
      if (!exists) await db.colours.put(c);
    }

    // Initial Door Models
    for (const dm of INITIAL_DOOR_MODELS) {
      const exists = await db.doorModels.get(dm.id);
      if (!exists) await db.doorModels.put(dm);
    }

    // Initial Components
    for (const cmp of INITIAL_COMPONENTS) {
      const exists = await db.components.get(cmp.id);
      if (!exists) await db.components.put(cmp);
    }

    // Initial BOMs
    for (const b of INITIAL_BOMS) {
      const exists = await db.bom.get(b.id);
      if (!exists) await db.bom.put(b);
    }

    // Initial Prices
    for (const p of INITIAL_PRICES) {
      const exists = await db.priceEntries.get(p.id);
      if (!exists) await db.priceEntries.put(p);
    }

    // Initial Raw Material and Component Stock Items
    const rawWpc = await db.stockItems.get('stk_raw_wpc');
    if (!rawWpc) {
      await db.stockItems.put({
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
      });
    }
    const rawMdf = await db.stockItems.get('stk_raw_mdf');
    if (!rawMdf) {
      await db.stockItems.put({
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
      });
    }
    const rawPvc = await db.stockItems.get('stk_raw_pvc');
    if (!rawPvc) {
      await db.stockItems.put({
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
      });
    }

    for (const c of INITIAL_COMPONENTS) {
      const stkId = `stk_comp_${c.id}`;
      const existingStk = await db.stockItems.get(stkId);
      if (!existingStk) {
        await db.stockItems.put({
          id: stkId,
          itemType: 'COMPONENT',
          componentId: c.id,
          componentRef: c.ref,
          componentName: c.name,
          physicalQuantity: c.stock || 100,
          reservedQuantity: 0,
          availableQuantity: c.stock || 100,
          minAlertThreshold: c.minStock,
          unit: c.unit,
          location: 'Magasin Accessoires',
          updatedAt: now
        });
      }
    }

    await db.auditLogs.add({
      id: 'aud_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      date: now.split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      action: 'Initialisation système',
      objectType: 'system',
      description: 'Configuration initiale OTM DOOR et catalogue validés avec setupCompleted = true',
      user: 'Administrateur',
      createdAt: now
    });
  });
}

/**
 * Ensures all catalogue tables (doorModels, colours, frames, materials, components, BOM, prices, stock items)
 * are populated in IndexedDB. If any table is empty, seeds it from authoritative initial records.
 * Idempotent, safe, and persists across browser reloads (F5).
 */
export async function ensureCatalogueSeeded(): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', [
    db.materials,
    db.frames,
    db.colours,
    db.doorModels,
    db.components,
    db.bom,
    db.priceEntries,
    db.stockItems,
    db.auditLogs
  ], async () => {
    // 1. Materials
    for (const m of INITIAL_MATERIALS) {
      const exists = await db.materials.get(m.id);
      if (!exists) await db.materials.put(m);
    }

    // 2. Frames
    for (const f of INITIAL_FRAMES) {
      const exists = await db.frames.get(f.id);
      if (!exists) await db.frames.put(f);
    }

    // 3. Colours
    for (const c of INITIAL_COLOURS) {
      const exists = await db.colours.get(c.id);
      if (!exists) await db.colours.put(c);
    }

    // 4. Door Models
    for (const dm of INITIAL_DOOR_MODELS) {
      const exists = await db.doorModels.get(dm.id);
      if (!exists) {
        await db.doorModels.put(dm);
      }
    }

    // Backfill missing fields on existing models if any
    const existingModels = await db.doorModels.toArray();
    for (const m of existingModels) {
      let dirty = false;
      if (!m.standardWidth) {
        m.standardWidth = m.ref === 'P-024' ? 90 : m.ref === 'P-031' ? 85 : 80;
        dirty = true;
      }
      if (!m.standardHeight) {
        m.standardHeight = m.ref === 'P-031' ? 215 : 210;
        dirty = true;
      }
      if (!m.defaultDimensions) {
        m.defaultDimensions = `${m.standardWidth} x ${m.standardHeight} cm`;
        dirty = true;
      }
      if (!m.compatibleColours || m.compatibleColours.length === 0) {
        m.compatibleColours = ['col_blanc', 'col_gris', 'col_chene', 'col_noir'];
        dirty = true;
      }
      if (!m.defaultFrameId) {
        m.defaultFrameId = m.ref === 'P-012' ? 'frm_f2' : m.ref === 'P-024' ? 'frm_f3' : 'frm_f1';
        dirty = true;
      }
      if (dirty) {
        await db.doorModels.put(m);
      }
    }

    // 5. Components
    for (const cmp of INITIAL_COMPONENTS) {
      const exists = await db.components.get(cmp.id);
      if (!exists) await db.components.put(cmp);
    }

    // 6. BOMs
    for (const b of INITIAL_BOMS) {
      const exists = await db.bom.get(b.id);
      if (!exists) await db.bom.put(b);
    }

    // 7. Prices
    for (const p of INITIAL_PRICES) {
      const exists = await db.priceEntries.get(p.id);
      if (!exists) await db.priceEntries.put(p);
    }

    // 8. Stock Items for raw materials and components
    const stockCount = await db.stockItems.count();
    if (stockCount === 0) {
      await db.stockItems.put({
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
      });
      await db.stockItems.put({
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
      });
      await db.stockItems.put({
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
      });

      for (const c of INITIAL_COMPONENTS) {
        await db.stockItems.put({
          id: `stk_comp_${c.id}`,
          itemType: 'COMPONENT',
          componentId: c.id,
          componentRef: c.ref,
          componentName: c.name,
          physicalQuantity: c.stock || 100,
          reservedQuantity: 0,
          availableQuantity: c.stock || 100,
          minAlertThreshold: c.minStock,
          unit: c.unit,
          location: 'Magasin Accessoires',
          updatedAt: now
        });
      }
    }
  });
}

export async function loadDemoData(): Promise<{ success: boolean; message: string }> {
  // Ensure the entire foundational catalogue is seeded first
  await ensureCatalogueSeeded();

  const now = new Date().toISOString();

  // Re-use exported constants for consistency and maintainability
  const demoModels: DoorModel[] = INITIAL_DOOR_MODELS;
  const demoColours: Colour[] = INITIAL_COLOURS;
  const demoComponents: ComponentItem[] = INITIAL_COMPONENTS;
  const demoBoms: BillOfMaterials[] = INITIAL_BOMS;
  const demoPrices: PriceEntry[] = INITIAL_PRICES;

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
  await db.materials.bulkPut(INITIAL_MATERIALS);
  await db.frames.bulkPut(INITIAL_FRAMES);
  await db.doorModels.bulkPut(demoModels);
  await db.colours.bulkPut(demoColours);
  await db.components.bulkPut(demoComponents);
  await db.bom.bulkPut(demoBoms);
  await db.priceEntries.bulkPut(demoPrices);
  await db.clients.bulkPut(demoClients);
  await db.stockItems.bulkPut(demoStock);

  // Demo workers & advances
  const demoWorkers: Worker[] = [
    {
      id: 'wrk_001',
      name: 'Mourad Boualem',
      fonction: 'Opérateur CNC & Usinage',
      salary: 58000,
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'wrk_002',
      name: 'Youcef Khellaf',
      fonction: 'Monteur Atelier & Assemblage Dormants',
      salary: 52000,
      active: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'wrk_003',
      name: 'Rachid Merzoug',
      fonction: 'Finisseur & Placage Chants',
      salary: 49000,
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ];

  const currentMonthStr = now.slice(0, 7);
  const demoWorkerAdvances: WorkerAdvance[] = [
    {
      id: 'adv_001',
      workerId: 'wrk_001',
      date: `${currentMonthStr}-05`,
      amount: 15000,
      note: 'Avance quinzaine',
      createdAt: now
    },
    {
      id: 'adv_002',
      workerId: 'wrk_002',
      date: `${currentMonthStr}-10`,
      amount: 10000,
      note: 'Avance sur salaire',
      createdAt: now
    }
  ];

  const demoWorkerBonuses: WorkerBonus[] = [
    {
      id: 'bon_001',
      workerId: 'wrk_001',
      date: `${currentMonthStr}-15`,
      amount: 5000,
      motif: 'Prime de rendement et conformité usinage',
      createdAt: now
    },
    {
      id: 'bon_002',
      workerId: 'wrk_002',
      date: `${currentMonthStr}-18`,
      amount: 3000,
      motif: 'Heures supplémentaires assemblage',
      createdAt: now
    }
  ];

  await db.workers.bulkPut(demoWorkers);
  await db.workerAdvances.bulkPut(demoWorkerAdvances);
  await db.workerBonuses.bulkPut(demoWorkerBonuses);

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

export async function isSetupCompleted(): Promise<{ completed: boolean; reason?: string }> {
  try {
    const settings = await getSettings();
    if (!settings) {
      return { completed: false, reason: 'Paramètres système (settings) manquants dans IndexedDB' };
    }
    if (!settings.setupCompleted && !settings.isInitialized) {
      return { completed: false, reason: 'setupCompleted et isInitialized sont non définis ou faux' };
    }
    const company = await getCompanyInfo();
    if (!company || !company.name?.trim()) {
      return { completed: false, reason: 'Coordonnées entreprise (companyInfo) manquantes' };
    }
    return { completed: true };
  } catch (err: any) {
    return { completed: false, reason: `Erreur d'accès à la base de données: ${err?.message || err}` };
  }
}

export async function checkIfFirstRun(): Promise<boolean> {
  const status = await isSetupCompleted();
  if (status.completed) {
    console.log('[OTM DOOR] Setup chargé');
    console.log('[OTM DOOR] setupCompleted = true');
    return false;
  } else {
    console.log(`[OTM DOOR] Setup incomplet: ${status.reason}`);
    return true;
  }
}

export async function seedInitialData(force: boolean = false): Promise<void> {
  await initializeCleanSetup();
  await loadDemoData();
}

