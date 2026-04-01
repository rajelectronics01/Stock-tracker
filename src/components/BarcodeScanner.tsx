'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [errorCode, setErrorCode]     = useState<string | null>(null);
  const [debugText, setDebugText]     = useState<string>('');
  const [hasTorch, setHasTorch]       = useState(false);
  const [torchOn, setTorchOn]         = useState(false);
  const [zoomLevel, setZoomLevel]     = useState(1);
  const [hasZoom, setHasZoom]         = useState(false);
  const [lastScan, setLastScan]       = useState<string | null>(null);
  const [retryCount, setRetryCount]   = useState(0);

  const scannerRef    = useRef<Html5Qrcode | null>(null);
  const lastScanTS    = useRef<{ value: string; ts: number } | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const stoppedRef    = useRef(false); // tracks whether cleanup already ran

  const handleScanSuccess = useCallback((decodedText: string) => {
    if (decodedText.length < 4) return;
    const now  = Date.now();
    const last = lastScanTS.current;
    if (last && last.value === decodedText && now - last.ts < debounceMs / 2) return;
    lastScanTS.current = { value: decodedText, ts: now };
    setLastScan(decodedText);
    setTimeout(() => setLastScan(null), 600);
    if (!paused) onScan(decodedText);
  }, [onScan, paused, debounceMs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // No camera API at all (rare — usually means non-HTTPS)
    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorCode('NO_API');
      setDebugText('navigator.mediaDevices unavailable — must be HTTPS');
      return;
    }

    stoppedRef.current = false;
    let scanner: any   = null;

    const start = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        // ✅ Enable native BarcodeDetector on Android — it's vastly better at
        // reading Code 128 alphanumeric barcodes (like serial numbers).
        // ❌ Keep it OFF on iOS — iOS BarcodeDetector crashes on certain formats.
        scanner = new Html5Qrcode('reader', {
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: !isIOS },
        });
        scannerRef.current = scanner;

        const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2215/2215-preview.mp3');
        beep.volume = 0.4;

        const config = {
          fps: 15,           // Higher FPS = more decode attempts per second
          disableFlip: false,
          aspectRatio: 2.5,  // Wider ratio so long Code 128 barcodes fit in frame
          formatsToSupport: isIOS
            ? [
                // iOS: only formats that don't crash native BarcodeDetector
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.ITF,
                Html5QrcodeSupportedFormats.QR_CODE,
              ]
            : [
                // Android: full format support via native BarcodeDetector
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
                Html5QrcodeSupportedFormats.PDF_417,
              ],
        };

        const onSuccess = (text: string) => {
          if (text.length >= 6) {
            beep.play().catch(() => {});
            handleScanSuccess(text);
          }
        };

        // On iOS: pass ONLY facingMode — no width/height constraints,
        // which cause OverconstrainedError on many iPhone models
        // On Android: progressive fallback from HD → bare-minimum
        const cameraConstraints = isIOS
          ? [
              { facingMode: { exact: 'environment' } },
              { facingMode: 'environment' },
              {},
            ]
          : [
              { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
              { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
              { facingMode: 'environment', width: { ideal: 640 },  height: { ideal: 480 } },
              { facingMode: 'environment' },
              {},
            ];

        let started = false;
        let lastErr: any = null;

        for (const constraints of cameraConstraints) {
          if (stoppedRef.current) return; // component unmounted mid-loop
          try {
            await scanner.start(constraints, config, onSuccess, () => {});
            started = true;
            break;
          } catch (err: any) {
            lastErr = err;
            // Permission denied → no point trying other resolutions
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') break;
            // Camera busy/hardware error → don't keep trying
            if (err?.name === 'NotReadableError' || err?.name === 'AbortError') break;
          }
        }

        if (!started) throw lastErr ?? new Error('Camera failed to start');

        // Torch / zoom — iOS Safari doesn't support getCapabilities()
        // so wrap in try/catch and check the method exists first
        try {
          const mediaStream = (scanner as any)._localMediaStream as MediaStream | undefined;
          if (mediaStream) {
            const track = mediaStream.getVideoTracks()[0];
            videoTrackRef.current = track ?? null;
            if (track && typeof track.getCapabilities === 'function') {
              const caps = track.getCapabilities() as any;
              setHasTorch(!!caps?.torch);
              setHasZoom(!!caps?.zoom);
            }
          }
        } catch {
          // Silently skip — torch/zoom just won't appear
        }

        // All good
        setErrorCode(null);
        setDebugText('');

      } catch (err: any) {
        const name = (err?.name  ?? '') as string;
        const msg  = (err?.message ?? '') as string;

        let code = 'UNKNOWN';

        if (
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied')
        ) {
          code = 'PERMISSION_DENIED';
        } else if (
          name === 'NotFoundError' ||
          name === 'DevicesNotFoundError' ||
          msg.toLowerCase().includes('not found')
        ) {
          code = 'NO_CAMERA';
        } else if (
          name === 'NotReadableError' ||
          msg.toLowerCase().includes('not readable') ||
          msg.toLowerCase().includes('in use') ||
          msg.toLowerCase().includes('hardware')
        ) {
          code = 'BUSY';
        }

        setErrorCode(code);
        setDebugText(`[${name || 'Error'}] ${msg}`);
      }
    };

    start();

    return () => {
      stoppedRef.current = true;
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }
    };
  }, [handleScanSuccess, retryCount]);

  // Torch
  useEffect(() => {
    const t = videoTrackRef.current;
    if (t && hasTorch) t.applyConstraints({ advanced: [{ torch: torchOn } as any] }).catch(() => {});
  }, [torchOn, hasTorch]);

  // Zoom
  useEffect(() => {
    const t = videoTrackRef.current;
    if (t && hasZoom) t.applyConstraints({ advanced: [{ zoom: zoomLevel } as any] }).catch(() => {});
  }, [zoomLevel, hasZoom]);

  // ─── Error Screen ───────────────────────────────────────────────────────────
  if (errorCode) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const screens: Record<string, { icon: string; title: string; sub: string; steps: React.ReactNode }> = {
      PERMISSION_DENIED: {
        icon: '🚫', title: 'Camera Access Blocked',
        sub: 'The browser was denied camera access.',
        steps: isIOS ? (
          <>
            <b>iPhone / iPad (Safari):</b><br/>
            1. Go to <b>Settings → Safari → Camera</b><br/>
            2. Set to <b>Allow</b><br/>
            3. Come back and tap <b>Retry</b>
          </>
        ) : (
          <>
            <b>Android / Chrome:</b><br/>
            1. Tap the 🔒 icon in the address bar<br/>
            2. Set <b>Camera → Allow</b><br/>
            3. Tap <b>Retry</b>
          </>
        ),
      },
      NO_CAMERA: {
        icon: '🔍', title: 'No Camera Found',
        sub: 'Your device has no usable rear camera.',
        steps: <>1. Close apps using the camera<br/>2. Restart your browser<br/>3. Retry</>,
      },
      BUSY: {
        icon: '⚙️', title: 'Camera In Use',
        sub: 'Another app or tab is using the camera.',
        steps: <>1. Close other browser tabs<br/>2. Close any app using the camera<br/>3. Tap <b>Retry</b></>,
      },
      NO_API: {
        icon: '🔒', title: 'HTTPS Required',
        sub: 'Camera API only works on secure (https://) pages.',
        steps: <>Make sure the URL starts with <b>https://</b></>,
      },
      UNKNOWN: {
        icon: '📷', title: 'Camera Error',
        sub: 'Could not start the camera.',
        steps: (
          <>
            1. Make sure no other app is using the camera<br/>
            2. Close other browser tabs<br/>
            3. Refresh the page and allow camera access
            {debugText && (
              <span style={{ display: 'block', marginTop: 10, fontSize: 11, color: '#ffb3b3', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                ℹ️ {debugText}
              </span>
            )}
          </>
        ),
      },
    };

    const { icon, title, sub, steps } = screens[errorCode] ?? screens.UNKNOWN;

    return (
      <div style={{ padding: 24, textAlign: 'center', background: 'linear-gradient(135deg,#1a0a0a,#2d0f0f)', color: '#fff', borderRadius: 16, border: '1px solid rgba(220,50,50,0.4)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
        <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>{title}</p>
        <p style={{ fontSize: 13, color: '#ffcdd2', marginBottom: 16, lineHeight: 1.5 }}>{sub}</p>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', textAlign: 'left', fontSize: 13, lineHeight: 1.8, marginBottom: 16, color: '#fff' }}>
          {steps}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setErrorCode(null); setDebugText(''); setRetryCount(c => c + 1); }}
            style={{ padding: '10px 22px', borderRadius: 8, background: 'var(--blue,#2563eb)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            🔄 Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 22px', borderRadius: 8, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            ↺ Reload
          </button>
        </div>
      </div>
    );
  }

  // ─── Scanner UI ─────────────────────────────────────────────────────────────
  return (
    // aspectRatio 5/2 = 2.5 — wide enough to fit long Code 128 serial barcodes
    <div style={{ position: 'relative', width: '100%', aspectRatio: '5/2', background: '#000', borderRadius: 14, overflow: 'hidden' }}>
      <div id="reader" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.3) brightness(1.15) saturate(1.1)' }} />
      {/* Scan line spans the inner width of the target box */}
      <div style={{ position: 'absolute', top: '50%', left: '5%', right: '5%', height: 2, background: 'red', boxShadow: '0 0 10px red', zIndex: 10, opacity: 0.7 }} />
      {/* Target box: 90% wide, 60% tall — fits wide barcodes */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', height: '60%', border: '2px solid var(--blue,#2563eb)', borderRadius: 8, boxShadow: '0 0 0 999px rgba(0,0,0,0.45)', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 20 }}>
        {hasTorch && (
          <button onClick={() => setTorchOn(v => !v)} style={{ width: 40, height: 40, borderRadius: '50%', background: torchOn ? 'var(--blue)' : 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {torchOn ? '🔦' : '🕯️'}
          </button>
        )}
        {hasZoom && (
          <button onClick={() => setZoomLevel(v => v >= 3 ? 1 : v + 1)} style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {zoomLevel}x
          </button>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', padding: '6px 14px', borderRadius: 20, color: '#fff', fontSize: 13, fontWeight: 700 }}>
          {paused ? '⏸️ Paused' : lastScan ? `✨ Scanned: ${lastScan}` : `🟢 ${label}`}
        </div>
      </div>
    </div>
  );
}
