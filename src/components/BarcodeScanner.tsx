'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  onScan: (value: string) => void;
  paused?: boolean;
  label?: string;
  debounceMs?: number;
}

// ─── Types for native BarcodeDetector ────────────────────────────────────────
declare const BarcodeDetector: any;

export default function BarcodeScanner({
  onScan,
  paused = false,
  label = 'Align barcode in frame',
  debounceMs = 800,
}: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number | null>(null);
  const cooldownRef   = useRef<number>(0); // timestamp until which scanning is paused
  const stoppedRef    = useRef(false);

  const [errorCode, setErrorCode]   = useState<string | null>(null);
  const [debugText, setDebugText]   = useState('');
  const [ready, setReady]           = useState(false);
  const [lastScan, setLastScan]     = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // ─── Scan handler with 2-second hard cooldown ──────────────────────────
  // Using a ref-based cooldown (not state) so it's synchronous and immune
  // to React's async state batching — prevents duplicate entries.
  const handleDetected = useCallback((text: string) => {
    if (!text || text.length < 4) return;
    const now = Date.now();
    if (now < cooldownRef.current) return; // still in cooldown — ignore
    cooldownRef.current = now + (debounceMs > 0 ? debounceMs : 2000); // block for 2s
    setLastScan(text);
    setTimeout(() => setLastScan(null), 800);
    if (!paused) onScan(text);
  }, [onScan, paused, debounceMs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorCode('NO_API');
      return;
    }

    stoppedRef.current = false;
    setReady(false);
    setErrorCode(null);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // ─── Camera constraints ──────────────────────────────────────────────
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: isIOS
        ? { facingMode: { ideal: 'environment' } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    };

    // ─── STRATEGY A: Native BarcodeDetector (Android Chrome, Chrome Desktop)
    // Runs at 60fps via requestAnimationFrame directly on the video element.
    // Format-aware: prefers Code_128 over EAN when both barcodes are visible.
    const startNativeDetector = async (stream: MediaStream) => {
      const detector = new BarcodeDetector({
        formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8',
                  'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code',
                  'data_matrix', 'pdf417'],
      });

      const tick = async () => {
        if (stoppedRef.current) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && !video.paused) {
          try {
            const barcodes: any[] = await detector.detect(video);
            if (barcodes.length > 0) {
              // ✅ Prefer Code 128 / alphanumeric formats over EAN-13/UPC
              // This ensures we pick the serial number barcode, not the product code
              const EAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
              const preferred =
                barcodes.find(b => !EAN_FORMATS.includes(b.format)) ??
                barcodes[0];
              if (preferred?.rawValue) {
                handleDetected(preferred.rawValue);
              }
            }
          } catch { /* ignore decode errors */ }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    // ─── STRATEGY B: ZXing BrowserMultiFormatReader (iOS / no BarcodeDetector)
    // Runs on an interval via the video element.
    let zxingReader: any = null;
    const startZXing = async (stream: MediaStream) => {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const { BarcodeFormat, DecodeHintType, NotFoundException } =
        await import('@zxing/library');

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      zxingReader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80 });

      // Decode continuously from the video element
      const video = videoRef.current!;
      zxingReader.decodeFromStream(stream, video, (result: any, err: any) => {
        if (stoppedRef.current) return;
        if (result) {
          handleDetected(result.getText());
        } else if (err && !(err.name === 'NotFoundException')) {
          console.warn('ZXing err:', err);
        }
      });
    };

    // ─── Main init ───────────────────────────────────────────────────────
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stoppedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // Attach stream to video element
        const video = videoRef.current!;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');  // Required for iOS
        video.setAttribute('muted', 'true');
        video.muted = true;
        await video.play();

        setReady(true);

        // Choose detection strategy
        const hasBarcodeDetector = 'BarcodeDetector' in window;
        if (hasBarcodeDetector && !isIOS) {
          await startNativeDetector(stream);
        } else {
          await startZXing(stream);
        }
      } catch (err: any) {
        const name = err?.name ?? '';
        const msg  = err?.message ?? '';
        let code = 'UNKNOWN';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') code = 'PERMISSION_DENIED';
        else if (name === 'NotFoundError') code = 'NO_CAMERA';
        else if (name === 'NotReadableError') code = 'BUSY';
        setErrorCode(code);
        setDebugText(`[${name}] ${msg}`);
      }
    };

    init();

    return () => {
      stoppedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (zxingReader) { try { zxingReader.reset(); } catch {} }
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [handleDetected, retryCount]);

  // ─── Error screen ─────────────────────────────────────────────────────────
  if (errorCode) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const msgs: Record<string, { icon: string; title: string; steps: React.ReactNode }> = {
      PERMISSION_DENIED: {
        icon: '🚫', title: 'Camera Access Blocked',
        steps: isIOS ? (
          <>1. Go to <b>Settings → Safari → Camera</b><br/>2. Set to <b>Allow</b><br/>3. Tap Retry</>
        ) : (
          <>1. Tap 🔒 in address bar<br/>2. Set <b>Camera → Allow</b><br/>3. Tap Retry</>
        ),
      },
      NO_CAMERA: { icon: '🔍', title: 'No Camera Found', steps: <>Close other camera apps and retry.</> },
      BUSY: { icon: '⚙️', title: 'Camera Busy', steps: <>Close other tabs using the camera, then retry.</> },
      NO_API: { icon: '🔒', title: 'HTTPS Required', steps: <>Open the app via <b>https://</b></> },
      UNKNOWN: {
        icon: '📷', title: 'Camera Error',
        steps: (
          <>
            1. Close other tabs<br/>2. Reload the page<br/>3. Allow camera when asked
            {debugText && <span style={{ display:'block', marginTop:8, fontSize:11, color:'#ffb3b3', fontFamily:'monospace', wordBreak:'break-all' }}>ℹ️ {debugText}</span>}
          </>
        ),
      },
    };
    const { icon, title, steps } = msgs[errorCode] ?? msgs.UNKNOWN;

    return (
      <div style={{ padding:24, textAlign:'center', background:'linear-gradient(135deg,#1a0a0a,#2d0f0f)', color:'#fff', borderRadius:16, border:'1px solid rgba(220,50,50,0.4)' }}>
        <div style={{ fontSize:40, marginBottom:8 }}>{icon}</div>
        <p style={{ fontWeight:700, fontSize:16, margin:'0 0 8px' }}>{title}</p>
        <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:10, padding:'12px 16px', textAlign:'left', fontSize:13, lineHeight:1.8, marginBottom:16 }}>{steps}</div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={() => { setErrorCode(null); setRetryCount(c => c+1); }} style={{ padding:'10px 22px', borderRadius:8, background:'var(--blue,#2563eb)', color:'#fff', border:'none', fontWeight:700, cursor:'pointer' }}>🔄 Retry</button>
          <button onClick={() => window.location.reload()} style={{ padding:'10px 22px', borderRadius:8, background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', fontWeight:600, cursor:'pointer' }}>↺ Reload</button>
        </div>
      </div>
    );
  }

  // ─── Scanner UI ───────────────────────────────────────────────────────────
  return (
    <div style={{ position:'relative', width:'100%', aspectRatio:'5/2', background:'#000', borderRadius:14, overflow:'hidden' }}>

      {/* Native video element — WE control this, no library overriding it */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block',
                 filter:'contrast(1.3) brightness(1.15) saturate(1.1)' }}
      />

      {/* Loading shimmer before camera starts */}
      {!ready && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#111', color:'#fff', fontSize:13, fontWeight:700, gap:8 }}>
          <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⏳</span> Starting camera…
        </div>
      )}

      {/* Scan line */}
      <div style={{ position:'absolute', top:'50%', left:'5%', right:'5%', height:2, background:'red', boxShadow:'0 0 10px red', zIndex:10, opacity:0.8 }} />

      {/* Target box — wide enough for long Code 128 serial barcodes */}
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'92%', height:'64%', border:'2px solid #2563eb', borderRadius:8, boxShadow:'0 0 0 999px rgba(0,0,0,0.4)', pointerEvents:'none', zIndex:9 }} />

      {/* Status label */}
      <div style={{ position:'absolute', bottom:8, left:0, right:0, display:'flex', justifyContent:'center', zIndex:20 }}>
        <div style={{ background:'rgba(0,0,0,0.75)', padding:'5px 14px', borderRadius:20, color:'#fff', fontSize:12, fontWeight:700 }}>
          {paused ? '⏸️ Paused' : lastScan ? `✅ ${lastScan}` : ready ? `🟢 ${label}` : '⏳ Starting…'}
        </div>
      </div>
    </div>
  );
}
