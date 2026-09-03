import Dexie, { type Table } from 'dexie';
import type {
  CompanyInfo,
  AppSettings,
  DoorModel,
  Material,
  Colour,
  Frame,
  ComponentItem,
  BillOfMaterials,
  PriceEntry,
  Client,
  Order,
  OrderItem,
  Payment,
  ProductionOrder,
  StockItem,
  StockMovement,
  AuditLog
} from '../types';

export class OtmDoorDatabase extends Dexie {
  company!: Table<CompanyInfo, string>;
  settings!: Table<AppSettings, string>;
  doorModels!: Table<DoorModel, string>;
  materials!: Table<Material, string>;
  colours!: Table<Colour, string>;
  frames!: Table<Frame, string>;
  components!: Table<ComponentItem, string>;
  bom!: Table<BillOfMaterials, string>;
  priceEntries!: Table<PriceEntry, string>;
  clients!: Table<Client, string>;
  orders!: Table<Order, string>;
  orderItems!: Table<OrderItem, string>;
  payments!: Table<Payment, string>;
  productionOrders!: Table<ProductionOrder, string>;
  stockItems!: Table<StockItem, string>;
  stockMovements!: Table<StockMovement, string>;
  auditLogs!: Table<AuditLog, string>;

  constructor() {
    super('OtmDoorDB');
    this.version(1).stores({
      company: '++id, name',
      settings: '++id',
      doorModels: 'id, ref, name, active, createdAt',
      materials: 'id, ref, name, active',
      colours: 'id, ref, name, active',
      frames: 'id, ref, name, active',
      components: 'id, ref, name, category, active',
      bom: 'id, name, modelId, materialName, frameId, active',
      priceEntries: 'id, modelId, materialName, [width+height], price',
      clients: 'id, clientId, name, phone',
      orders: 'id, orderNumber, date, clientId, status, createdAt',
      orderItems: 'id, orderId, modelId, colourId, frameId',
      payments: 'id, receiptNumber, orderId, clientId, date, createdAt',
      productionOrders: 'id, productionNumber, orderId, orderItemId, modelId, status, createdAt',
      stockItems: 'id, itemType, materialId, componentId, modelId, [width+height]',
      stockMovements: 'id, date, direction, type, stockItemId, createdAt',
      auditLogs: 'id, date, action, objectType, createdAt'
    });
  }
}

export const db = new OtmDoorDatabase();

export async function getCompanyInfo(): Promise<CompanyInfo | undefined> {
  const all = await db.company.toArray();
  return all[0];
}

export async function getSettings(): Promise<AppSettings | undefined> {
  const all = await db.settings.toArray();
  return all[0];
}

export async function recordAudit(
  action: string,
  objectType: string,
  description: string,
  objectId?: string,
  user: string = 'Administrateur'
): Promise<void> {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];
  await db.auditLogs.add({
    id: 'aud_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    date: dateStr,
    time: timeStr,
    action,
    objectType,
    objectId,
    description,
    user,
    createdAt: now.toISOString()
  });
}
