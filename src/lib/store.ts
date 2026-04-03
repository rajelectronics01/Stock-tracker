// ──────────────────────────────────────────────────────
//  Data Store — Supabase as primary DB, localStorage for
//  settings and user auth only.
// ──────────────────────────────────────────────────────

import { supabase } from './supabase';
import type {
  AppSettings, User, InventoryItem, InwardBatch,
  OutwardBatch, ActivityLog
} from './types';

// ── LOCAL STORAGE KEYS (settings/users only) ──────────
const KEYS = {
  settings: 're_settings',
  users: 're_users',
};

// ── HELPERS ───────────────────────────────────────────
function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function set<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

// ── SETTINGS (localStorage only) ─────────────────────
export function getSettings(): AppSettings {
  return get<AppSettings>(KEYS.settings, {
    companyName: 'Raj Electronics',
    companyAddress: 'Hyderabad, Telangana',
    companyGstin: '',
    companyPhone: '',
    godowns: ['Main Godown', 'Godown 2'],
    adminUsername: 'ADMIN',
    adminPasswordHash: simpleHash('admin123'),
    lastChallanSeq: 0,
    models: {},
  });
}

export function saveSettings(s: AppSettings): void {
  set(KEYS.settings, s);
}

export function saveModelToBrand(brand: string, model: string): void {
  const s = getSettings();
  if (!s.models) s.models = {};
  if (!s.models[brand]) s.models[brand] = [];
  if (!s.models[brand].includes(model)) {
    s.models[brand].push(model);
    saveSettings(s);
  }
}

// ── USERS (Supabase) ──────────────────────────────────
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    if (error.code === 'PGRST116' || error.code === '42P01') {
      console.warn('Employees table not found. Please create it in Supabase.');
    } else {
      console.error('getUsers error:', error);
    }
    return [];
  }

  return (data || []).map((r: any): User => ({
    id: r.emp_id,
    name: r.name,
    role: 'employee',
    passwordHash: r.password,
    active: r.active !== false,
    createdAt: r.created_at,
    lastLogin: r.last_login,
  }));
}

export async function saveUser(user: User): Promise<void> {
  const { error } = await supabase
    .from('employees')
    .upsert({
      emp_id: user.id,
      name: user.name,
      password: user.passwordHash,
      active: user.active,
      created_at: user.createdAt || new Date().toISOString(),
      last_login: user.lastLogin,
    });
  if (error) console.error('saveUser error:', error);
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('emp_id', id);
  if (error) console.error('deleteUser error:', error);
}

/** Migration helper to push local users to Supabase */
export async function syncLocalUsersToCloud(): Promise<void> {
  const local = get<User[]>(KEYS.users, []);
  if (local.length === 0) return;

  for (const u of local) {
    await saveUser(u);
  }
  
  // Clear local storage after sync
  localStorage.removeItem(KEYS.users);
}


// ── CHALLAN NO (localStorage) ─────────────────────────
export function generateChallanNo(): string {
  const settings = getSettings();
  const seq = (settings.lastChallanSeq || 0) + 1;
  const year = new Date().getFullYear();
  settings.lastChallanSeq = seq;
  saveSettings(settings);
  return `DC-${year}-${seq.toString().padStart(4, '0')}`;
}

// ── INVENTORY (Supabase) ──────────────────────────────

/** Fetch all inventory from Supabase */
export async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('inward_date', { ascending: false });
  if (error) { console.error('getInventory error:', error); return []; }
  return (data || []).map(mapDbToInventoryItem);
}

/** Fetch a single item by serial number from Supabase */
export async function getItemBySerial(serial: string): Promise<InventoryItem | null> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .ilike('serial_no', serial)
    .single();
  if (error || !data) return null;
  return mapDbToInventoryItem(data);
}

// ── INWARD (Supabase) ─────────────────────────────────

/** Save a full inward batch — writes batch record + all inventory rows */
export async function saveInwardBatch(
  batch: InwardBatch
): Promise<{ added: number; skipped: string[] }> {
  const skipped: string[] = [];

  // 1. Insert the inward_batch record without an explicit ID so DB auto-generates it
  const { error: batchError } = await supabase
    .from('inward_batches')
    .insert({
      date: batch.date,
      godown: batch.godown,
      brand: batch.brand,
      model: batch.model,
      staff_id: batch.staffId,
      serial_nos: batch.serialNos,
      created_at: batch.createdAt,
    });
  if (batchError) console.error('saveInwardBatch batch error:', batchError);

  // 2. Insert inventory rows (skip duplicates)
  const rows = batch.serialNos.map(serial => ({
    serial_no: serial,
    brand: batch.brand,
    model: batch.model,
    category: batch.category || null,
    hsn_code: batch.hsnCode || null,
    godown: batch.godown,
    status: 'IN STOCK',
    inward_date: new Date().toISOString(),
  }));

  // Use upsert + onConflict to count skipped
  const { data: inserted, error: invError } = await supabase
    .from('inventory')
    .upsert(rows, { onConflict: 'serial_no', ignoreDuplicates: true })
    .select('serial_no');

  if (invError) console.error('saveInwardBatch inventory error:', invError);

  const insertedSerials = new Set((inserted || []).map((r: any) => r.serial_no));
  for (const s of batch.serialNos) {
    if (!insertedSerials.has(s)) skipped.push(s);
  }

  return { added: batch.serialNos.length - skipped.length, skipped };
}

export async function getInwardBatches(): Promise<InwardBatch[]> {
  const { data, error } = await supabase
    .from('inward_batches')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getInwardBatches error:', error); return []; }
  return (data || []).map((r: any): InwardBatch => ({
    id: r.id,
    date: r.date,
    godown: r.godown,
    brand: r.brand || '',
    model: r.model || '',
    category: '',
    hsnCode: '',
    staffId: r.staff_id || '',
    staffName: r.staff_id || '',
    serialNos: r.serial_nos || [],
    createdAt: r.created_at,
  }));
}

export async function bulkExcelImport(
  items: { serialNo: string, brand: string, model: string, godown: string }[],
  staffId: string
): Promise<{ added: number, skipped: number }> {
  if (items.length === 0) return { added: 0, skipped: 0 };
  
  const rows = items.map(i => ({
    serial_no: i.serialNo,
    brand: i.brand,
    model: i.model,
    godown: i.godown || 'Main Godown',
    status: 'IN STOCK',
    inward_date: new Date().toISOString(),
    staff_id: staffId
  }));

  const { data: inserted, error } = await supabase
    .from('inventory')
    .upsert(rows, { onConflict: 'serial_no', ignoreDuplicates: true })
    .select('serial_no');

  if (error) {
    console.error('bulkExcelImport error', error);
    throw new Error('Database error during bulk import.');
  }

  const added = inserted?.length ?? 0;
  const skipped = items.length - added;
  return { added, skipped };
}

// ── OUTWARD (Supabase) ────────────────────────────────

export async function saveOutwardBatch(batch: OutwardBatch): Promise<void> {
  // 1. Insert the outward_batch record without an explicit ID
  const { error: batchError } = await supabase
    .from('outward_batches')
    .insert({
      date: batch.date,
      challan_no: batch.challanNo,
      buyer_name: batch.buyerName,
      buyer_gstin: batch.buyerGstin || null,
      sale_type: batch.saleType,
      transport: batch.transport,
      remarks: batch.remarks || null,
      staff_id: batch.staffId,
      serial_nos: batch.serialNos,
      created_at: batch.createdAt,
    });
  if (batchError) console.error('saveOutwardBatch error:', batchError);

  // 2. Update inventory status for each serial
  const newStatus = batch.saleType === 'Dealer Transfer' ? 'DISPATCHED' : 'SOLD';
  const { error: invError } = await supabase
    .from('inventory')
    .update({
      status: newStatus,
      outward_date: new Date().toISOString(),
      outward_challan: batch.challanNo,
      sold_to: batch.buyerName,
    })
    .in('serial_no', batch.serialNos);
  if (invError) console.error('saveOutwardBatch inventory update error:', invError);
}

export async function getOutwardBatches(): Promise<OutwardBatch[]> {
  const { data, error } = await supabase
    .from('outward_batches')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getOutwardBatches error:', error); return []; }
  return (data || []).map((r: any): OutwardBatch => ({
    id: r.id,
    date: r.date,
    challanNo: r.challan_no,
    buyerName: r.buyer_name,
    buyerGstin: r.buyer_gstin || '',
    saleType: r.sale_type,
    transport: r.transport,
    remarks: r.remarks || '',
    staffId: r.staff_id || '',
    handedBy: r.staff_id || '',
    serialNos: r.serial_nos || [],
    createdAt: r.created_at,
  }));
}

// ── ACTIVITY LOG (Supabase) ───────────────────────────

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(500);
  if (error) { console.error('getActivityLogs error:', error); return []; }
  return (data || []).map((r: any): ActivityLog => ({
    id: r.id,
    action: r.action,
    staffId: r.staff_id,
    staffName: r.staff_name,
    godown: r.godown,
    batchSize: r.batch_size,
    notes: r.notes,
    timestamp: r.timestamp,
  }));
}

export async function addActivityLog(log: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    action: log.action,
    staff_id: log.staffId,
    staff_name: log.staffName,
    godown: log.godown,
    batch_size: log.batchSize,
    notes: log.notes,
    timestamp: new Date().toISOString(),
  });
  if (error) console.error('addActivityLog error:', error);
}

// ── SEED ─────────────────────────────────────────────
export function ensureSeeded(): void {
  getSettings();
}

// ── MAPPER ───────────────────────────────────────────
function mapDbToInventoryItem(r: any): InventoryItem {
  return {
    id: r.id,
    serialNo: r.serial_no,
    brand: r.brand,
    model: r.model,
    category: r.category,
    hsnCode: r.hsn_code,
    godown: r.godown,
    status: r.status,
    dateIn: r.inward_date,
    dateOut: r.outward_date,
    invoiceNo: r.outward_challan,
    buyer: r.sold_to,
    staffIn: '',
    supplier: '',
    inwardBatchId: '',
  };
}
