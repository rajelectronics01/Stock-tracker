'use client';

import { useState, useEffect } from 'react';
import { getUsers, saveUser, deleteUser, simpleHash, syncLocalUsersToCloud } from '@/lib/store';
import type { User } from '@/lib/types';
import Toast from '../Toast';

interface ToastMsg { id: number; type: 'success' | 'error'; message: string }

export default function StaffPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [resetPwdFor, setResetPwdFor] = useState<string | null>(null);
  const [resetPwdVal, setResetPwdVal] = useState('');

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => {
    const initData = async () => {
      // Sync local to cloud once
      try {
        const local = JSON.parse(localStorage.getItem('re_users') || '[]');
        if (local.length > 0) {
          addToast('success', `☁️ Syncing ${local.length} staff accounts to cloud...`);
          await syncLocalUsersToCloud();
          addToast('success', '✅ Staff sync complete. You can now log in on mobile!');
        }
      } catch (e) {
        console.error('Sync failed', e);
      }
      const all = await getUsers();
      setUsers(all);
    };
    initData();
  }, []);
  
  const reload = async () => setUsers(await getUsers());
  
  const addEmployee = async () => {
    const trimmedId = newUserId.trim().toUpperCase();
    if (!newName.trim() || !trimmedId || !newPwd.trim()) {
      addToast('error', 'Username, Name and Password are required.'); return;
    }
    const user: User = {
      id: trimmedId,
      name: newName.trim(),
      role: 'employee',
      passwordHash: simpleHash(newPwd),
      active: true,
      createdAt: new Date().toISOString(),
    };
    await saveUser(user);
    await reload();
    addToast('success', `✅ User ${trimmedId} created successfully.`);
    setNewName(''); setNewUserId(''); setNewPwd(''); setShowAdd(false);
  };

  const toggleActive = async (id: string) => {
    const found = users.find(u => u.id === id);
    if (found) {
      found.active = !found.active;
      await saveUser(found);
      await reload();
      addToast('success', `Account ${found.active ? 'activated' : 'deactivated'}.`);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdVal.trim()) { addToast('error', 'Enter a new password.'); return; }
    const found = users.find(u => u.id === resetPwdFor);
    if (found) {
      found.passwordHash = simpleHash(resetPwdVal);
      await saveUser(found);
      await reload();
      addToast('success', 'Password updated.');
      setResetPwdFor(null); setResetPwdVal('');
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm(`Delete employee ${id}? This cannot be undone.`)) return;
    await deleteUser(id);
    await reload();
    addToast('success', 'Employee deleted.');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">👥 Staff Management</div>
          <div className="page-header-sub">{users.length} employee account{users.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} id="btn-add-employee">
          + Add Employee
        </button>
      </div>

      <div className="page-body">
        {/* Add Employee Form */}
        {showAdd && (
          <div className="card mb-6" style={{ borderColor: 'var(--blue-mid)' }}>
            <div className="card-title mb-4">New Employee Account</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name <span>*</span></label>
                <input type="text" className="form-control" placeholder="e.g. Ravi Kumar"
                  value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Login ID / Username <span>*</span></label>
                <input type="text" className="form-control" placeholder="e.g. RAVI123"
                  value={newUserId} onChange={e => setNewUserId(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Password <span>*</span></label>
                <input type="text" className="form-control" placeholder="Set password"
                  value={newPwd} onChange={e => setNewPwd(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setNewName(''); setNewUserId(''); setNewPwd(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={addEmployee} id="btn-create-employee">Create Account</button>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetPwdFor && (
          <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <div className="modal-title">Reset Password — {resetPwdFor}</div>
                <button className="modal-close" onClick={() => { setResetPwdFor(null); setResetPwdVal(''); }}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input type="text" className="form-control" placeholder="Enter new password"
                    value={resetPwdVal} onChange={e => setResetPwdVal(e.target.value)} autoFocus />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setResetPwdFor(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleResetPassword}>Save Password</button>
              </div>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username/ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  No employees yet. Add one to get started.
                </td></tr>
              ) : (
                  users.map(u => (
                    <tr key={u.id}>
                      <td className="td-strong" style={{ fontSize: 16 }}>{u.id}</td>
                      <td style={{ fontWeight: 800, fontSize: 15 }}>{u.name}</td>
                      <td>
                        <div className={`badge ${u.active ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, fontWeight: 900, padding: '6px 14px', borderRadius: 20 }}>
                          {u.active ? '● ACTIVE' : '○ INACTIVE'}
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-IN') : 'Never'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            className={`btn btn-sm ${u.active ? 'btn-secondary' : 'btn-success'}`}
                            onClick={() => toggleActive(u.id)}
                            style={{ flex: 1, minWidth: 100 }}
                          >
                            {u.active ? '🔒 Deactivate' : '✅ Activate'}
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={() => { setResetPwdFor(u.id); setResetPwdVal(''); }}>
                            🔑 Reset
                          </button>
                          <button className="btn btn-sm btn-icon" onClick={() => deleteEmployee(u.id)} style={{ background: 'var(--red-light)', color: 'var(--red)' }}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Toast toasts={toasts} />
      </>
    );
  }
