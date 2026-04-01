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
  const [errorDetail, setErrorDetail] = useState<string>('');
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
    // mediaDevices not available at all (non-HTTPS or very old browser)
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorConfiguring('NO_API');
      setErrorDetail('navigator.mediaDevices is not available. Make sure you are on HTTPS.');
      return;
    }

    let scanner: any = null;
    let preflightStream: MediaStream | null = null;

    const startScanner = async () => {
      try {
        // ─── STEP 1: Pre-flight getUserMedia ───────────────────────────────
        // This is the key fix for iOS Safari. We explicitly ask for permission
        // and get a stream BEFORE html5-qrcode tries. This:
        //  a) triggers the iOS permission dialog correctly
        //  b) surfaces NotAllowedError / NotFoundError cleanly
        //  c) avoids html5-qrcode's opaque internal errors on iOS
        try {
          preflightStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
          // Stop the preflight stream — html5-qrcode will open its own
          preflightStream.getTracks().forEach((t) => t.stop());
          preflightStream = null;
        } catch (preflightErr: any) {
          // Re-classify and throw so it's caught below
          const n = preflightErr?.name ?? '';
          if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
            throw Object.assign(new Error('PERMISSION_DENIED'), { name: 'NotAllowedError' });
          }
          if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
            throw Object.assign(new Error('NO_CAMERA_FOUND'), { name: 'NotFoundError' });
          }
          throw preflightErr;
        }

        // ─── STEP 2: Start html5-qrcode ───────────────────────────────────
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        scanner = new Html5Qrcode('reader', {
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = scanner;

        const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2215/2215-preview.mp3');
        beep.volume = 0.5;

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

        // Progressive resolution fallback — most critical for mid-range Androids
        // On iOS: never pass width/height constraints, let Safari choose
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const resolutionFallbacks = isIOS
          ? [
              { facingMode: { ideal: 'environment' } },              // iOS: no res constraints
            ]
          : [
              { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
              { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
              { facingMode: 'environment', width: { ideal: 640 },  height: { ideal: 480 } },
              { facingMode: 'environment' },                          // bare-minimum
            ];

        let started = false;
        let lastErr: any = null;

        for (const constraints of resolutionFallbacks) {
          try {
            await scanner.start(
              constraints,
              scanConfig,
              onScanSuccess,
              () => {}
            );
            started = true;
            break;
          } catch (err: any) {
            lastErr = err;
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') break;
          }
        }

        if (!started) throw lastErr ?? new Error('Camera unavailable');

        // Torch & Zoom detection
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
        setErrorDetail('');
      } catch (err: any) {
        // Stop any preflight stream if something blew up mid-flight
        preflightStream?.getTracks().forEach((t) => t.stop());

        const name: string = err?.name ?? '';
        const msg: string  = err?.message ?? '';

        const isPermission =
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          msg === 'PERMISSION_DENIED' ||
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied') ||
          msg.toLowerCase().includes('blocked');

        const isNoCamera =
          name === 'NotFoundError' ||
          name === 'DevicesNotFoundError' ||
          msg === 'NO_CAMERA_FOUND';

        const isNoAPI = msg === 'navigator.mediaDevices is not available. Make sure you are on HTTPS.';

        let errorCode = 'UNKNOWN';
        if (isPermission) errorCode = 'PERMISSION_DENIED';
        else if (isNoCamera) errorCode = 'NO_CAMERA';
        else if (isNoAPI) errorCode = 'NO_API';

        // Surface the real error for debugging
        setErrorDetail(`[${name || 'Error'}] ${msg}`);
        setErrorConfiguring(errorCode);
      }
    };

    startScanner();

    return () => {
      preflightStream?.getTracks().forEach((t) => t.stop());
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
    const isNoCamera  = errorConfiguring === 'NO_CAMERA';
    const isNoAPI     = errorConfiguring === 'NO_API';
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

    let icon = '📷';
    let title = 'Camera Error';
    let subtitle = 'Could not start the camera.';
    let steps: React.ReactNode = null;

    if (isPermission) {
      icon = '🚫';
      title = 'Camera Access Blocked';
      subtitle = 'The browser was denied camera access. Follow these steps:';
      steps = isIOS ? (
        <>
          <b>iPhone / iPad:</b><br />
          1. Open <b>Settings → Safari</b><br />
          2. Scroll to <b>Camera → Allow</b><br />
          3. Come back and tap <b>Retry</b>
        </>
      ) : (
        <>
          <b>Android / Chrome:</b><br />
          1. Tap the 🔒 lock icon in the address bar<br />
          2. Set <b>Camera → Allow</b><br />
          3. Tap <b>Retry</b> below
        </>
      );
    } else if (isNoCamera) {
      icon = '🔍';
      title = 'No Camera Found';
      subtitle = 'Your device does not have a usable rear camera.';
      steps = <>1. Make sure no other app has the camera open<br />2. Restart your browser<br />3. Try again</>;
    } else if (isNoAPI) {
      icon = '🔒';
      title = 'HTTPS Required';
      subtitle = 'Camera API is only available on secure (HTTPS) connections.';
      steps = <>Make sure you are opening the app via <b>https://</b> and not http://</>;
    } else {
      // Generic / unknown — show the real error so it's debuggable
      steps = (
        <>
          1. Make sure no other app is using the camera<br />
          2. Close other browser tabs<br />
          3. Refresh the page<br />
          {errorDetail && (
            <span style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#ffb3b3', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              Debug: {errorDetail}
            </span>
          )}
        </>
      );
    }

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
        <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
        <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>{title}</p>
        <p style={{ fontSize: 13, color: '#ffcdd2', marginBottom: 16, lineHeight: 1.5 }}>{subtitle}</p>

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
          {steps}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setErrorConfiguring(null);
              setErrorDetail('');
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
      <div id="reader" style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: 'contrast(1.25) brightness(1.1) saturate(1.1)',
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
