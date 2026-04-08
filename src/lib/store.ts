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
  offlineOps: 're_offline_ops',
  inventoryCache: 're_inventory_cache',
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

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  return {};
}

function toStringSafe(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function getErrorMessage(error: unknown): string {
  const info = toRecord(error);
  return toStringSafe(info.message || info.details || info.hint || error);
}

export type SaveStatus = 'saved' | 'queued';

type ActivityLogInput = Omit<ActivityLog, 'id' | 'timestamp'>;

type OfflineOpType =
  | 'INWARD_BATCH_INSERT'
  | 'INWARD_INVENTORY_UPSERT'
  | 'OUTWARD_BATCH_INSERT'
  | 'OUTWARD_INVENTORY_UPDATE'
  | 'ACTIVITY_LOG_INSERT';

interface OfflineOp {
  id: string;
  type: OfflineOpType;
  payload: InwardBatch | OutwardBatch | ActivityLogInput;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

function isOfflineError(error: unknown): boolean {
  if (!error) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = getErrorMessage(error).toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout');
}

function readOfflineOps(): OfflineOp[] {
  return get<OfflineOp[]>(KEYS.offlineOps, []);
}

function writeOfflineOps(ops: OfflineOp[]): void {
  set(KEYS.offlineOps, ops);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('re-offline-queue-updated'));
  }
}

function enqueueOfflineOp(type: OfflineOpType, payload: InwardBatch | OutwardBatch | ActivityLogInput): void {
  const ops = readOfflineOps();
  ops.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  writeOfflineOps(ops);
}

type DbResult = { data: any; error: any };

function parseDbResult(value: unknown): DbResult {
  const info = toRecord(value);
  return {
    data: info.data,
    error: info.error,
  };
}

async function insertInwardBatchRecord(batch: InwardBatch): Promise<DbResult> {
  const res = await supabase
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
  return parseDbResult(res);
}

async function upsertInventoryRowsForInward(batch: InwardBatch): Promise<{ added: number; skipped: string[]; error?: unknown }> {
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

  const res = await supabase
    .from('inventory')
    .upsert(rows, { onConflict: 'serial_no', ignoreDuplicates: true })
    .select('serial_no');

  const { data: inserted, error } = parseDbResult(res);

  if (error) return { added: 0, skipped: batch.serialNos, error };

  const insertedRows = Array.isArray(inserted) ? inserted : [];
  const insertedSerials = new Set(
    insertedRows
      .map((r) => toStringSafe(toRecord(r).serial_no))
      .filter(Boolean)
  );

  const skipped: string[] = [];
  for (const s of batch.serialNos) {
    if (!insertedSerials.has(s)) skipped.push(s);
  }

  return { added: batch.serialNos.length - skipped.length, skipped };
}

async function insertOutwardBatchRecord(batch: OutwardBatch): Promise<DbResult> {
  const res = await supabase
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
  return parseDbResult(res);
}

async function updateOutwardInventoryStatus(batch: OutwardBatch): Promise<DbResult> {
  const newStatus = batch.saleType === 'Dealer Transfer' ? 'DISPATCHED' : 'SOLD';
  const res = await supabase
    .from('inventory')
    .update({
      status: newStatus,
      outward_date: new Date().toISOString(),
      outward_challan: batch.challanNo,
      sold_to: batch.buyerName,
    })
    .in('serial_no', batch.serialNos);
  return parseDbResult(res);
}

async function insertActivityLogRecord(log: ActivityLogInput): Promise<DbResult> {
  const res = await supabase.from('activity_log').insert({
    action: log.action,
    staff_id: log.staffId,
    staff_name: log.staffName,
    godown: log.godown,
    batch_size: log.batchSize,
    notes: log.notes,
    timestamp: new Date().toISOString(),
  });
  return parseDbResult(res);
}

function getCachedInventoryBySerial(serial: string): InventoryItem | null {
  const cache = get<Record<string, InventoryItem>>(KEYS.inventoryCache, {});
  return cache[serial] || null;
}

function cacheInventoryItems(items: InventoryItem[]): void {
  if (typeof window === 'undefined') return;
  const map = get<Record<string, InventoryItem>>(KEYS.inventoryCache, {});
  for (const item of items) {
    if (!item?.serialNo) continue;
    map[item.serialNo] = item;
  }
  set(KEYS.inventoryCache, map);
}

export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const ops = readOfflineOps();
  if (ops.length === 0) return { synced: 0, failed: 0 };

  const remaining: OfflineOp[] = [];
  let synced = 0;

  for (const op of ops) {
    try {
      if (op.type === 'INWARD_BATCH_INSERT') {
        const batch = op.payload as InwardBatch;
        const batchRes = await insertInwardBatchRecord(batch);
        if (batchRes.error) throw batchRes.error;
      } else if (op.type === 'INWARD_INVENTORY_UPSERT') {
        const batch = op.payload as InwardBatch;
        const invRes = await upsertInventoryRowsForInward(batch);
        if (invRes.error) throw invRes.error;
      } else if (op.type === 'OUTWARD_BATCH_INSERT') {
        const batch = op.payload as OutwardBatch;
        const batchRes = await insertOutwardBatchRecord(batch);
        if (batchRes.error) throw batchRes.error;
      } else if (op.type === 'OUTWARD_INVENTORY_UPDATE') {
        const batch = op.payload as OutwardBatch;
        const invRes = await updateOutwardInventoryStatus(batch);
        if (invRes.error) throw invRes.error;
      } else if (op.type === 'ACTIVITY_LOG_INSERT') {
        const log = op.payload as ActivityLogInput;
        const res = await insertActivityLogRecord(log);
        if (res.error) throw res.error;
      }
      synced += 1;
    } catch (error) {
      if (isOfflineError(error)) {
        remaining.push({
          ...op,
          retryCount: (op.retryCount || 0) + 1,
          lastError: String((error as any)?.message || error || 'offline retry pending'),
        });
      } else {
        remaining.push({
          ...op,
          retryCount: (op.retryCount || 0) + 1,
          lastError: String((error as any)?.message || error || 'unexpected queue error'),
        });
        console.error('flushOfflineQueue op failed:', op.type, error);
      }
    }
  }

  writeOfflineOps(remaining);
  return { synced, failed: remaining.length };
}

export function getOfflineQueueCount(): number {
  return readOfflineOps().length;
}

export function isOfflineMode(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
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
  if (error) {
    if (isOfflineError(error)) {
      const cached = get<Record<string, InventoryItem>>(KEYS.inventoryCache, {});
      return Object.values(cached);
    }
    console.error('getInventory error:', error);
    return [];
  }
  const items = (data || []).map(mapDbToInventoryItem);
  cacheInventoryItems(items);
  return items;
}

/** Fetch a single item by serial number from Supabase */
export async function getItemBySerial(serial: string): Promise<InventoryItem | null> {
  const normalizedSerial = serial
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-\/]/g, '');
  if (!normalizedSerial) return null;

  const exact = await supabase
    .from('inventory')
    .select('*')
    .eq('serial_no', normalizedSerial)
    .single();

  if (!exact.error && exact.data) {
    const item = mapDbToInventoryItem(exact.data);
    cacheInventoryItems([item]);
    return item;
  }

  const fallback = await supabase
    .from('inventory')
    .select('*')
    .ilike('serial_no', normalizedSerial)
    .single();

  if (!fallback.error && fallback.data) {
    const item = mapDbToInventoryItem(fallback.data);
    cacheInventoryItems([item]);
    return item;
  }

  if (isOfflineError(exact.error) || isOfflineError(fallback.error)) {
    return getCachedInventoryBySerial(normalizedSerial);
  }

  return null;
}

// ── INWARD (Supabase) ─────────────────────────────────

/** Save a full inward batch — writes batch record + all inventory rows */
export async function saveInwardBatch(
  batch: InwardBatch
): Promise<{ added: number; skipped: string[]; status: SaveStatus }> {
  const batchRes = await insertInwardBatchRecord(batch);
  if (batchRes.error) {
    if (isOfflineError(batchRes.error)) {
      enqueueOfflineOp('INWARD_BATCH_INSERT', batch);
      enqueueOfflineOp('INWARD_INVENTORY_UPSERT', batch);
      return { added: batch.serialNos.length, skipped: [], status: 'queued' };
    }
    console.error('saveInwardBatch batch error:', batchRes.error);
    throw new Error('Failed to save inward batch');
  }

  const invRes = await upsertInventoryRowsForInward(batch);
  if (invRes.error) {
    if (isOfflineError(invRes.error)) {
      enqueueOfflineOp('INWARD_INVENTORY_UPSERT', batch);
      return { added: batch.serialNos.length, skipped: [], status: 'queued' };
    }
    console.error('saveInwardBatch inventory error:', invRes.error);
    throw new Error('Failed to save inward inventory rows');
  }

  const cachedRows: InventoryItem[] = batch.serialNos.map((serial) => ({
    id: serial,
    serialNo: serial,
    brand: batch.brand,
    model: batch.model,
    category: batch.category || 'General',
    hsnCode: batch.hsnCode || '',
    godown: batch.godown,
    status: 'IN STOCK',
    dateIn: batch.createdAt,
    staffIn: batch.staffId,
    supplier: batch.supplier || '',
    inwardBatchId: batch.id,
  }));
  cacheInventoryItems(cachedRows);

  return { added: invRes.added, skipped: invRes.skipped, status: 'saved' };
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

export async function saveOutwardBatch(batch: OutwardBatch): Promise<{ status: SaveStatus }> {
  const batchRes = await insertOutwardBatchRecord(batch);
  if (batchRes.error) {
    if (isOfflineError(batchRes.error)) {
      enqueueOfflineOp('OUTWARD_BATCH_INSERT', batch);
      enqueueOfflineOp('OUTWARD_INVENTORY_UPDATE', batch);
      return { status: 'queued' };
    }
    console.error('saveOutwardBatch error:', batchRes.error);
    throw new Error('Failed to save outward batch');
  }

  const invRes = await updateOutwardInventoryStatus(batch);
  if (invRes.error) {
    if (isOfflineError(invRes.error)) {
      enqueueOfflineOp('OUTWARD_INVENTORY_UPDATE', batch);
      return { status: 'queued' };
    }
    console.error('saveOutwardBatch inventory update error:', invRes.error);
    throw new Error('Failed to update outward inventory status');
  }

  const cache = get<Record<string, InventoryItem>>(KEYS.inventoryCache, {});
  const newStatus = batch.saleType === 'Dealer Transfer' ? 'DISPATCHED' : 'SOLD';
  for (const serial of batch.serialNos) {
    if (!cache[serial]) continue;
    cache[serial] = {
      ...cache[serial],
      status: newStatus,
      buyer: batch.buyerName,
      dateOut: batch.createdAt,
      invoiceNo: batch.challanNo,
    };
  }
  set(KEYS.inventoryCache, cache);

  return { status: 'saved' };
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

export async function addActivityLog(log: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<{ status: SaveStatus }> {
  const { error } = await insertActivityLogRecord(log);
  if (error) {
    if (isOfflineError(error)) {
      enqueueOfflineOp('ACTIVITY_LOG_INSERT', log);
      return { status: 'queued' };
    }
    console.error('addActivityLog error:', error);
    throw new Error('Failed to save activity log');
  }
  return { status: 'saved' };
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
