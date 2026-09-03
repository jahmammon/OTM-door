export type OrderStatus = 
  | 'NOUVELLE'
  | 'CONFIRMÉE'
  | 'À PRODUIRE'
  | 'EN PRODUCTION'
  | 'PRÊTE'
  | 'CLÔTURÉE'
  | 'ANNULÉE';

export type ProductionStatus = 
  | 'À PRODUIRE'
  | 'EN PRODUCTION'
  | 'TERMINÉE'
  | 'ANNULÉE';

export type PaymentMethod = 
  | 'Espèces'
  | 'Virement'
  | 'CCP'
  | 'Autre';

export type StockMovementType =
  | 'ENTRÉE_INITIALE'
  | 'ACHAT'
  | 'PRODUCTION'
  | 'VENTE'
  | 'RÉSERVATION'
  | 'ANNULATION_RÉSERVATION'
  | 'CONSOMMATION'
  | 'CORRECTION'
  | 'CASSE'
  | 'RETOUR'
  | 'INVENTAIRE';

export type StockDirection = 'IN' | 'OUT' | 'RESERVATION' | 'RELEASE';

export type ItemType = 'RAW_MATERIAL' | 'COMPONENT' | 'FINISHED_DOOR';

export interface CompanyInfo {
  id?: string;
  name: string;
  logo: string; // Base64 data URL or asset path
  address: string;
  wilaya: string;
  commune: string;
  phone1: string;
  phone2?: string;
  email?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  otherInfo?: string;
  legalInfo?: string;
  headerText?: string;
  footerText?: string;
  updatedAt: string;
}

export interface AppSettings {
  id?: string;
  currency: string;
  isInitialized: boolean;
  passwordHash?: string;
  passwordSalt?: string;
  autoLockMinutes: number;
  orderPrefix: string;
  receiptPrefix: string;
  productionPrefix: string;
  nextOrderNum: number;
  nextReceiptNum: number;
  nextProductionNum: number;
  updatedAt: string;
}

export interface DoorModel {
  id: string;
  ref: string; // e.g. P-001, P-012
  name: string;
  compatibleMaterials: string[]; // ['WPC', 'MDF', 'PVC']
  cncImage?: string; // Data URL or asset path
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  ref: string;
  name: string; // WPC, MDF, PVC
  unit: string; // "panneau", "m²", etc.
  description?: string;
  minThreshold: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Colour {
  id: string;
  ref: string;
  name: string; // Blanc, Gris Anthracite, Chêne Doré, etc.
  compatibleMaterials: string[];
  photo?: string; // Data URL
  description?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Frame {
  id: string;
  ref: string; // F1, F2, F3...
  name: string;
  width: string; // e.g. "10 cm", "15 cm"
  price: number; // DA
  image?: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentItem {
  id: string;
  ref: string;
  name: string; // Charnière inox 304, Serrure magnétique, Poignée bronze, etc.
  category: string; // Charnières, Serrure, Poignée, Visserie, Joint, etc.
  unit: string; // Pièce, Sachet, Mètre
  stock: number;
  minStock: number;
  price?: number; // DA
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BomItem {
  componentId: string;
  componentRef?: string;
  componentName: string;
  quantity: number;
  unit: string;
}

export interface BillOfMaterials {
  id: string;
  name: string;
  modelId?: string; // Optional: specific to model, or generic
  materialName?: string; // WPC, MDF, PVC
  frameId?: string;
  items: BomItem[];
  rawMaterialUnitsNeeded: number; // e.g. 1 panneau
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PriceEntry {
  id: string;
  modelId?: string;
  modelRef?: string;
  modelRefSnapshot?: string;
  materialName: string;
  width?: number; // in cm
  height?: number; // in cm
  colourId?: string;
  frameId?: string;
  price: number; // in DA
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  clientId: string; // e.g. CLI-001
  name: string;
  phone: string;
  phoneSecondary?: string;
  wilaya: string;
  commune: string;
  address: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  modelId: string;
  modelRefSnapshot: string;
  modelNameSnapshot: string;
  materialName: string;
  colourId: string;
  colourNameSnapshot: string;
  width: number;
  height: number;
  frameId: string;
  frameNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalLine: number;
  isStockReserved: boolean;
  reservedQuantity: number;
  productionQuantityNeeded: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. OTM-2026-0001
  date: string;
  clientId: string;
  clientNameSnapshot: string;
  clientPhoneSnapshot: string;
  clientAddressSnapshot: string;
  expectedDate?: string;
  notes?: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  receiptNumber: string; // e.g. REC-2026-0001
  orderId: string;
  orderNumberSnapshot: string;
  clientId: string;
  clientNameSnapshot: string;
  date: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  note?: string;
  createdAt: string;
}

export interface ProductionOrder {
  id: string;
  productionNumber: string; // e.g. PROD-2026-0001
  orderId: string;
  orderNumberSnapshot: string;
  orderItemId: string;
  modelId: string;
  modelRefSnapshot: string;
  modelNameSnapshot: string;
  materialName: string;
  colourId: string;
  colourNameSnapshot: string;
  width: number;
  height: number;
  frameId: string;
  frameNameSnapshot: string;
  quantity: number;
  status: ProductionStatus;
  cncImageSnapshot?: string;
  bomSnapshot?: BillOfMaterials;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockItem {
  id: string;
  itemType: ItemType;
  // For RAW_MATERIAL:
  materialId?: string;
  materialName?: string;
  // For COMPONENT:
  componentId?: string;
  componentRef?: string;
  componentName?: string;
  // For FINISHED_DOOR:
  modelId?: string;
  modelRef?: string;
  modelName?: string;
  materialNameForDoor?: string;
  colourId?: string;
  colourName?: string;
  width?: number;
  height?: number;
  frameId?: string;
  frameRef?: string;
  frameName?: string;

  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number; // physicalQuantity - reservedQuantity
  minAlertThreshold: number;
  unit: string;
  location?: string;
  notes?: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  date: string;
  time: string;
  articleSnapshot: string;
  itemType: ItemType;
  stockItemId?: string;
  quantity: number;
  direction: StockDirection;
  type: StockMovementType;
  linkedDocument?: string; // e.g. "Commande OTM-2026-0001", "Production PROD-2026-0001"
  motif?: string;
  observation?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  date: string;
  time: string;
  action: string;
  objectType: string;
  objectId?: string;
  description: string;
  user: string;
  createdAt: string;
}

export interface BackupPayload {
  version: string;
  appVersion: string;
  timestamp: string;
  checksum: string;
  data: {
    company: CompanyInfo[];
    settings: AppSettings[];
    doorModels: DoorModel[];
    materials: Material[];
    colours: Colour[];
    frames: Frame[];
    components: ComponentItem[];
    bom: BillOfMaterials[];
    priceEntries: PriceEntry[];
    clients: Client[];
    orders: Order[];
    orderItems: OrderItem[];
    payments: Payment[];
    productionOrders: ProductionOrder[];
    stockItems: StockItem[];
    stockMovements: StockMovement[];
    auditLogs: AuditLog[];
  };
}

export type NavigationSection = 
  | 'DASHBOARD'
  | 'ORDERS'
  | 'STOCK'
  | 'PRODUCTION'
  | 'CATALOG'
  | 'PRICING'
  | 'CLIENTS'
  | 'PAYMENTS'
  | 'REPORTS'
  | 'SETTINGS'
  | 'BACKUP'
  | 'TESTS';

export type StockItemType = ItemType;
export type PriceMatrixItem = PriceEntry;

export interface CompanySettings {
  id?: string;
  name: string;
  logo: string;
  phone: string;
  phone2?: string;
  wilaya: string;
  address: string;
  rc?: string;
  nif?: string;
  nis?: string;
  art?: string;
  footerNote?: string;
  orderPrefix: string;
  productionPrefix: string;
  receiptPrefix: string;
  passwordProtected?: boolean;
  passwordHash?: string;
  passwordSalt?: string;
  updatedAt?: string;
}

