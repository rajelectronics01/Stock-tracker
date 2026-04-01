'use client';

import { useState, useEffect } from 'react';
import { getActivityLogs } from '@/lib/store';
import type { ActivityLog } from '@/lib/types';

const ACTION_COLORS: Record<string, string> = {
  INWARD: 'badge-green',
  OUTWARD: 'badge-blue',
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    getActivityLogs().then(allLogs => {
      // Filter out system events, keeping only Inward and Outward actions
      const staffActions = allLogs.filter(l => l.action === 'INWARD' || l.action === 'OUTWARD');
      setLogs(staffActions);
    });
  }, []);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      l.staffName.toLowerCase().includes(q) ||
      l.staffId.toLowerCase().includes(q) ||
      (l.notes || '').toLowerCase().includes(q);
    const matchAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">🔍 Activity Log</div>
          <div className="page-header-sub">Full audit trail of all staff actions</div>
        </div>
      </div>

      <div className="page-body">
        <div className="card mb-4">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input type="text" className="form-control" placeholder="🔍 Search by staff name, ID, or notes…"
              value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <select className="form-control" style={{ width: 'auto' }} value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}>
              <option value="ALL">All Actions</option>
              <option value="INWARD">Inward</option>
              <option value="OUTWARD">Outward</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Employee</th>
                <th>Action</th>
                <th>Batch Size</th>
                <th>Godown</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  {logs.length === 0 ? 'No activity logged yet.' : 'No results match your filter.'}
                </td></tr>
              ) : (
                filtered.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--blue)' }}>{log.staffId}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{log.staffName}</div>
                    </td>
                    <td><span className={`badge ${ACTION_COLORS[log.action] || 'badge-blue'}`}>{log.action}</span></td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{log.batchSize ?? '—'}</td>
                    <td>{log.godown || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{log.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
