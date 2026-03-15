"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const BARCODE_SCANNER_FALLBACK_ID = "barcode-scanner-fallback";

/** セキュアコンテキストか（カメラは HTTPS または localhost 必須） */
function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

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
  const [secureContextError, setSecureContextError] = useState(false);

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

  // 非セキュアコンテキスト（HTTP 等）ではカメラ不可
  useEffect(() => {
    if (!open) {
      setSecureContextError(false);
      return;
    }
    setSecureContextError(!isSecureContext());
  }, [open]);

  // BarcodeDetector（Android 等）
  useEffect(() => {
    if (!open || useFallback) {
      if (!useFallback) stopCamera();
      setError(null);
      return;
    }

    if (!isSecureContext()) return;

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
    if (!open || !useFallback || !isSecureContext()) {
      return;
    }

    setFallbackLoading(true);
    setError(null);

    let cancelled = false;
    // スマホでコンテナがレイアウトされるまで待ってから開始（0x0 だとカメラが起動しない）
    const startAfterLayout = () => {
      const el = document.getElementById(BARCODE_SCANNER_FALLBACK_ID);
      if (cancelled || !el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 50) {
        requestAnimationFrame(startAfterLayout);
        return;
      }
      import("html5-qrcode")
        .then(({ Html5Qrcode }) => {
          if (cancelled) return;
          const scanner = new Html5Qrcode(BARCODE_SCANNER_FALLBACK_ID);
          html5QrRef.current = scanner;
          const config = {
            fps: 5,
            qrbox: (w: number, h: number) => ({
            width: Math.max(100, Math.min(260, w - 20)),
            height: Math.max(80, Math.min(160, h - 20)),
          }),
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
    };
    requestAnimationFrame(() => requestAnimationFrame(startAfterLayout));

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

  const showSecureError = secureContextError;
  const errMessage = showSecureError
    ? "カメラは HTTPS でご利用ください。スマホではアドレスが https:// のページで開いてください。"
    : error;

  return (
    <div className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between p-3 text-white">
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
          {error || showSecureError ? (
            <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-2 p-4 text-white">
              <p className="text-center text-sm">{errMessage}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded bg-white/20 px-4 py-2 text-sm"
              >
                閉じる
              </button>
            </div>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col">
              {fallbackLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                  <span className="text-sm">読取準備中…</span>
                </div>
              )}
              <div
                id={BARCODE_SCANNER_FALLBACK_ID}
                className="min-h-[300px] h-full w-full [&_video]:!object-cover"
              />
            </div>
          )}
        </>
      ) : error || showSecureError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-white">
          <p className="text-center text-sm">{errMessage}</p>
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
