'use client';

import { useEffect, useState } from 'react';
import { getInventory, getActivityLogs } from '@/lib/store';
import type { ActivityLog } from '@/lib/types';

export default function Dashboard() {
  const [stats, setStats] = useState({ inStock: 0, sold: 0, dispatched: 0, inwardThisMonth: 0, totalUnits: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [brandBreakdown, setBrandBreakdown] = useState<{ brand: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const inventory = await getInventory();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const inStock = inventory.filter(i => i.status === 'IN STOCK').length;
      const sold = inventory.filter(i => i.status === 'SOLD').length;
      const dispatched = inventory.filter(i => i.status === 'DISPATCHED').length;
      const inwardThisMonth = inventory.filter(i => i.dateIn >= monthStart.slice(0, 10)).length;

      setStats({ inStock, sold, dispatched, inwardThisMonth, totalUnits: inventory.length });

      const brandMap: Record<string, number> = {};
      const inStockItems = inventory.filter(i => i.status === 'IN STOCK');
      for (const item of inStockItems) { brandMap[item.brand] = (brandMap[item.brand] || 0) + 1; }
      const bbs = Object.entries(brandMap).map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count).slice(0, 6);
      setBrandBreakdown(bbs);

      const logs = await getActivityLogs();
      setRecentActivity(logs.slice(0, 8));
    })();
  }, []);

  const statCards = [
    { label: 'In Stock', value: stats.inStock, icon: '📦', color: '#10b981', bg: '#f0fdf4' },
    { label: 'Sold', value: stats.sold, icon: '✅', color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Dispatched', value: stats.dispatched, icon: '🚚', color: '#f59e0b', bg: '#fffbeb' },
    { label: 'This Month', value: stats.inwardThisMonth, icon: '📥', color: '#8b5cf6', bg: '#f5f3ff' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">Warehouse Dashboard</div>
          <div className="page-header-sub">Overview of your inventory and activities</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
        </div>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          {statCards.map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value">{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <div className="card-title mb-6">📊 Inventory by Brand</div>
            {brandBreakdown.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', opacity: 0.5 }}>No stock yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {brandBreakdown.map(b => (
                  <div key={b.brand}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>{b.brand}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--blue)' }}>{b.count}</span>
                    </div>
                    <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${(b.count / stats.inStock) * 100}%`, height: '100%', background: 'var(--blue)', borderRadius: 5 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title mb-6">🕐 Recent Activity Log</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentActivity.map(log => (
                <div key={log.id} style={{ display: 'flex', gap: 14, paddingBottom: 12, borderBottom: '2px solid var(--border)' }}>
                  <div style={{ fontSize: 18 }}>{log.action === 'INWARD' ? '📥' : '📤'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{log.staffName} performed {log.action}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{new Date(log.timestamp).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', opacity: 0.5 }}>No activity recorded.</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
