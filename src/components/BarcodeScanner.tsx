'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  onScan: (value: string) => void;
  paused?: boolean;
  label?: string;
  debounceMs?: number;
}

declare const BarcodeDetector: any;

// ── Valid serial characters: alphanumeric + hyphen + slash + dot ─────────────
const VALID_SERIAL_RE = /^[A-Z0-9\-\/\.]+$/i;

export default function BarcodeScanner({
  onScan,
  paused = false,
  label = 'Align barcode in frame',
  debounceMs = 2000,
}: Props) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const timerRef     = useRef<any>(null);
  const cooldownRef  = useRef<number>(0);
  const stoppedRef   = useRef(false);

  const [errorCode, setErrorCode]   = useState<string | null>(null);
  const [debugText, setDebugText]   = useState('');
  const [ready, setReady]           = useState(false);
  const [lastScan, setLastScan]     = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // ─── Scan handler — hard cooldown, character validation ──────────────────
  const handleDetected = useCallback((raw: string) => {
    if (!raw) return;
    const text = raw.trim().toUpperCase();

    // Minimum 6 chars
    if (text.length < 6) return;

    // Reject garbled reads: must be alphanumeric + hyphen/slash/dot only
    if (!VALID_SERIAL_RE.test(text)) return;

    // Hard cooldown (ref-based = synchronous, immune to React batching)
    const now = Date.now();
    if (now < cooldownRef.current) return;
    cooldownRef.current = now + debounceMs;

    setLastScan(text);
    setTimeout(() => setLastScan(null), 900);
    if (!paused) onScan(text);
  }, [onScan, paused, debounceMs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorCode('NO_API'); return;
    }

    stoppedRef.current = false;
    setReady(false);
    setErrorCode(null);
    setDebugText('');

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // ─── Init ─────────────────────────────────────────────────────────────
    const init = async () => {
      try {
        // 1. Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: isIOS
            ? { facingMode: { ideal: 'environment' } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });

        if (stoppedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // 2. Attach to our video element (WE control it — no lib fights us)
        const video = videoRef.current;
        if (!video) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject  = stream;
        video.muted      = true;
        video.playsInline = true;
        await video.play();
        setReady(true);

        // 3. Choose detection engine
        const hasNativeDetector = 'BarcodeDetector' in window && !isIOS;

        if (hasNativeDetector) {
          // ── ANDROID/DESKTOP: native BarcodeDetector via requestAnimationFrame ──
          // Hardware-accelerated, format-aware, ~60fps
          const detector = new BarcodeDetector({
            formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8',
                      'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix'],
          });

          const EAN_FORMATS = new Set(['ean_13', 'ean_8', 'upc_a', 'upc_e']);

          const tick = async () => {
            if (stoppedRef.current) return;
            const v = videoRef.current;
            if (v && v.readyState >= 2 && !v.paused) {
              try {
                const barcodes: any[] = await detector.detect(v);
                // Prefer Code 128 (serial #) over EAN (product code) when both visible
                const preferred =
                  barcodes.find(b => !EAN_FORMATS.has(b.format)) ?? barcodes[0];
                if (preferred?.rawValue) handleDetected(preferred.rawValue);
              } catch { /* normal — no barcode this frame */ }
            }
            if (!stoppedRef.current) timerRef.current = requestAnimationFrame(tick);
          };
          timerRef.current = requestAnimationFrame(tick);

        } else {
          // ── iOS / FALLBACK: ZXing canvas-based loop at 40ms ──────────────
          // We draw video frames to a canvas and let ZXing decode synchronously.
          // This avoids ZXing managing the video element (which causes the
          // "null is not an object (srcObject)" crash on iOS).
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');

          if (stoppedRef.current) return;

          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
            BarcodeFormat.CODE_93,  BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,    BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,    BarcodeFormat.ITF,
            BarcodeFormat.QR_CODE,
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);

          const reader = new BrowserMultiFormatReader(hints);

          // Create a hidden canvas — we draw frames here for ZXing to decode
          const canvas = canvasRef.current ?? document.createElement('canvas');
          const ctx    = canvas.getContext('2d', { willReadFrequently: true });

          const decode = () => {
            if (stoppedRef.current) return;
            const v = videoRef.current;
            if (v && ctx && v.readyState >= 2 && v.videoWidth > 0) {
              const scale = Math.min(1, 640 / v.videoWidth);
              canvas.width  = v.videoWidth * scale;
              canvas.height = v.videoHeight * scale;
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              try {
                // decodeFromCanvas is synchronous — no async timing issues
                const result = (reader as any).decodeFromCanvas(canvas);
                if (result) handleDetected(result.getText());
              } catch { /* NotFoundException = no barcode this frame, normal */ }
            }
            timerRef.current = setTimeout(decode, 40); // 40ms = 25fps = 0.04s
          };

          timerRef.current = setTimeout(decode, 100); // small startup delay
        }

      } catch (err: any) {
        if (stoppedRef.current) return;
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
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        clearTimeout(timerRef.current);
      }
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
        steps: isIOS
          ? <>1. Go to <b>Settings → Safari → Camera</b><br/>2. Set to <b>Allow</b><br/>3. Tap Retry</>
          : <>1. Tap 🔒 in address bar<br/>2. Set <b>Camera → Allow</b><br/>3. Tap Retry</>,
      },
      NO_CAMERA:  { icon: '🔍', title: 'No Camera Found',  steps: <>Close other camera apps and retry.</> },
      BUSY:       { icon: '⚙️', title: 'Camera Busy',      steps: <>Close other tabs using the camera, then retry.</> },
      NO_API:     { icon: '🔒', title: 'HTTPS Required',   steps: <>Open the app via <b>https://</b></> },
      UNKNOWN: {
        icon: '📷', title: 'Camera Error',
        steps: <>
          1. Close other tabs<br/>2. Reload the page<br/>3. Allow camera access
          {debugText && <span style={{ display:'block', mt:8, fontSize:11, color:'#ffb3b3', fontFamily:'monospace', wordBreak:'break-all' } as any}>ℹ️ {debugText}</span>}
        </>,
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

      {/* Camera feed — WE own this element */}
      <video ref={videoRef} playsInline muted autoPlay
        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block',
                 filter:'contrast(1.3) brightness(1.15) saturate(1.05)' }} />

      {/* Hidden canvas for ZXing iOS decoding */}
      <canvas ref={canvasRef} style={{ display:'none' }} />

      {/* Starting overlay */}
      {!ready && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#111', color:'#fff', fontSize:13, fontWeight:700 }}>
          ⏳ Starting camera…
        </div>
      )}

      {/* Scan line */}
      <div style={{ position:'absolute', top:'50%', left:'4%', right:'4%', height:2, background:'red', boxShadow:'0 0 12px red', zIndex:10, opacity:0.85 }} />

      {/* Target box */}
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'92%', height:'66%', border:'2px solid #2563eb', borderRadius:8, boxShadow:'0 0 0 999px rgba(0,0,0,0.38)', pointerEvents:'none', zIndex:9 }} />

      {/* Status */}
      <div style={{ position:'absolute', bottom:8, left:0, right:0, display:'flex', justifyContent:'center', zIndex:20 }}>
        <div style={{ background:'rgba(0,0,0,0.75)', padding:'5px 14px', borderRadius:20, color:'#fff', fontSize:12, fontWeight:700 }}>
          {paused ? '⏸️ Paused' : lastScan ? `✅ ${lastScan}` : ready ? `🟢 ${label}` : '⏳ Starting…'}
        </div>
      </div>
    </div>
  );
}
