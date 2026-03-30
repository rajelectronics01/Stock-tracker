// ──────────────────────────────────────────────────────
//  Types for Raj Electronics Stock Tracker
// ──────────────────────────────────────────────────────

export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;          // RE-YYYY-XXXX for employees, 'ADMIN' for admin
  name: string;
  role: UserRole;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export type ItemStatus = 'IN STOCK' | 'SOLD' | 'DISPATCHED';

export interface InventoryItem {
  id: string;          // serial number
  serialNo: string;
  brand: string;
  model: string;
  category: string;
  hsnCode?: string;
  status: ItemStatus;
  dateIn: string;
  godown: string;
  staffIn: string;
  supplier?: string;
  inwardBatchId: string;
  // Filled on outward:
  buyer?: string;
  buyerAddress?: string;
  buyerGstin?: string;
  dateOut?: string;
  invoiceNo?: string;
  handedBy?: string;
  saleType?: string;
  transport?: string;
  pricePerUnit?: number;
  gstRate?: number;
  outwardBatchId?: string;
}

export interface InwardBatch {
  id: string;
  date: string;
  godown: string;
  brand: string;
  model: string;
  category: string;
  hsnCode?: string;
  supplier?: string;
  staffId: string;
  staffName: string;
  serialNos: string[];
  createdAt: string;
}

export interface OutwardBatch {
  id: string;
  date: string;
  challanNo: string;
  buyerName: string;
  buyerAddress?: string;
  buyerGstin?: string;
  saleType?: string;
  transport?: string;
  handedBy: string;
  staffId: string;
  gstRate?: number;
  pricePerUnit?: number;
  remarks?: string;
  serialNos: string[];
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  staffId: string;
  staffName: string;
  action: 'INWARD' | 'OUTWARD' | 'LOGIN' | 'LOGOUT';
  batchSize?: number;
  godown?: string;
  notes?: string;
}

export interface AppSettings {
  companyName: string;
  companyAddress: string;
  companyGstin: string;
  companyPhone: string;
  godowns: string[];
  adminUsername: string;
  adminPasswordHash: string;
  sheetsApiKey?: string;
  sheetsId?: string;
  lastChallanSeq: number;
  models: Record<string, string[]>;
}
