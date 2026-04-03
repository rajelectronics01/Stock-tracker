'use client';

import { useState, useEffect, useRef } from 'react';
import { getSettings, saveInwardBatch, addActivityLog, saveModelToBrand } from '@/lib/store';
import { useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { AppSettings, InwardBatch } from '@/lib/types';
import dynamic from 'next/dynamic';
const BarcodeScanner = dynamic(() => import('../BarcodeScanner'), { ssr: false });
import Toast from '../Toast';

const BRANDS = [
  { name: 'Lloyd', icon: '❄️', image: '/brands/lloyd.png' },
  { name: 'Whirlpool', icon: '🌀', image: '/brands/whirlpool.png' },
  { name: 'Crompton', icon: '💡', image: '/brands/crompton.png' },
  { name: 'Orient', icon: '🌬️', image: '/brands/orient.png' },
  { name: 'Samsung', icon: '📱' },
  { name: 'Daikin', icon: '💎' },
  { name: 'Carrier', icon: '🌬️' },
  { name: 'Blue Star', icon: '🌟' },
  { name: 'Sansui', icon: '📺', image: '/brands/sansui.png' },
  { name: 'LG', icon: '🔴', image: '/brands/lg.png' },
  { name: 'Voltas', icon: '⚡' },
  { name: 'Mitsubishi', icon: '🏢', image: '/brands/mitsubishi.png' },
  { name: 'O-General', icon: '⚙️' },
  { name: 'Hitachi', icon: '🏗️' },
  { name: 'Godrej', icon: '🌳', image: '/brands/godrej.png' },
  { name: 'Haier', icon: '🌊', image: '/brands/haier.png' },
  { name: 'TG Smart', icon: '📱', image: '/brands/tgsmart.png.jpeg' },
];

export default function InwardPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState({ brand: '', model: '', category: '', hsnCode: '' });
  const [godown, setGodown] = useState('');
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('');
  const [serialNos, setSerialNos]     = useState<string[]>([]);
  const [manualSerial, setManualSerial] = useState('');
  const [toasts, setToasts]           = useState<{ id: number; type: 'success' | 'error'; message: string }[]>([]);
  const [settings, setSettings]       = useState<AppSettings | null>(null);
  // Ref-based set for SYNCHRONOUS duplicate checking — avoids stale closure bug
  // where two rapid scans both see serialNos=[] and both get added
  const scannedSetRef = useRef<Set<string>>(new Set());

  const modelInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = getSettings();
    setSettings(s);
    if (s.godowns.length > 0) setGodown(s.godowns[0]);
  }, []);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const handleSerialScan = (serial: string) => {
    const s = serial.trim().toUpperCase();
    if (!s) return;
    // Check ref FIRST (synchronous) — prevents duplicates from rapid fire scans
    if (scannedSetRef.current.has(s)) return;
    scannedSetRef.current.add(s);
    setSerialNos(prev => [...prev, s]);
  };

  const removeSerial = (serial: string) => {
    if (window.confirm(`Are you sure you want to remove ${serial}?`)) {
      scannedSetRef.current.delete(serial);
      setSerialNos(prev => prev.filter(s => s !== serial));
      addToast('success', `Removed ${serial}`);
    }
  };

  const handleSave = async () => {
    if (serialNos.length === 0) {
      addToast('error', 'Please scan at least one serial number.'); return;
    }
    const batch: InwardBatch = {
      id: Date.now().toString(), date: batchDate, godown, brand: product.brand,
      model: product.model, category: product.category || 'General', hsnCode: product.hsnCode,
      staffId: user?.id || '', staffName: user?.name || '', serialNos, createdAt: new Date().toISOString(),
    };
    const { added, skipped } = await saveInwardBatch(batch);
    saveModelToBrand(product.brand, product.model);
    await addActivityLog({
      action: 'INWARD', staffId: user?.id || '', staffName: user?.name || '',
      godown, batchSize: added, notes: `Inward: ${product.brand} ${product.model}`
    });
    if (skipped.length > 0) {
      addToast('error', `⚠️ ${skipped.length} duplicate serials skipped.`);
    }
    addToast('success', `✅ ${added} items saved to cloud inventory!`);
    scannedSetRef.current.clear(); // reset dedup ref after save
    setTimeout(() => window.location.reload(), 1800);
  };

  if (!settings) return null;

  const brandModels = (settings.models || {})[product.brand] || [];

  return (
    <div className="layout-body" style={{ minHeight: '100%' }}>
      <div className="page-header">
        <div>
          <div className="page-header-title">📥 Inward Stock</div>
          <div className="page-header-sub">Scan received stock into inventory</div>
        </div>
      </div>

      <div className="page-body">
        {step === 1 && (
          <div className="card">
            <div className="card-title mb-6">1. Select Brand</div>
            <div className="brand-grid mb-8">
              {BRANDS.map(b => (
                <div key={b.name} 
                  className={`brand-item ${product.brand === b.name ? 'active' : ''}`} 
                  onClick={() => {
                    setProduct(p => ({ ...p, brand: b.name }));
                    modelInputRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}>
                  <div style={{ width: 48, height: 48, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {b.image ? (
                      <img src={b.image} alt={b.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ fontSize: 32 }}>{b.icon}</div>
                    )}
                  </div>
                  <div className="brand-item-name">{b.name}</div>
                </div>
              ))}
              <div className={`brand-item ${product.brand && !BRANDS.find(b => b.name === product.brand) ? 'active' : ''}`} 
                onClick={() => { const c = prompt('Brand Name:'); if(c) setProduct(p => ({ ...p, brand: c })); }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>➕</div>
                <div className="brand-item-name">Other</div>
              </div>
            </div>

            <div ref={modelInputRef} className="form-group mb-6" style={{ scrollMargin: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">2. Model Name / Number</label>
                {product.brand && product.model && !brandModels.includes(product.model) && (
                  <span style={{ fontSize: 10, background: 'var(--amber)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 900 }}>NEW MODEL</span>
                )}
              </div>
              <input 
                type="text" 
                className="form-control" 
                list="brand-models-list"
                style={{ fontSize: 20, padding: 20 }} 
                placeholder="Select or Type Model..." 
                value={product.model} 
                onChange={e => setProduct(p => ({ ...p, model: e.target.value }))} 
              />
              <datalist id="brand-models-list">
                {brandModels.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>

            <div className="form-grid mb-8">
              <div className="form-group">
                <label className="form-label">Godown</label>
                <select className="form-control" value={godown} onChange={e => setGodown(e.target.value)}>
                  {settings.godowns.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={batchDate} onChange={e => setBatchDate(e.target.value)} />
              </div>
            </div>

            <details className="mb-8">
              <summary style={{ cursor: 'pointer', color: 'var(--blue)', fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>+ More Details (Category/HSN)</summary>
              <div className="form-grid mt-4">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-control" value={product.category} onChange={e => setProduct(p => ({ ...p, category: e.target.value }))}>
                    <option value="">Select Category</option>
                    <option value="AC">Air Conditioner</option>
                    <option value="REF">Refrigerator</option>
                    <option value="WM">Washing Machine</option>
                    <option value="TV">Television</option>
                    <option value="COOLER">Air Cooler</option>
                    <option value="OTHER">Other Appliance</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">HSN Code</label>
                  <input type="text" className="form-control" placeholder="e.g. 8415" value={product.hsnCode} onChange={e => setProduct(p => ({ ...p, hsnCode: e.target.value }))} />
                </div>
              </div>
            </details>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => { if(!product.brand || !product.model) return; setStep(2); }}>Next: Scan Serials →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="dashboard-grid">
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, background: 'var(--blue-light)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 4 }}>
                  {BRANDS.find(b => b.name === product.brand)?.image ? (
                    <img src={BRANDS.find(b => b.name === product.brand)?.image} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ fontSize: 24 }}>{BRANDS.find(b => b.name === product.brand)?.icon || '📦'}</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.brand} - {product.model}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--blue)', lineHeight: 1 }}>{serialNos.length} <span style={{ fontSize: 12, opacity: 0.6 }}>PCS</span></div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)} style={{ padding: '8px 12px' }}>Edit</button>
              </div>
              <BarcodeScanner onScan={handleSerialScan} label="Snap Scan Active" />
              <div className="mt-6">
                <label className="form-label">Manual Entry</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" className="form-control" placeholder="Type serial..." value={manualSerial} 
                    onChange={e => setManualSerial(e.target.value)} onKeyDown={e => e.key === 'Enter' && (handleSerialScan(manualSerial), setManualSerial(''))} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title mb-4">Recently Scanned ({serialNos.length})</div>
              <div className="scan-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
                {serialNos.length === 0 && <div style={{ color: 'var(--text3)', fontWeight: 600 }}>No serials yet. Start scanning...</div>}
                {[...serialNos].reverse().map((s, i) => (
                  <div key={i} className="scan-chip" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span>{s}</span>
                    <button 
                      onClick={() => removeSerial(s)}
                      style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}
                      aria-label="Remove"
                    >×</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-success btn-lg w-full mt-6" onClick={handleSave}>✅ Complete & Save Inventory</button>
              <button className="btn btn-secondary w-full mt-3" onClick={() => setStep(1)}>Back to Details</button>
            </div>
          </div>
        )}
      </div>
      <Toast toasts={toasts} />
    </div>
  );
}
