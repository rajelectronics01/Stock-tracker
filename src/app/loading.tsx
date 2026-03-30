export default function Loading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw', background: '#f8fafc', gap: 20
    }}>
      <div style={{
        width: 60, height: 60, border: '5px solid var(--border)', borderTopColor: 'var(--blue)',
        borderRadius: '50%', animation: 'spin 1s linear infinite'
      }} />
      <div style={{ color: 'var(--blue)', fontWeight: 600, fontSize: 16 }}>
        Loading Raj Electronics Stock Tracker...
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 13 }}>
        Initial load on mobile may take 15-30 seconds.
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
