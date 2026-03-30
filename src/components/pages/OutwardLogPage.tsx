'use client';

import { useState, useEffect } from 'react';
import { getOutwardBatches, getSettings } from '@/lib/store';
import type { OutwardBatch } from '@/lib/types';
import ChallanModal from '../ChallanModal';

export default function OutwardLogPage() {
  const [batches, setBatches] = useState<OutwardBatch[]>([]);
  const [search, setSearch] = useState('');
  const [reprinting, setReprinting] = useState<OutwardBatch | null>(null);
  const settings = getSettings();

  useEffect(() => { getOutwardBatches().then(setBatches); }, []);

  const filtered = batches.filter(b => {
    const q = search.toLowerCase();
    return !q ||
      b.challanNo.toLowerCase().includes(q) ||
      b.buyerName.toLowerCase().includes(q) ||
      b.handedBy.toLowerCase().includes(q) ||
      b.date.includes(q);
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">🧾 Outward Log</div>
          <div className="page-header-sub">Full history of all dispatches — click to reprint challan</div>
        </div>
      </div>

      <div className="page-body">
        <div className="card mb-4">
          <input type="text" className="form-control"
            placeholder="🔍 Search by challan no, buyer, staff, or date…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Challan No</th>
                <th>Date</th>
                <th>Buyer</th>
                <th>Units</th>
                <th>Sale Type</th>
                <th>Handed By</th>
                <th>GST Rate</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  {batches.length === 0 ? 'No dispatches yet.' : 'No results.'}
                </td></tr>
              ) : (
                filtered.map(b => (
                  <tr key={b.id}>
                    <td className="td-strong" style={{ fontSize: 16 }}>{b.challanNo}</td>
                    <td style={{ fontSize: 13, fontWeight: 700 }}>{b.date}</td>
                    <td>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{b.buyerName}</div>
                      {b.buyerGstin && <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{b.buyerGstin}</div>}
                    </td>
                    <td><div className="badge badge-blue" style={{ fontWeight: 900, padding: '4px 12px' }}>{b.serialNos.length}</div></td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{b.saleType}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{b.handedBy}</td>
                    <td style={{ fontWeight: 800 }}>{b.gstRate}%</td>
                    <td>
                      <button className="btn btn-sm btn-primary" style={{ padding: '6px 16px' }} onClick={() => setReprinting(b)}>
                        🖨️ Reprint
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reprinting && (
        <ChallanModal
          batch={reprinting}
          settings={settings}
          onClose={() => setReprinting(null)}
        />
      )}
    </>
  );
}
