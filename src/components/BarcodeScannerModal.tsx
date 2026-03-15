"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const BARCODE_SCANNER_CONTAINER_ID = "barcode-scanner-container";
const BARCODE_FILE_SCAN_PLACEHOLDER_ID = "barcode-file-scan-placeholder";

/** 閉じる前にカメラ解放を待つ時間（2回目以降の起動失敗を防ぐ） */
const CAMERA_RELEASE_DELAY_MS = 600;

/** デバッグログ（開発時・カメラ表示の切り分け用）。本番では false 推奨 */
const DEBUG_BARCODE = typeof process !== "undefined" && process.env.NODE_ENV === "development";

function logBarcode(...args: unknown[]) {
  if (DEBUG_BARCODE) console.log("[BarcodeScanner]", ...args);
}

/** セキュアコンテキストか（カメラは HTTPS または localhost 必須） */
function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

/** iOS かどうか */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Android Chrome かどうか */
function isAndroidChrome(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android.*Chrome|Chrome.*Android/i.test(navigator.userAgent);
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
  const [manualValue, setManualValue] = useState("");
  const [currentUrl, setCurrentUrl] = useState("#");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && typeof window !== "undefined") setCurrentUrl(window.location.href);
  }, [open]);

  /** 手入力で確定 */
  const handleManualSubmit = useCallback(() => {
    const v = manualValue.trim();
    if (v) {
      onDetected(v);
      onClose();
    }
  }, [manualValue, onDetected, onClose]);

  /** 写真から読み取り（iOSでカメラが使えない場合のフォールバック） */
  const handleFileScan = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      setFileScanning(true);
      logBarcode("file scan start", file.name);
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        const placeholder = document.getElementById(BARCODE_FILE_SCAN_PLACEHOLDER_ID);
        if (!placeholder) {
          logBarcode("file scan: placeholder not found");
          setFileScanning(false);
          return;
        }
        const scanner = new Html5Qrcode(BARCODE_FILE_SCAN_PLACEHOLDER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        });
        const decoded = await scanner.scanFile(file, false);
        logBarcode("file scan result", decoded ? "ok" : "empty");
        if (decoded) {
          onDetected(decoded);
          onClose();
        } else {
          setError("画像からバーコードを読み取れませんでした。はっきり写った写真を選んでください。");
        }
      } catch (err) {
        logBarcode("file scan error", err);
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
      setManualValue("");
      return;
    }
    const secure = isSecureContext();
    setSecureContextError(!secure);
    logBarcode("open", { isIOS: isIOS(), isAndroidChrome: isAndroidChrome(), secure });
  }, [open]);

  // html5-qrcode でカメラ起動（背面優先・QR/CODE_128/EAN_13等対応・getUserMedia失敗時はエラー表示）
  useEffect(() => {
    if (!open || !containerReady || !isSecureContext()) return;

    const el = document.getElementById(BARCODE_SCANNER_CONTAINER_ID);
    if (!el) {
      logBarcode("container element not found");
      return;
    }

    const rect = el.getBoundingClientRect();
    logBarcode("container rect", rect.width, rect.height);
    if (rect.width < 80 || rect.height < 80) {
      logBarcode("container too small, skip start");
      return;
    }

    setLoading(true);
    setError(null);
    let cancelled = false;

    const run = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(BARCODE_SCANNER_CONTAINER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        });
        html5QrRef.current = scanner;

        // 背面カメラ優先（スマホでバーコード読み取りに適す）
        const cameraConstraints: MediaTrackConstraints = {
          facingMode: "environment",
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        };

        const config = {
          fps: 10,
          qrbox: (w: number, h: number) => ({
            width: Math.max(200, Math.min(w - 32, 400)),
            height: Math.max(100, Math.min(180, Math.floor(h * 0.35))),
          }),
          aspectRatio: 1.333,
        };

        logBarcode("calling scanner.start (getUserMedia)");
        await scanner.start(
          cameraConstraints,
          config,
          (decodedText: string) => {
            logBarcode("onDetected", decodedText);
            html5QrRef.current = null;
            scanner.stop().catch(() => {}).then(() => {
              onDetected(decodedText);
              setTimeout(onClose, CAMERA_RELEASE_DELAY_MS);
            });
          },
          () => {}
        );

        if (!cancelled) {
          logBarcode("scanner.start done (camera visible)");
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        const name = err instanceof Error ? err.name : "";
        logBarcode("getUserMedia/scanner error", name, msg);

        if (name === "NotAllowedError" || msg.includes("NotAllowedError") || msg.includes("Permission")) {
          setError("カメラへのアクセスが許可されていません。ブラウザの設定でカメラを許可してください。");
        } else if (name === "NotFoundError" || msg.includes("NotFoundError") || msg.includes("not found")) {
          setError("カメラが見つかりません。");
        } else if (name === "NotReadableError" || msg.includes("NotReadableError")) {
          setError("カメラが他のアプリで使用中の可能性があります。閉じてから再度お試しください。");
        } else if (name === "OverconstrainedError" || msg.includes("OverconstrainedError")) {
          setError("カメラの解像度に対応できませんでした。写真から読み取るか手入力をご利用ください。");
        } else if (name === "AbortError" || msg.includes("AbortError")) {
          setError("カメラの起動が中断されました。再度お試しください。");
        } else if (isIOS()) {
          setError("カメラを起動できませんでした。iOSの場合は「写真から読み取る」か「手入力」をご利用ください。");
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
      logBarcode("cleanup: scanner stopped");
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={handleFileScan}
        disabled={fileScanning}
      />
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
            <>
              <p className="text-center text-xs text-white/80">
                写真から読み取るか、Safariで開いてカメラをご利用ください。
              </p>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/70 underline"
              >
                Safariで開く
              </a>
            </>
          )}
          {!showSecureError && (
            <>
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
              <div className="mt-2 flex flex-col items-center gap-2">
                <input
                  type="text"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder="手入力（読み取れない場合）"
                  className="w-full max-w-xs rounded-lg border border-white/40 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/50"
                />
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={!manualValue.trim()}
                  className="rounded-lg bg-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  手入力で確定
                </button>
              </div>
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
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
          {isIOS() ? (
            <>
              <p className="text-center text-sm text-white/80">
                バーコードが写った写真を選ぶか、カメラで読み取れます
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileScanning}
                className="w-full max-w-xs rounded-xl bg-[var(--primary)] px-8 py-4 text-base font-medium text-[var(--primary-foreground)] shadow-lg"
              >
                {fileScanning ? "読み取り中…" : "写真から読み取る"}
              </button>
              <button
                type="button"
                onClick={handleStartScan}
                className="w-full max-w-xs rounded-xl border-2 border-white/50 bg-white/10 px-8 py-3 text-sm font-medium text-white"
              >
                カメラで読む
              </button>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/60 underline"
              >
                Safariで開くとカメラが使いやすいです
              </a>
            </>
          ) : (
            <>
              <p className="text-center text-sm text-white/80">
                カメラでバーコードを読み取ります
              </p>
              <button
                type="button"
                onClick={handleStartScan}
                className="w-full max-w-xs rounded-xl bg-[var(--primary)] px-8 py-4 text-base font-medium text-[var(--primary-foreground)] shadow-lg"
              >
                読取開始
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileScanning}
                className="w-full max-w-xs rounded-lg border border-white/40 bg-white/10 px-6 py-3 text-sm text-white"
              >
                {fileScanning ? "読み取り中…" : "写真から読み取る"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={closeWithRelease}
            className="mt-2 text-sm text-white/70 underline"
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
          <div className="flex shrink-0 flex-col gap-2 border-t border-white/20 p-3">
            <p className="text-xs text-white/70">読めない場合は手入力または写真から読み取れます</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder="番号を手入力"
                className="min-w-0 flex-1 rounded border border-white/40 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/50"
              />
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={!manualValue.trim()}
                className="shrink-0 rounded-lg bg-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                手入力で確定
              </button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={fileScanning}
              className="self-start text-xs text-white/70 underline"
            >
              {fileScanning ? "読み取り中…" : "写真から読み取る"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
