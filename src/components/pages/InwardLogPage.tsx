'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { getInwardBatches } from '@/lib/store';
import type { InwardBatch } from '@/lib/types';

export default function InwardLogPage() {
  const [batches, setBatches] = useState<InwardBatch[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { getInwardBatches().then(setBatches); }, []);

  const filtered = batches.filter(b => {
    const q = search.toLowerCase();
    return !q ||
      b.brand.toLowerCase().includes(q) ||
      b.staffName.toLowerCase().includes(q) ||
      b.godown.toLowerCase().includes(q) ||
      (b.supplier || '').toLowerCase().includes(q) ||
      b.date.includes(q);
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">📋 Inward Log</div>
          <div className="page-header-sub">Full history of all stock received — click a row to see serials</div>
        </div>
      </div>

      <div className="page-body">
        <div className="card mb-4">
          <input type="text" className="form-control"
            placeholder="🔍 Search by brand, godown, supplier, staff, or date…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Category</th>
                <th>Godown</th>
                <th>Supplier</th>
                <th>Staff</th>
                <th>Units</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  {batches.length === 0 ? 'No inward entries yet.' : 'No results.'}
                </td></tr>
              ) : (
                filtered.map(b => (
                  <React.Fragment key={b.id}>
                    <tr
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{b.date}</td>
                      <td style={{ fontWeight: 800, color: 'var(--blue)' }}>{b.brand}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 }}>{b.model}</td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{b.category}</td>
                      <td style={{ fontSize: 12, fontWeight: 700 }}>{b.godown}</td>
                      <td>{b.supplier || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text3)' }}>{b.staffName}</td>
                      <td><div className="badge badge-green" style={{ fontWeight: 900, padding: '4px 12px' }}>{b.serialNos.length}</div></td>
                    </tr>
                    {expanded === b.id && (
                      <tr key={`${b.id}-exp`}>
                        <td colSpan={8} style={{ background: 'var(--bg)', padding: '24px', borderLeft: '4px solid var(--blue)' }}>
                          <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12, letterSpacing: '0.05em' }}>
                            Batch Serials ({b.serialNos.length})
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {b.serialNos.map(s => (
                              <div key={s} className="scan-chip" style={{ fontSize: 12, padding: '6px 12px' }}>{s}</div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
