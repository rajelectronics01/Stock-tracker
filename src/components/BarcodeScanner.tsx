'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
// Import only types at the top level to prevent SSR crashes
import type { Html5Qrcode } from 'html5-qrcode';

interface Props {
  onScan: (value: string) => void;
  paused?: boolean;
  label?: string;
  debounceMs?: number;
}

export default function BarcodeScanner({
  onScan,
  paused = false,
  label = 'Align Barcode in the frame',
  debounceMs = 800,
}: Props) {
  const [errorConfiguring, setErrorConfiguring] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasZoom, setHasZoom] = useState(false);
  const [lastScannedValue, setLastScannedValue] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedTS = useRef<{ value: string; ts: number } | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      const last = lastScannedTS.current;

      if (decodedText.length < 4) return;

      if (last && last.value === decodedText && now - last.ts < (debounceMs / 2)) {
        return; 
      }

      lastScannedTS.current = { value: decodedText, ts: now };
      setLastScannedValue(decodedText);
      
      setTimeout(() => setLastScannedValue(null), 600);

      if (!paused) {
        onScan(decodedText);
      }
    },
    [onScan, paused, debounceMs]
  );

  useEffect(() => {
    // SSR Protection
    if (typeof window === 'undefined') return;

    let scanner: any = null;
    
    const startScanner = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        
        scanner = new Html5Qrcode('reader', {
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
        scannerRef.current = scanner;

        // Instant Audio Feedback for 'Powerful' feel
        const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2215/2215-preview.mp3');
        beep.volume = 0.5;

        await scanner.start(
          { 
            facingMode: 'environment',
            width: { min: 1280, ideal: 1920 }, // Max resolution for fine-line detection
            height: { min: 720, ideal: 1080 }
          },
          {
            fps: 10, // Lower processing FPS allows the CPU to process dense 1D barcodes properly without choking
            // Removed qrbox constraint: By scanning the ENTIRE view, long barcodes like Lloyd/Sansui 
            // no longer get cut off at the edges, meaning users don't have to zoom out perfectly.
            disableFlip: false, // Help with any inverted orientations
            formatsToSupport: [ 
              Html5QrcodeSupportedFormats.CODE_128, 
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.CODE_93,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.DATA_MATRIX,
              Html5QrcodeSupportedFormats.PDF_417
            ],
            aspectRatio: 1.777778,
          },
          (decodedText: string) => {
            if (decodedText.length >= 6) { // Lowered slightly in case some serials are 6-7 char
              beep.play().catch(() => {}); // Instant beep
              handleScanSuccess(decodedText);
            }
          },
          () => {} // Background processing
        );

        // Bind tracks for torch and zoom
        const stream = (scanner as any)._localMediaStream as MediaStream;
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0];
          videoTrackRef.current = videoTrack;
          if (videoTrack) {
            const caps = videoTrack.getCapabilities() as any;
            setHasTorch(!!caps?.torch);
            setHasZoom(!!caps?.zoom);
          }
        }
      } catch (err: any) {
        setErrorConfiguring(err.message || 'Camera blocked');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [handleScanSuccess]);

  // Handle Torch Toggle
  useEffect(() => {
    const track = videoTrackRef.current;
    if (track && hasTorch) {
      track.applyConstraints({ advanced: [{ torch: torchOn } as any] }).catch(() => {});
    }
  }, [torchOn, hasTorch]);

  // Handle Zoom Toggle
  useEffect(() => {
    const track = videoTrackRef.current;
    if (track && hasZoom) {
      track.applyConstraints({ advanced: [{ zoom: zoomLevel } as any] }).catch(() => {});
    }
  }, [zoomLevel, hasZoom]);

  if (errorConfiguring) {
    return (
      <div style={{ padding: 20, textAlign: 'center', background: '#ffebee', color: '#c62828', borderRadius: 12 }}>
        <p style={{ fontWeight: 'bold' }}>Camera Error</p>
        <p style={{ fontSize: 13, marginBottom: 12 }}>{errorConfiguring}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Page</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', background: '#000', borderRadius: 14, overflow: 'hidden' }}>
      {/* Dual-Engine Mount with Contrast Boost */}
      <div id="reader" style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover', 
        filter: 'contrast(1.25) brightness(1.1) saturate(1.1)' 
      }}></div>
      <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: 2, background: 'red', boxShadow: '0 0 10px red', zIndex: 10, opacity: 0.6 }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', height: '45%', border: '2px solid var(--blue)', borderRadius: 10, boxShadow: '0 0 0 999px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 20 }}>
        {hasTorch && (
          <button className="btn btn-icon" onClick={(e) => { e.preventDefault(); setTorchOn(!torchOn); }} style={{ width: 40, height: 40, borderRadius: '50%', background: torchOn ? 'var(--blue)' : 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {torchOn ? '🔦' : '🕯️'}
          </button>
        )}
        {hasZoom && (
          <button className="btn btn-icon" onClick={(e) => { e.preventDefault(); setZoomLevel(prev => prev >= 3 ? 1 : prev + 1); }} style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          {zoomLevel}x
          </button>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', padding: '6px 14px', borderRadius: 20, color: '#fff', fontSize: 13, fontWeight: 700 }}>
          {paused ? '⏸️ Paused' : lastScannedValue ? `✨ Scanned: ${lastScannedValue}` : `🟢 ${label}`}
        </div>
      </div>
    </div>
  );
}
