'use client';

import { useState, useEffect } from 'react';
import { getSettings, saveSettings, simpleHash } from '@/lib/store';
import type { AppSettings } from '@/lib/types';
import Toast from '../Toast';

interface ToastMsg { id: number; type: 'success' | 'error'; message: string }

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [godownInput, setGodownInput] = useState('');
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [modelBrand, setModelBrand] = useState('Samsung');
  const [modelInput, setModelInput] = useState('');
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => { setSettings(getSettings()); }, []);

  if (!settings) return null;

  const saveCompany = () => {
    saveSettings(settings);
    addToast('success', '✅ Company settings saved.');
  };

  const addGodown = () => {
    const g = godownInput.trim();
    if (!g) return;
    if (settings.godowns.includes(g)) {
      addToast('error', 'Godown already exists.'); return;
    }
    const updated = { ...settings, godowns: [...settings.godowns, g] };
    setSettings(updated);
    saveSettings(updated);
    setGodownInput('');
    addToast('success', `Godown "${g}" added.`);
  };

  const removeGodown = (g: string) => {
    const updated = { ...settings, godowns: settings.godowns.filter(x => x !== g) };
    setSettings(updated);
    saveSettings(updated);
  };

  const changePassword = () => {
    if (simpleHash(oldPwd) !== settings.adminPasswordHash) {
      addToast('error', 'Current password is incorrect.'); return;
    }
    if (newPwd.length < 6) {
      addToast('error', 'New password must be at least 6 characters.'); return;
    }
    const updated = { ...settings, adminPasswordHash: simpleHash(newPwd) };
    setSettings(updated);
    saveSettings(updated);
    setOldPwd(''); setNewPwd('');
    addToast('success', '✅ Admin password changed successfully.');
  };

  const addModel = () => {
    const m = modelInput.trim();
    if (!m) return;
    const s = getSettings();
    if (!s.models) s.models = {};
    if (!s.models[modelBrand]) s.models[modelBrand] = [];
    if (s.models[modelBrand].includes(m)) {
      addToast('error', 'Model already exists for this brand.'); return;
    }
    s.models[modelBrand].push(m);
    saveSettings(s);
    setSettings(s);
    setModelInput('');
    addToast('success', `Model "${m}" added to ${modelBrand}.`);
  };

  const removeModel = (brand: string, model: string) => {
    const s = getSettings();
    if (s.models && s.models[brand]) {
      s.models[brand] = s.models[brand].filter(x => x !== model);
      saveSettings(s);
      setSettings(s);
    }
  };

  const allBrands = ['Lloyd', 'Whirlpool', 'Crompton', 'Orient', 'Samsung', 'Daikin', 'Carrier', 'Blue Star', 'Sansui', 'LG', 'Voltas', 'Mitsubishi', 'O-General', 'Hitachi', 'Godrej', 'Haier', 'TG Smart'];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">⚙️ Settings</div>
          <div className="page-header-sub">Company details, godowns, and account settings</div>
        </div>
      </div>

      <div className="page-body">
        {/* Company Details */}
        <div className="card mb-6">
          <div className="card-title mb-4">🏢 Company Information</div>
          <div className="form-grid mb-4">
            <div className="form-group">
              <label className="form-label">Company Name <span>*</span></label>
              <input type="text" className="form-control" value={settings.companyName}
                onChange={e => setSettings(s => s ? { ...s, companyName: e.target.value } : s)} />
            </div>
            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input type="text" className="form-control" placeholder="e.g. 36AABCR1234A1Z5"
                value={settings.companyGstin}
                onChange={e => setSettings(s => s ? { ...s, companyGstin: e.target.value.toUpperCase() } : s)} />
            </div>
            <div className="form-group form-full">
              <label className="form-label">Company Address</label>
              <textarea className="form-control" value={settings.companyAddress}
                onChange={e => setSettings(s => s ? { ...s, companyAddress: e.target.value } : s)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-control" placeholder="e.g. +91 98765 43210"
                value={settings.companyPhone}
                onChange={e => setSettings(s => s ? { ...s, companyPhone: e.target.value } : s)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={saveCompany} id="btn-save-company">
              💾 Save Company Info
            </button>
          </div>
        </div>

        {/* Godowns */}
        <div className="card mb-6">
          <div className="card-title mb-4">📍 Godown Management</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input type="text" className="form-control" placeholder="Add new godown name"
              value={godownInput}
              onChange={e => setGodownInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGodown(); }}
              style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={addGodown}>+ Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {settings.godowns.map(g => (
              <div key={g} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '4px 14px', fontSize: 13,
              }}>
                📍 {g}
                <button onClick={() => removeGodown(g)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                  fontSize: 14, padding: 0, display: 'flex', alignItems: 'center',
                }}>✕</button>
              </div>
            ))}
            {settings.godowns.length === 0 && (
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>No godowns configured.</span>
            )}
          </div>
        </div>

        {/* Google Sheets */}
        <div className="card mb-6">
          <div className="card-title mb-4">📊 Google Sheets Integration</div>
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: 13, color: 'var(--amber)', marginBottom: 16 }}>
            ⚠️ Google Sheets sync requires a backend service. Set up a Google Service Account and configure below to enable real-time sync.
          </div>
          <div className="form-grid mb-4">
            <div className="form-group">
              <label className="form-label">Google Sheet ID</label>
              <input type="text" className="form-control" placeholder="From the Sheet URL"
                value={settings.sheetsId || ''}
                onChange={e => setSettings(s => s ? { ...s, sheetsId: e.target.value } : s)} />
              <div className="form-hint">The long ID in your Google Sheets URL</div>
            </div>
            <div className="form-group">
              <label className="form-label">API Key / Service Account</label>
              <input type="text" className="form-control" placeholder="Paste API key here"
                value={settings.sheetsApiKey || ''}
                onChange={e => setSettings(s => s ? { ...s, sheetsApiKey: e.target.value } : s)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { saveSettings(settings); addToast('success', 'Sheets config saved.'); }}>
              💾 Save Sheets Config
            </button>
          </div>
        </div>

        {/* Model Management */}
        <div className="card mb-6">
          <div className="card-title mb-4">📖 Product Model Master</div>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
            Add common model numbers here. They will appear as suggestions when scanning inward stock.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select className="form-control" style={{ width: 'auto', minWidth: 140 }} 
              value={modelBrand} onChange={e => setModelBrand(e.target.value)}>
              {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <input type="text" className="form-control" style={{ flex: 1, minWidth: 200 }} 
              placeholder="Enter Model Number..." value={modelInput}
              onChange={e => setModelInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addModel()} />
            <button className="btn btn-primary" onClick={addModel}>+ Add Model</button>
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
            {allBrands.map(brand => {
              const models = (settings.models || {})[brand] || [];
              if (models.length === 0) return null;
              return (
                <div key={brand} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                    {brand} ({models.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {models.map(m => (
                      <div key={m} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {m}
                        <button onClick={() => removeModel(brand, m)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 10 }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Change Admin Password */}
        <div className="card">
          <div className="card-title mb-4">🔐 Change Admin Password</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-control" value={oldPwd}
                onChange={e => setOldPwd(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-control" placeholder="Minimum 6 characters"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={changePassword} id="btn-change-password">
              🔐 Change Password
            </button>
          </div>
        </div>
      </div>

      <Toast toasts={toasts} />
    </>
  );
}
