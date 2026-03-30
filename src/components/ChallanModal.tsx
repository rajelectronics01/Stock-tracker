'use client';

import type { OutwardBatch, InventoryItem, AppSettings } from '@/lib/types';

interface Props {
  batch: OutwardBatch;
  items?: InventoryItem[];
  settings: AppSettings;
  onClose: () => void;
}

export default function ChallanModal({ batch, items: propItems, settings, onClose }: Props) {
  // Items are always passed from OutwardPage after a fresh scan
  const items = propItems || [];

  const gstRate = batch.gstRate || 0;
  const price = batch.pricePerUnit || 0;
  const qty = items.length;
  const taxableValue = price * qty;
  const cgst = (taxableValue * gstRate) / 200;
  const sgst = cgst;
  const grandTotal = taxableValue + cgst + sgst;

  const printChallan = () => {
    window.print();
  };

  return (
    <>
      {/* Screen overlay */}
      <div className="modal-backdrop">
        <div className="modal modal-lg" style={{ maxHeight: '95vh' }}>
          <div className="modal-header">
            <div className="modal-title">🖨️ Dispatch Challan — {batch.challanNo}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={printChallan} id="btn-print-challan">
                🖨️ Print / Save PDF
              </button>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
          </div>
          <div className="modal-body" style={{ padding: 0 }}>
            <div id="challan-content" style={{ padding: '20px 24px' }}>
              <ChallanContent
                batch={batch}
                items={items}
                settings={settings}
                taxableValue={taxableValue}
                cgst={cgst}
                sgst={sgst}
                grandTotal={grandTotal}
                gstRate={gstRate}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Print-only version */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #challan-print-area { display: block !important; }
        }
      `}</style>
      <div id="challan-print-area" style={{ display: 'none' }}>
        <ChallanContent
          batch={batch}
          items={items}
          settings={settings}
          taxableValue={taxableValue}
          cgst={cgst}
          sgst={sgst}
          grandTotal={grandTotal}
          gstRate={gstRate}
        />
      </div>
    </>
  );
}

function ChallanContent({ batch, items, settings, taxableValue, cgst, sgst, grandTotal, gstRate }: {
  batch: OutwardBatch;
  items: InventoryItem[];
  settings: AppSettings;
  taxableValue: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  gstRate: number;
}) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000',
      background: '#fff', maxWidth: 780, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 6, background: '#fff', border: '1px solid #eee', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/logo.png" alt="Raj Electronics Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--blue)' }}>{settings.companyName}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{settings.companyAddress}</div>
              {settings.companyGstin && (
                <div style={{ fontSize: 11 }}>GSTIN: <strong>{settings.companyGstin}</strong></div>
              )}
              {settings.companyPhone && (
                <div style={{ fontSize: 11 }}>Ph: {settings.companyPhone}</div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 14, fontWeight: 700, background: '#1d4ed8', color: '#fff',
              padding: '4px 12px', borderRadius: 4, marginBottom: 6,
            }}>
              DISPATCH CHALLAN
            </div>
            <div style={{ fontSize: 11 }}>Challan No: <strong>{batch.challanNo}</strong></div>
            <div style={{ fontSize: 11 }}>Date: <strong>{batch.date}</strong></div>
          </div>
        </div>
      </div>

      {/* To / From */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: 4 }}>
            Dispatched To
          </div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{batch.buyerName}</div>
          {batch.buyerAddress && <div style={{ fontSize: 11, color: '#444', marginTop: 3, lineHeight: 1.5 }}>{batch.buyerAddress}</div>}
          {batch.buyerGstin && (
            <div style={{ fontSize: 11, marginTop: 4 }}>GSTIN: <strong>{batch.buyerGstin}</strong></div>
          )}
        </div>
        <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: 4 }}>
            Dispatch Details
          </div>
          <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {batch.saleType && <tr><td style={{ padding: '2px 0', color: '#666', width: 110 }}>Sale Type</td><td><strong>{batch.saleType}</strong></td></tr>}
              {batch.transport && <tr><td style={{ padding: '2px 0', color: '#666' }}>Transport</td><td><strong>{batch.transport}</strong></td></tr>}
              <tr><td style={{ padding: '2px 0', color: '#666' }}>Handed Over By</td><td><strong>{batch.handedBy}</strong></td></tr>
              <tr><td style={{ padding: '2px 0', color: '#666' }}>Total Items</td><td><strong>{items.length}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#1d4ed8', color: '#fff' }}>
            <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600, width: 36 }}>Sr.</th>
            <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600 }}>Serial Number</th>
            <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600 }}>Brand</th>
            <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600 }}>Model No.</th>
            <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600 }}>Category</th>
            <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600 }}>HSN Code</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.serialNo} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fb' }}>
              <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{idx + 1}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb', fontFamily: 'monospace', fontWeight: 600 }}>{item.serialNo}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{item.brand}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{item.model}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{item.category}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{item.hsnCode || '—'}</td>
            </tr>
          ))}
          <tr style={{ background: '#f0f2f5', fontWeight: 700 }}>
            <td colSpan={4} style={{ padding: '6px 8px', border: '1px solid #e5e7eb', textAlign: 'right' }}>Total Items:</td>
            <td colSpan={2} style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{items.length}</td>
          </tr>
        </tbody>
      </table>

      {/* GST Summary */}
      {batch.pricePerUnit && batch.pricePerUnit > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f0f2f5' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 700 }}>GST Summary</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', border: '1px solid #e5e7eb', fontWeight: 700 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: '5px 8px', border: '1px solid #e5e7eb' }}>Taxable Value ({items.length} × ₹{batch.pricePerUnit?.toLocaleString('en-IN')})</td><td style={{ padding: '5px 8px', border: '1px solid #e5e7eb', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(taxableValue)}</td></tr>
            <tr><td style={{ padding: '5px 8px', border: '1px solid #e5e7eb' }}>CGST @ {gstRate / 2}%</td><td style={{ padding: '5px 8px', border: '1px solid #e5e7eb', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cgst)}</td></tr>
            <tr><td style={{ padding: '5px 8px', border: '1px solid #e5e7eb' }}>SGST @ {gstRate / 2}%</td><td style={{ padding: '5px 8px', border: '1px solid #e5e7eb', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(sgst)}</td></tr>
            <tr style={{ background: '#1d4ed8', color: '#fff', fontWeight: 700 }}>
              <td style={{ padding: '7px 8px', border: '1px solid #1d4ed8' }}>Grand Total</td>
              <td style={{ padding: '7px 8px', border: '1px solid #1d4ed8', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Remarks */}
      {batch.remarks && (
        <div style={{ marginBottom: 12, border: '1px solid #e5e7eb', borderRadius: 4, padding: 8 }}>
          <strong style={{ fontSize: 10, color: '#666', textTransform: 'uppercase' }}>Remarks:</strong>
          <div style={{ fontSize: 11, marginTop: 2 }}>{batch.remarks}</div>
        </div>
      )}

      {/* Signature Block */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 10, minHeight: 70 }}>
          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
            Authorised Signatory
          </div>
          <div style={{ fontSize: 11, marginTop: 24, borderTop: '1px solid #aaa', paddingTop: 4 }}>
            {batch.handedBy} — {settings.companyName}
          </div>
        </div>
        <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 10, minHeight: 70 }}>
          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
            Receiver's Stamp & Signature
          </div>
          <div style={{ fontSize: 11, marginTop: 24, borderTop: '1px solid #aaa', paddingTop: 4 }}>
            {batch.buyerName}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid #ddd', textAlign: 'center', fontSize: 10, color: '#888' }}>
        This is a computer-generated dispatch challan and does not require a physical signature. | {settings.companyName}
      </div>
    </div>
  );
}
