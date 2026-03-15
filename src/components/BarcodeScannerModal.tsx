"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const BARCODE_SCANNER_FALLBACK_ID = "barcode-scanner-fallback";

/** スマホ用バーコード読取モーダル（Android: BarcodeDetector / iOS: html5-qrcode） */
export function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const html5QrRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // BarcodeDetector（Android 等）
  useEffect(() => {
    if (!open || useFallback) {
      if (!useFallback) stopCamera();
      setError(null);
      return;
    }

    const hasBarcodeDetector =
      typeof window !== "undefined" && "BarcodeDetector" in window;
    if (!hasBarcodeDetector) {
      setUseFallback(true);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: typeof BarcodeDetector }).BarcodeDetector;
    const detector = new BarcodeDetectorClass({
      formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code"],
    });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        video.play().catch(() => setError("カメラを起動できませんでした"));
      })
      .catch(() => setError("カメラへのアクセスが許可されていません"));

    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");

    function tick() {
      if (!open || !streamRef.current || !videoRef.current || !ctx) return;
      const v = videoRef.current;
      if (v.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      ctx.drawImage(v, 0, 0);
      createImageBitmap(canvas)
        .then((bitmap) => detector.detect(bitmap))
        .then((results) => {
          if (results.length > 0 && results[0].rawValue) {
            onDetected(results[0].rawValue);
            onClose();
            return;
          }
        })
        .catch(() => {})
        .finally(() => {
          rafRef.current = requestAnimationFrame(tick);
        });
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, useFallback, onDetected, onClose, stopCamera]);

  // html5-qrcode（iOS Safari 等フォールバック）
  useEffect(() => {
    if (!open || !useFallback) {
      return;
    }

    setFallbackLoading(true);
    setError(null);

    let cancelled = false;
    import("html5-qrcode")
      .then(({ Html5Qrcode }) => {
        if (cancelled) return;
        const scanner = new Html5Qrcode(BARCODE_SCANNER_FALLBACK_ID);
        html5QrRef.current = scanner;
        const config = {
          fps: 5,
          qrbox: { width: 260, height: 160 },
        };
        return scanner
          .start(
            { facingMode: "environment" },
            config,
            (decodedText: string) => {
              scanner.stop().then(() => {
                html5QrRef.current = null;
                onDetected(decodedText);
                onClose();
              });
            },
            () => {}
          )
          .then(() => setFallbackLoading(false))
          .catch((err: unknown) => {
            if (!cancelled) {
              setError(
                err instanceof Error ? err.message : "カメラを起動できませんでした"
              );
              setFallbackLoading(false);
            }
          });
      })
      .catch(() => {
        if (!cancelled) {
          setError("スキャナの読み込みに失敗しました");
          setFallbackLoading(false);
        }
      });

    return () => {
      cancelled = true;
      const scanner = html5QrRef.current;
      html5QrRef.current = null;
      if (scanner) {
        scanner.stop().catch(() => {});
      }
    };
  }, [open, useFallback, onDetected, onClose]);

  useEffect(() => {
    if (!open) {
      setUseFallback(false);
      setFallbackLoading(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm font-medium">バーコードを枠内に合わせてください</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-white/20 px-3 py-1.5 text-sm"
        >
          閉じる
        </button>
      </div>
      {useFallback ? (
        <>
          {error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-white">
              <p className="text-center text-sm">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded bg-white/20 px-4 py-2 text-sm"
              >
                閉じる
              </button>
            </div>
          ) : (
            <div className="relative flex-1 min-h-0">
              {fallbackLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                  <span className="text-sm">読取準備中…</span>
                </div>
              )}
              <div
                id={BARCODE_SCANNER_FALLBACK_ID}
                className="h-full w-full [&_video]:!object-cover"
              />
            </div>
          )}
        </>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-white">
          <p className="text-center text-sm">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded bg-white/20 px-4 py-2 text-sm"
          >
            閉じる
          </button>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-64 rounded-lg border-2 border-white/70 bg-transparent" />
          </div>
        </div>
      )}
    </div>
  );
}
