"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const BARCODE_SCANNER_CONTAINER_ID = "barcode-scanner-container";
const BARCODE_FILE_SCAN_PLACEHOLDER_ID = "barcode-file-scan-placeholder";

/** 閉じる前にカメラ解放を待つ時間（2回目以降の起動失敗を防ぐ） */
const CAMERA_RELEASE_DELAY_MS = 600;

/** セキュアコンテキストか（カメラは HTTPS または localhost 必須） */
function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

/** iOS かどうか（Safari 以外ではカメラが使えない場合がある） */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Android / iOS 兼用バーコード読取モーダル
 * 閉じるときにカメラを解放してから onClose するため、出庫・2回目以降も読める
 */
export function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
}) {
  const html5QrRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secureContextError, setSecureContextError] = useState(false);
  const [scanStarted, setScanStarted] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 写真から読み取り（iOSのLINE等カメラ不可ブラウザ用） */
  const handleFileScan = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      setFileScanning(true);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const placeholder = document.getElementById(BARCODE_FILE_SCAN_PLACEHOLDER_ID);
        if (!placeholder) {
          setFileScanning(false);
          return;
        }
        const scanner = new Html5Qrcode(BARCODE_FILE_SCAN_PLACEHOLDER_ID);
        const decoded = await scanner.scanFile(file, false);
        if (decoded) {
          onDetected(decoded);
          onClose();
        }
      } catch {
        setError("画像からバーコードを読み取れませんでした。はっきり写った写真を選んでください。");
      }
      setFileScanning(false);
    },
    [onDetected, onClose]
  );

  /** 読取開始ボタン押下 → コンテナ準備後にスキャン開始 */
  const handleStartScan = useCallback(() => {
    setScanStarted(true);
    setError(null);
    setTimeout(() => setContainerReady(true), 300);
  }, []);

  /** カメラを止めてから少し待ってから onClose（2回目以降の起動失敗を防ぐ） */
  const closeWithRelease = useCallback(() => {
    const scanner = html5QrRef.current;
    html5QrRef.current = null;
    if (scanner) {
      scanner
        .stop()
        .catch(() => {})
        .then(() => setTimeout(onClose, CAMERA_RELEASE_DELAY_MS));
    } else {
      onClose();
    }
  }, [onClose]);

  // 開閉時のリセット（読取開始はボタンで行う）
  useEffect(() => {
    if (!open) {
      setSecureContextError(false);
      setScanStarted(false);
      setContainerReady(false);
      return;
    }
    setSecureContextError(!isSecureContext());
  }, [open]);

  // html5-qrcode でカメラ起動（高解像度指定でぼけ軽減・1Dバーコード用に枠を広めに）
  useEffect(() => {
    if (!open || !containerReady || !isSecureContext()) return;

    const el = document.getElementById(BARCODE_SCANNER_CONTAINER_ID);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) return;

    setLoading(true);
    setError(null);

    let cancelled = false;

    const run = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(BARCODE_SCANNER_CONTAINER_ID);
        html5QrRef.current = scanner;

        // 裏カメラ + 高解像度でぼけを軽減（ideal でできるだけシャープなストリームを要求）
        const cameraConstraints: MediaTrackConstraints = {
          facingMode: "environment",
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        };

        // 1Dバーコード用: 枠を横長・広めにして読み取りやすく
        const config = {
          fps: 10,
          qrbox: (w: number, h: number) => ({
            width: Math.max(200, Math.min(w - 32, 400)),
            height: Math.max(100, Math.min(180, Math.floor(h * 0.35))),
          }),
          aspectRatio: 1.333,
        };

        await scanner.start(
          cameraConstraints,
          config,
          (decodedText: string) => {
            html5QrRef.current = null;
            scanner.stop().catch(() => {}).then(() => {
              onDetected(decodedText);
              setTimeout(onClose, CAMERA_RELEASE_DELAY_MS);
            });
          },
          () => {}
        );

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
          setError("カメラへのアクセスが許可されていません。ブラウザの設定でカメラを許可してください。");
        } else if (msg.includes("NotFoundError") || msg.includes("not found")) {
          setError("カメラが見つかりません。");
        } else if (isIOS()) {
          setError("カメラを起動できませんでした。iOSではSafariで開いてください。");
        } else {
          setError(msg.length > 80 ? "カメラを起動できませんでした。" : msg);
        }
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      const scanner = html5QrRef.current;
      html5QrRef.current = null;
      if (scanner) scanner.stop().catch(() => {});
    };
  }, [open, containerReady, onDetected, onClose]);

  if (!open) return null;

  const showSecureError = secureContextError;
  const errMessage = showSecureError
    ? "カメラは HTTPS でご利用ください。スマホではアドレスが https:// のページで開いてください。"
    : error;

  return (
    <div className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-black">
      {/* 写真スキャン用（html5-qrcode が要素を要求するため非表示で常時配置） */}
      <div id={BARCODE_FILE_SCAN_PLACEHOLDER_ID} className="sr-only" aria-hidden />
      <div className="flex shrink-0 flex-col gap-1 p-3">
        <div className="flex items-center justify-between text-white">
          <span className="text-sm font-medium">バーコードを枠内に合わせてください</span>
          <button
          type="button"
          onClick={closeWithRelease}
          className="rounded bg-white/20 px-3 py-1.5 text-sm"
          >
            閉じる
          </button>
        </div>
        <p className="text-xs text-white/70">読めないときは、バーコードに近づくか少し離してピントを合わせてください</p>
      </div>

      {showSecureError || error ? (
        <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-4 p-4 text-white">
          <p className="text-center text-sm leading-relaxed">{errMessage}</p>
          {isIOS() && !showSecureError && (
            <p className="text-center text-xs text-white/80">
              LINEなどアプリ内ブラウザではカメラが使えません。下の「写真から読み取る」をご利用ください。
            </p>
          )}
          {!showSecureError && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                onChange={handleFileScan}
                disabled={fileScanning}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileScanning}
                className="rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
              >
                {fileScanning ? "読み取り中…" : "写真から読み取る"}
              </button>
              <p className="text-center text-xs text-white/60">
                バーコードが写った写真を選ぶと読み取れます
              </p>
            </>
          )}
          <button
            type="button"
            onClick={closeWithRelease}
            className="mt-2 rounded bg-white/20 px-4 py-2 text-sm"
          >
            閉じる
          </button>
        </div>
      ) : !scanStarted ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <p className="text-center text-sm text-white/80">
            カメラでバーコードを読み取ります
          </p>
          <button
            type="button"
            onClick={handleStartScan}
            className="rounded-xl bg-[var(--primary)] px-8 py-4 text-base font-medium text-[var(--primary-foreground)] shadow-lg"
          >
            読取開始
          </button>
          {isIOS() && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                onChange={handleFileScan}
                disabled={fileScanning}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileScanning}
                className="rounded-lg border border-white/40 bg-white/10 px-6 py-3 text-sm text-white"
              >
                {fileScanning ? "読み取り中…" : "写真から読み取る"}
              </button>
              <p className="text-center text-xs text-white/60">
                LINEなどではこちらをご利用ください
              </p>
            </>
          )}
          <button
            type="button"
            onClick={closeWithRelease}
            className="text-sm text-white/70 underline"
          >
            閉じる
          </button>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-white">
              <span className="text-sm">読取準備中…</span>
            </div>
          )}
          <div
            id={BARCODE_SCANNER_CONTAINER_ID}
            className="min-h-[300px] w-full flex-1 [&_video]:!object-cover"
          />
        </div>
      )}
    </div>
  );
}
