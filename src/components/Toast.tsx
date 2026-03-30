'use client';

interface ToastItem { id: number; type: 'success' | 'error'; message: string }

export default function Toast({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">{t.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
