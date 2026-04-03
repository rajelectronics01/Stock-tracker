'use client';
import { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { bulkExcelImport, addActivityLog } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';

export default function ExcelUpload({ onComplete }: { onComplete: (msg: string) => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = xlsx.utils.sheet_to_json(firstSheet);

      const items = rows.map(r => ({
        serialNo: (r['Serial'] || r['serial'] || r['Serial No'] || r['Serial Number'] || '').toString().trim(),
        brand: (r['Brand'] || r['brand'] || '').toString().trim(),
        model: (r['Model'] || r['model'] || '').toString().trim(),
        godown: (r['Godown'] || r['godown'] || '').toString().trim(),
      })).filter(i => i.serialNo && i.brand && i.model);

      if (items.length === 0) {
        throw new Error('Valid rows not found. Make sure columns are named "Serial", "Brand", and "Model".');
      }

      const { added, skipped } = await bulkExcelImport(items, user?.id || '');
      
      await addActivityLog({
        action: 'INWARD',
        staffId: user?.id || '',
        staffName: user?.name || '',
        godown: 'Excel Import',
        batchSize: added,
        notes: `Excel Upload: Added ${added}, Skipped ${skipped}`,
      });

      onComplete(`Excel Uploaded: ✅ ${added} items added, ⚠️ ${skipped} duplicate serials skipped.`);

    } catch (e: any) {
      alert('Error parsing Excel: ' + e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ marginLeft: 'auto' }}>
      <input type="file" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
      <button 
        style={{ background: '#107c41', color: '#fff', fontWeight: 700, padding: '10px 18px', borderRadius: 10, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(16,124,65,0.3)' }} 
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? '⏳ Importing...' : '📗 Excel Bulk Import'}
      </button>
    </div>
  );
}
