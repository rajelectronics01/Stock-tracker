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
  const [retryCount, setRetryCount] = useState(0);

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
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        });
        scannerRef.current = scanner;

        const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2215/2215-preview.mp3');
        beep.volume = 0.5;

        // Progressive fallback: dropping 'min' constraints so even mid-range Android phones
        // don't throw OverconstrainedError — try best quality first, step down gracefully.
        const resolutionFallbacks = [
          { width: { ideal: 1920 }, height: { ideal: 1080 } },
          { width: { ideal: 1280 }, height: { ideal: 720 } },
          { width: { ideal: 640 },  height: { ideal: 480 } },
          {}, // bare-minimum: let browser pick anything
        ];

        const scanConfig = {
          fps: 10,
          disableFlip: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,  Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,    Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,    Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,  Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.PDF_417,
          ],
          aspectRatio: 1.777778,
        };

        const onScanSuccess = (decodedText: string) => {
          if (decodedText.length >= 6) {
            beep.play().catch(() => {});
            handleScanSuccess(decodedText);
          }
        };

        let started = false;
        let lastErr: any = null;

        for (const res of resolutionFallbacks) {
          try {
            await scanner.start(
              { facingMode: 'environment', ...res },
              scanConfig,
              onScanSuccess,
              () => {}
            );
            started = true;
            break;
          } catch (err: any) {
            lastErr = err;
            // Permission denied — no point trying lower resolutions
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') break;
          }
        }

        if (!started) throw lastErr ?? new Error('Camera unavailable');

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
        setErrorConfiguring(null);
      } catch (err: any) {
        const name: string = err?.name ?? '';
        const msg: string  = err?.message ?? '';
        const isPermission =
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied') ||
          msg.toLowerCase().includes('blocked');
        setErrorConfiguring(isPermission ? 'PERMISSION_DENIED' : (msg || 'UNKNOWN'));
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [handleScanSuccess, retryCount]);

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
    const isPermission = errorConfiguring === 'PERMISSION_DENIED';
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    return (
      <div style={{
        padding: 24,
        textAlign: 'center',
        background: 'linear-gradient(135deg,#1a0a0a,#2d0f0f)',
        color: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(220,50,50,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{isPermission ? '🚫' : '📷'}</div>
        <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>
          {isPermission ? 'Camera Access Blocked' : 'Camera Error'}
        </p>
        <p style={{ fontSize: 13, color: '#ffcdd2', marginBottom: 16, lineHeight: 1.5 }}>
          {isPermission
            ? 'The browser was denied camera access. Follow these steps:'
            : 'Could not start the camera. Try the steps below:'}
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '12px 16px',
          textAlign: 'left',
          fontSize: 13,
          lineHeight: 1.8,
          marginBottom: 16,
          color: '#fff',
        }}>
          {isPermission ? (
            isIOS ? (
              <>
                <b>iPhone / iPad:</b><br />
                1. Open <b>Settings → Safari</b><br />
                2. Tap <b>Camera → Allow</b><br />
                3. Come back and tap <b>Retry</b>
              </>
            ) : (
              <>
                <b>Android / Chrome:</b><br />
                1. Tap the 🔒 lock icon in the address bar<br />
                2. Set <b>Camera → Allow</b><br />
                3. Tap <b>Retry</b> below<br />
                <span style={{ color: '#ffb3b3' }}>⚠️ Must be on HTTPS, not http://</span>
              </>
            )
          ) : (
            <>
              1. Make sure no other app is using the camera<br />
              2. Refresh the page<br />
              3. Allow camera when the browser asks
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setErrorConfiguring(null);
              setRetryCount(c => c + 1);
            }}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              background: 'var(--blue, #2563eb)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            🔄 Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ↺ Reload Page
          </button>
        </div>
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
