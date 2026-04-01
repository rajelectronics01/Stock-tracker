'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('./pages/Dashboard'), { ssr: false });
const InwardPage = dynamic(() => import('./pages/InwardPage'), { ssr: false });
const OutwardPage = dynamic(() => import('./pages/OutwardPage'), { ssr: false });
const InventoryPage = dynamic(() => import('./pages/InventoryPage'), { ssr: false });
const StaffPage = dynamic(() => import('./pages/StaffPage'), { ssr: false });
const ActivityPage = dynamic(() => import('./pages/ActivityPage'), { ssr: false });
const OutwardLogPage = dynamic(() => import('./pages/OutwardLogPage'), { ssr: false });
const InwardLogPage = dynamic(() => import('./pages/InwardLogPage'), { ssr: false });
const SettingsPage = dynamic(() => import('./pages/SettingsPage'), { ssr: false });

type AdminPage = 'dashboard' | 'inward' | 'outward' | 'inventory' | 'staff' |
  'activity' | 'outward-log' | 'inward-log' | 'settings';
type EmployeePage = 'inward' | 'outward';

const ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'inward', label: 'Inward Stock', icon: '📥' },
  { id: 'outward', label: 'Outward Dispatch', icon: '📤' },
  { id: 'inward-log', label: 'Inward Log', icon: '📋' },
  { id: 'outward-log', label: 'Outward Log', icon: '🧾' },
  { id: 'staff', label: 'Users & Passwords', icon: '👥' },
  { id: 'activity', label: 'Activity Log', icon: '🔍' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const EMPLOYEE_NAV = [
  { id: 'inward', label: 'Inward Stock', icon: '📥' },
  { id: 'outward', label: 'Outward Dispatch', icon: '📤' },
];

export default function AppShell() {
  const { user, logout, isAdmin } = useAuth();
  const [page, setPage] = useState<string>(isAdmin ? 'dashboard' : 'inward');

  const nav = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':   return <Dashboard />;
      case 'inward':      return <InwardPage />;
      case 'outward':     return <OutwardPage setPage={setPage} />;
      case 'inventory':   return <InventoryPage />;
      case 'staff':       return <StaffPage />;
      case 'activity':    return <ActivityPage />;
      case 'outward-log': return <OutwardLogPage />;
      case 'inward-log':  return <InwardLogPage />;
      case 'settings':    return <SettingsPage />;
      default:            return <InwardPage />;
    }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="app-shell">
      {/* SIDEBAR (Desktop) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{
            width: 32, height: 32, borderRadius: 6, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div className="sidebar-logo-text">
            <div className="sidebar-logo-name">Raj Electronics</div>
            <div className="sidebar-logo-sub">Stock Tracker</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-link ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className={`sidebar-avatar ${isAdmin ? 'avatar-admin' : 'avatar-employee'}`}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div className="sidebar-user-role">{user?.id}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout} id="btn-logout" style={{ marginTop: 10 }}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        {renderPage()}
      </main>

      {/* MOBILE NAV (Bottom Bar) */}
      <div className="mobile-nav">
        <button
          className={`mobile-nav-item ${page === 'dashboard' ? 'active' : ''}`}
          onClick={() => setPage('dashboard')}
          style={{ display: isAdmin ? 'flex' : 'none' }}
        >
          <span className="mobile-nav-icon">📊</span>
          Home
        </button>
        <button
          className={`mobile-nav-item ${page === (isAdmin ? 'inventory' : 'inward') ? 'active' : ''}`}
          onClick={() => setPage(isAdmin ? 'inventory' : 'inward')}
        >
          <span className="mobile-nav-icon">{isAdmin ? '📦' : '📥'}</span>
          {isAdmin ? 'Stock' : 'Scan'}
        </button>
        <button
          className={`mobile-nav-item ${page === (isAdmin ? 'inward' : 'outward') ? 'active' : ''}`}
          onClick={() => setPage(isAdmin ? 'inward' : 'outward')}
        >
          <span className="mobile-nav-icon">{isAdmin ? '📥' : '📤'}</span>
          {isAdmin ? 'Inward' : 'Outward'}
        </button>
        {isAdmin && (
          <>
            <button
              className={`mobile-nav-item ${page === 'outward' ? 'active' : ''}`}
              onClick={() => setPage('outward')}
            >
              <span className="mobile-nav-icon">📤</span>
              Outward
            </button>
            <button
              className={`mobile-nav-item ${page === 'staff' ? 'active' : ''}`}
              onClick={() => setPage('staff')}
            >
              <span className="mobile-nav-icon">👥</span>
              Users
            </button>
            <button
              className={`mobile-nav-item ${page === 'settings' ? 'active' : ''}`}
              onClick={() => setPage('settings')}
            >
              <span className="mobile-nav-icon">⚙️</span>
              Settings
            </button>
          </>
        )}
        <button className="mobile-nav-item" onClick={logout}>
          <span className="mobile-nav-icon">🚪</span>
          Exit
        </button>
      </div>
    </div>
  );
}
