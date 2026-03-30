'use client';

import { useState, useEffect } from 'react';
import { getInventory } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { InventoryItem } from '@/lib/types';
import Toast from '../Toast';

const STATUS_COLORS: Record<string, string> = {
  'IN STOCK': 'badge-green',
  'SOLD': 'badge-blue',
  'DISPATCHED': 'badge-amber',
};

export default function InventoryPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [toasts, setToasts] = useState<{ id: number; type: 'success' | 'error'; message: string }[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => { getInventory().then(setInventory); }, []);

  const brands = ['ALL', ...Array.from(new Set(inventory.map(i => i.brand))).sort()];

  const filtered = inventory.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q || item.serialNo.toLowerCase().includes(q) || item.brand.toLowerCase().includes(q) || item.model.toLowerCase().includes(q) || (item.buyer || '').toLowerCase().includes(q) || item.godown.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchBrand = brandFilter === 'ALL' || item.brand === brandFilter;
    return matchSearch && matchStatus && matchBrand;
  });

  const exportCSV = () => {
    const headers = ['Serial No', 'Brand', 'Model', 'Category', 'HSN', 'Status', 'Date In', 'Godown', 'Staff In', 'Supplier', 'Buyer', 'Date Out', 'Invoice No', 'Handed By'];
    const rows = filtered.map(i => [i.serialNo, i.brand, i.model, i.category, i.hsnCode || '', i.status, i.dateIn, i.godown, i.staffIn, i.supplier || '', i.buyer || '', i.dateOut || '', i.invoiceNo || '', i.handedBy || '']);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `raj-electronics-inventory-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const deleteItem = async (serial: string) => {
    if (!confirm(`Are you SURE you want to delete Serial ${serial}?\nThis will permanently remove it from stock records.`)) return;
    const { error } = await supabase.from('inventory').delete().eq('serial_no', serial);
    if (error) { addToast('error', `Failed to delete: ${error.message}`); return; }
    setInventory(prev => prev.filter(i => i.serialNo !== serial));
    addToast('success', `Item ${serial} permanently deleted.`);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">📦 Inventory Master</div>
          <div className="page-header-sub">{filtered.length} of {inventory.length} units</div>
        </div>
        <button className="btn btn-secondary" onClick={exportCSV}>⬇️ Export CSV</button>
      </div>

      <div className="page-body">
        <div className="card mb-6">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input type="text" className="form-control" placeholder="🔍 Search any field..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <select className="form-control" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Status</option>
              <option value="IN STOCK">In Stock</option>
              <option value="SOLD">Sold</option>
              <option value="DISPATCHED">Dispatched</option>
            </select>
            <select className="form-control" style={{ width: 'auto' }} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Serial / IMEI</th>
                <th>Product Brand</th>
                <th>Model</th>
                <th>Status</th>
                <th>Location</th>
                <th>In Date</th>
                <th>Out Date</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.serialNo}>
                  <td style={{ color: 'var(--blue)', fontWeight: 800, fontFamily: 'var(--mono)', fontSize: 16 }}>{item.serialNo}</td>
                  <td style={{ fontWeight: 800 }}>{item.brand}</td>
                  <td style={{ fontSize: 13, fontWeight: 700 }}>{item.model}</td>
                  <td><div className={`badge ${STATUS_COLORS[item.status] || 'badge-blue'}`} style={{ fontWeight: 900, fontSize: 11, padding: '4px 12px' }}>{item.status}</div></td>
                  <td style={{ fontWeight: 600 }}>{item.godown}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{item.dateIn}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{item.dateOut || '—'}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{item.invoiceNo || '—'}</td>
                  {user?.role === 'admin' && (
                    <td>
                      <button className="btn btn-sm btn-icon" style={{ background: 'var(--red-light)', color: 'var(--red)' }} onClick={() => deleteItem(item.serialNo)}>🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, opacity: 0.5 }}>No results match your criteria.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Toast toasts={toasts} />
    </>
  );
}
