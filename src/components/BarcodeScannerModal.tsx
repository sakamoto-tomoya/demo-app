"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const BARCODE_SCANNER_CONTAINER_ID = "barcode-scanner-container";

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

/** スマホ・タブレットか */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return "maxTouchPoints" in navigator && navigator.maxTouchPoints > 0 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Android / iOS 兼用バーコード読取モーダル
 * html5-qrcode のみ使用（getCameras + 裏カメラ優先で両OSで安定動作）
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
  const [containerReady, setContainerReady] = useState(false);

  // 非セキュアコンテキスト
  useEffect(() => {
    if (!open) {
      setSecureContextError(false);
      setContainerReady(false);
      return;
    }
    setSecureContextError(!isSecureContext());
    // コンテナが DOM に描画されてサイズが取れるまで少し待つ（Android/iOS で必須）
    const t = setTimeout(() => setContainerReady(true), 350);
    return () => clearTimeout(t);
  }, [open]);

  // html5-qrcode でカメラ起動（getCameras → 裏カメラ優先で start）
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

        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;

        if (!cameras || cameras.length === 0) {
          setError(
            isIOS()
              ? "カメラが見つかりません。iOSではSafariで開くか、「設定」でカメラの許可を確認してください。"
              : "カメラが見つかりません。ブラウザのカメラ許可を確認してください。"
          );
          setLoading(false);
          return;
        }

        // 裏カメラ（バーコード用）を優先。ラベルに back / rear / 環境 を含むもの、または末尾を利用
        const backLabel = /back|rear|environment|環境|背面/i;
        const backCam = cameras.find((c) => backLabel.test(c.label));
        const cameraId = backCam ? backCam.id : cameras[cameras.length - 1].id;

        const scanner = new Html5Qrcode(BARCODE_SCANNER_CONTAINER_ID);
        html5QrRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: (w: number, h: number) => ({
            width: Math.max(120, Math.min(280, w - 24)),
            height: Math.max(80, Math.min(180, h - 24)),
          }),
          aspectRatio: 1.0,
        };

        await scanner.start(
          cameraId,
          config,
          (decodedText: string) => {
            scanner.stop().then(() => {
              html5QrRef.current = null;
              onDetected(decodedText);
              onClose();
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

      {showSecureError || error ? (
        <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3 p-4 text-white">
          <p className="text-center text-sm leading-relaxed">{errMessage}</p>
          {isIOS() && !showSecureError && (
            <p className="text-center text-xs text-white/80">
              iPhone・iPadでは「Safari」で開くとカメラが使えます。
            </p>
          )}
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
