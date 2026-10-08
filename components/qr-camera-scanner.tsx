"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export function QrCameraScanner({ onScan, onError }: { onScan: (value: string) => void; onError: (message: string) => void }) {
  const handled = useRef(false);
  const reportScan = useEffectEvent(onScan);
  const reportError = useEffectEvent(onError);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("qdcom-camera-reader", {
      fps: 10,
      qrbox: { width: 220, height: 220 },
      aspectRatio: 1,
      rememberLastUsedCamera: true,
    }, false);
    scanner.render((decodedText) => {
      if (handled.current) return;
      handled.current = true;
      reportScan(decodedText);
    }, () => undefined);
    return () => { void scanner.clear().catch((error: unknown) => reportError(error instanceof Error ? error.message : "Không thể dừng camera.")); };
  }, []);

  return <div id="qdcom-camera-reader" />;
}
