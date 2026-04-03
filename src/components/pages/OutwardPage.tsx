'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { getItemBySerial, saveOutwardBatch, generateChallanNo, addActivityLog, getSettings } from '@/lib/store';
import type { OutwardBatch, InventoryItem } from '@/lib/types';
import Toast from '../Toast';
import ChallanModal from '../ChallanModal';

const BarcodeScanner = dynamic(() => import('../BarcodeScanner'), { ssr: false });

const SALE_TYPES = ['Retail Sale', 'Dealer Transfer', 'Service Return', 'Replacement'];
const TRANSPORT = ['Own Vehicle', 'Dealer Pickup', 'Courier', 'Hand Delivery'];
const GST_RATES = [0, 5, 12, 18, 28];

export default function OutwardPage({ setPage }: { setPage: (p: string) => void }) {
  const { user } = useAuth();
  const settings = getSettings();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    challanNo: generateChallanNo(),
    buyerName: '', buyerGstin: '',
    saleType: 'Retail Sale', transport: 'Own Vehicle',
    remarks: '',
  });

  const [serialInput, setSerialInput] = useState('');
  const [scannedItems, setScannedItems] = useState<InventoryItem[]>([]);
  const [toasts, setToasts] = useState<{ id: number; type: 'success' | 'error'; message: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [showChallan, setShowChallan] = useState(false);
  const [savedBatch, setSavedBatch] = useState<OutwardBatch | null>(null);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const handleSerialScan = async (raw: string) => {
    const serial = raw.trim().toUpperCase();
    if (!serial) return;
    if (scannedItems.find(i => i.serialNo === serial)) { 
      addToast('error', `Duplicate: ${serial}`); return; 
    }
    const item = await getItemBySerial(serial);
    if (!item) { addToast('error', `❌ Not Found: ${serial}`); return; }
    if (item.status !== 'IN STOCK') { addToast('error', `Already ${item.status}: ${serial}`); return; }
    setScannedItems(prev => [...prev, item]);
  };

  const buildBatch = (): OutwardBatch => ({
    id: Date.now().toString(), date: form.date, challanNo: form.challanNo,
    buyerName: form.buyerName, buyerGstin: form.buyerGstin,
    saleType: form.saleType, transport: form.transport, handedBy: user?.name || '', staffId: user?.id || '',
    remarks: form.remarks,
    serialNos: scannedItems.map(i => i.serialNo), createdAt: new Date().toISOString(),
  });

  const handleConfirm = async () => {
    if (!form.buyerName) { addToast('error', 'Buyer Name required.'); return; }
    if (scannedItems.length === 0) { addToast('error', 'No items added.'); return; }
    setSaving(true);
    const batch = buildBatch();
    await saveOutwardBatch(batch);
    await addActivityLog({ staffId: user?.id || '', staffName: user?.name || '', action: 'OUTWARD', batchSize: batch.serialNos.length, notes: `Challan ${batch.challanNo}` });
    setSavedBatch(batch); addToast('success', `🚀 Dispatch Confirmed: ${batch.challanNo}`);
    setScannedItems([]); setForm(p => ({ ...p, challanNo: generateChallanNo(), buyerName: '', buyerGstin: '', remarks: '' }));
    setSaving(false); setShowChallan(true); setStep(1);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">📤 Outward Dispatch</div>
          <div className="page-header-sub">Generate challan for sale or transfer</div>
        </div>
      </div>

      <div className="page-body">
        {step === 1 && (
          <div className="card">
            <div className="section-title mb-6">1. Customer & Dispatch Details</div>
            <div className="form-grid mb-6">
              <div className="form-group">
                <label className="form-label">Buyer / Dealer Name</label>
                <input type="text" className="form-control" placeholder="Enter Full Name" style={{ fontSize: 18, padding: 20 }} value={form.buyerName} onChange={e => setForm(p => ({ ...p, buyerName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Challan / Ref No.</label>
                <input type="text" className="form-control" style={{ fontSize: 18, padding: 20 }} value={form.challanNo} onChange={e => setForm(p => ({ ...p, challanNo: e.target.value }))} />
              </div>
            </div>
            
            <div className="form-grid-3 mb-8">
              <div className="form-group">
                <label className="form-label">Sale Type</label>
                <select className="form-control" value={form.saleType} onChange={e => setForm(p => ({ ...p, saleType: e.target.value }))}>
                  {SALE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transport</label>
                <select className="form-control" value={form.transport} onChange={e => setForm(p => ({ ...p, transport: e.target.value }))}>
                  {TRANSPORT.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>

            <button className="btn btn-primary btn-lg w-full" onClick={() => { if(!form.buyerName) { addToast('error', 'Buyer Name is required'); return; } setStep(2); }}>Next: Scan Items →</button>
          </div>
        )}

        {step === 2 && (
          <div className="dashboard-grid">
            <div className="card">
              <div className="card-title">📷 Outward Scanner</div>
              <div style={{ background: 'var(--amber)', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 700 }}>CHALLAN: {form.challanNo}</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{scannedItems.length} Products</div>
              </div>
              <BarcodeScanner onScan={handleSerialScan} label="Scan Dispatch Serial..." />
              <div className="mt-6">
                <label className="form-label">Manual Add</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" className="form-control" placeholder="Type serial..." value={serialInput} 
                    onChange={e => setSerialInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setSerialInput(''), handleSerialScan(serialInput))} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title mb-4">Items to Dispatch ({scannedItems.length})</div>
              <div className="scan-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
                {scannedItems.length === 0 && <div style={{ color: 'var(--text3)', fontWeight: 600 }}>No items scanned yet.</div>}
                {[...scannedItems].reverse().map(item => (
                  <div key={item.serialNo} className="scan-chip" style={{ background: 'var(--blue)', color: '#fff' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>{item.serialNo}</div>
                      <div style={{ fontSize: 10, opacity: 0.8 }}>{item.brand} - {item.model}</div>
                    </div>
                    <button onClick={() => { if(window.confirm(`Are you sure you want to remove ${item.serialNo}?`)) setScannedItems(p => p.filter(i => i.serialNo !== item.serialNo)) }} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}>✕</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-success btn-lg w-full mt-6" onClick={handleConfirm} disabled={saving}>🚀 Confirm Dispatch & Print</button>
              <button className="btn btn-secondary w-full mt-3" onClick={() => setStep(1)}>Back to Details</button>
            </div>
          </div>
        )}
      </div>

      {showChallan && savedBatch && <ChallanModal batch={savedBatch} items={scannedItems} settings={settings} onClose={() => setShowChallan(false)} />}
      <Toast toasts={toasts} />
    </>
  );
}
