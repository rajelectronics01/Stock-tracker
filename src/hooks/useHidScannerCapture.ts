'use client';

import { useEffect, useRef } from 'react';

interface UseHidScannerCaptureOptions {
  enabled?: boolean;
  onScan: (value: string) => void;
  minLength?: number;
  maxLength?: number;
  idleMs?: number;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useHidScannerCapture({
  enabled = true,
  onScan,
  minLength = 3,
  maxLength = 128,
  idleMs = 45,
}: UseHidScannerCaptureOptions): void {
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const clearBuffer = () => {
      bufferRef.current = '';
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const emitIfValid = () => {
      const value = bufferRef.current.trim();
      clearBuffer();
      if (value.length < minLength || value.length > maxLength) return;
      onScan(value);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.isComposing) return;

      const key = event.key;
      if (key === 'Shift' || key === 'CapsLock' || key === 'Tab') return;

      // Keep normal typing untouched when not already capturing scanner stream
      const editable = isEditableTarget(event.target);
      if (editable && bufferRef.current.length === 0) return;

      if (key === 'Enter') {
        if (bufferRef.current.length > 0) {
          event.preventDefault();
          emitIfValid();
        }
        return;
      }

      if (key.length !== 1) return;

      bufferRef.current += key;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        clearBuffer();
      }, idleMs);
    };

    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      clearBuffer();
    };
  }, [enabled, idleMs, maxLength, minLength, onScan]);
}
