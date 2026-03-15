"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getAllInbound, addInbound, deleteInbound, addOrIncrementVehiclePart, findVehiclePartByPartNo, normalizePartNo, type InboundRecord } from "@/lib/parts-store";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { getDefaultInboundHandlerName, getDefaultOutboundHandlerName, getAssigneeNames, getEmailByAssigneeName } from "@/lib/settings";

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";
const inputErrorClass =
  "mt-1 block w-full rounded-lg border-2 border-[var(--alert)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** オブジェクトURLをサムネイル用Data URLに変換（最大辺をmaxSizeに縮小） */
function objectUrlToDataUrl(url: string, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxSize || h > maxSize) {
        if (w > h) {
          h = (h * maxSize) / w;
          w = maxSize;
        } else {
          w = (w * maxSize) / h;
          h = maxSize;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(url);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

export default function PartsInboundPage() {
  const [list, setList] = useState<InboundRecord[]>([]);
  const [saved, setSaved] = useState(false);
  const [mailStatus, setMailStatus] = useState<"idle" | "sent" | "skipped" | "error">("idle");
  const [mailErrorReason, setMailErrorReason] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [partCostTotal, setPartCostTotal] = useState<number | null>(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [assigneeNames, setAssigneeNames] = useState<string[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoLibraryInputRef = useRef<HTMLInputElement>(null);
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    partNo: "",
    partName: "",
    inboundPlace: "",
    inboundDate: todayYYYYMMDD(),
    inboundQty: 0,
    inboundPerson: "",
    outboundPerson: "",
    partCost: "",
    orderNo: "",
  });

  useEffect(() => {
    setAssigneeNames(getAssigneeNames());
    setList(getAllInbound());
    setForm((prev) => ({
      ...prev,
      inboundPerson: prev.inboundPerson || getDefaultInboundHandlerName(),
      outboundPerson: prev.outboundPerson || getDefaultOutboundHandlerName(),
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [cameraPreviewUrl, photoPreviewUrl]);

  const handleCameraImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      e.target.value = "";
      return;
    }
    if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
    setCameraPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  /** 部品品番が変更されたとき、582145100なら部品名「ボタン軸」・単価800・入庫数1を自動転記。それ以外はマスター/過去入庫から部品名・入庫数1を反映。単価は保存履歴（入庫）を参照して自動反映 */
  const handlePartNoChange = (value: string) => {
    setForm((p) => {
      const next = { ...p, partNo: value };
      const key = normalizePartNo(value);
      if (key === "582145100") {
        next.partName = "ボタン軸";
        next.partCost = "800";
        next.inboundQty = 1;
        return next;
      }
      if (!key) return next;
      const fromVehicle = findVehiclePartByPartNo(value);
      if (fromVehicle) {
        if (fromVehicle.partName?.trim()) next.partName = fromVehicle.partName.trim();
        next.inboundQty = 1;
      }
      const inboundList = getAllInbound();
      const fromInbound = inboundList
        .filter((r) => normalizePartNo(r.partNo ?? "") === key)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
      if (fromInbound?.partName?.trim() && !fromVehicle) {
        next.partName = fromInbound.partName.trim();
        next.inboundQty = 1;
      }
      if (fromInbound?.partCost != null) {
        next.partCost = String(fromInbound.partCost);
      }
      return next;
    });
  };

  const handlePhotoLibraryImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      e.target.value = "";
      return;
    }
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.partNo.trim()) nextErrors.partNo = "部品品番を入力してください";
    if (!form.partName.trim()) nextErrors.partName = "部品名を入力してください";
    if (!form.inboundPlace?.trim()) nextErrors.inboundPlace = "入庫場所を選択してください";
    if (!form.inboundDate.trim()) nextErrors.inboundDate = "入庫日を入力してください";
    if (form.inboundQty === undefined || form.inboundQty === null || String(form.inboundQty).trim() === "")
      nextErrors.inboundQty = "入庫数を入力してください";
    else if (Number(form.inboundQty) <= 0)
      nextErrors.inboundQty = "入庫数は1以上を入力してください";
    if (!form.inboundPerson.trim()) nextErrors.inboundPerson = "入庫担当者を選択してください";
    if (!form.outboundPerson?.trim()) nextErrors.outboundPerson = "出庫担当者を選択してください";
    if (form.partCost === undefined || form.partCost === null || String(form.partCost).trim() === "")
      nextErrors.partCost = "部品代を入力してください";
    if (!form.orderNo?.trim()) nextErrors.orderNo = "注文番号を入力してください";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // 警告を表示し、最初のエラー要素へスクロール
      const firstKey = Object.keys(nextErrors)[0];
      setTimeout(() => {
        const el = document.querySelector(`[data-inbound-error="${firstKey}"]`) ?? document.getElementById("inbound-form");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setErrors({});

    let cameraData = "";
    let photoData = "";
    try {
      if (cameraPreviewUrl) cameraData = await objectUrlToDataUrl(cameraPreviewUrl);
      if (photoPreviewUrl) photoData = await objectUrlToDataUrl(photoPreviewUrl);
    } catch {
      // 変換失敗時は画像なしで登録
    }
    const partCostNum = form.partCost !== "" && form.partCost != null ? Number(form.partCost) : undefined;
    const isPartCostValid = partCostNum != null && !Number.isNaN(partCostNum);
    const record = {
      partNo: form.partNo.trim(),
      partName: form.partName.trim() || undefined,
      inboundPlace: (form.inboundPlace ?? "").trim() || undefined,
      inboundDate: form.inboundDate.trim(),
      inboundQty: Number(form.inboundQty) || 0,
      inboundPerson: (form.inboundPerson ?? "").trim(),
      outboundPerson: (form.outboundPerson ?? "").trim() || undefined,
      partCost: isPartCostValid ? partCostNum : undefined,
      orderNo: (form.orderNo ?? "").trim() || undefined,
      cameraImageDataUrl: cameraData || undefined,
      photoImageDataUrl: photoData || undefined,
    };
    // 必須が揃っていない場合は入庫一覧に載せない（二重ガード）。— 表示になる項目は登録しない
    const requiredFilled =
      record.partNo !== "" &&
      (record.partName ?? "") !== "" &&
      (record.inboundPlace ?? "").trim() !== "" &&
      record.inboundDate !== "" &&
      (Number(record.inboundQty) || 0) > 0 &&
      record.inboundPerson !== "" &&
      (record.outboundPerson ?? "") !== "" &&
      isPartCostValid &&
      (record.orderNo ?? "") !== "";
    if (!requiredFilled) return;
    addInbound(record);
    addOrIncrementVehiclePart({
      partNo: form.partNo,
      storagePlaceVehicle: record.inboundPlace?.trim() ?? "",
      partName: form.partName?.trim() ?? "",
      quantity: record.inboundQty,
    });
    setList(getAllInbound());
    setForm((p) => ({ ...p, partNo: "", partName: "", inboundPlace: "", inboundQty: 0, inboundPerson: "", outboundPerson: "", partCost: "", orderNo: "" }));
    if (cameraPreviewUrl) {
      URL.revokeObjectURL(cameraPreviewUrl);
      setCameraPreviewUrl(null);
    }
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
      setPhotoPreviewUrl(null);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    const outboundEmail = form.outboundPerson ? getEmailByAssigneeName(form.outboundPerson) : undefined;
    const toEmails = outboundEmail ? [outboundEmail] : [];
    setMailErrorReason("");
    setMailStatus("idle");
    if (toEmails.length === 0) {
      setMailStatus("skipped");
    } else {
      try {
        const res = await fetch("/api/parts/inbound/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toEmails, record }),
        });
        let data: { sent?: boolean; reason?: string } = {};
        try {
          data = (await res.json()) as { sent?: boolean; reason?: string };
        } catch {
          data = { sent: false, reason: "レスポンスの取得に失敗しました" };
        }
        if (data.sent) {
          setMailStatus("sent");
        } else {
          setMailStatus("error");
          setMailErrorReason(data.reason ?? "送信できませんでした");
        }
      } catch (err) {
        setMailStatus("error");
        setMailErrorReason(err instanceof Error ? err.message : "通信エラー");
      }
    }
    setTimeout(() => {
      setMailStatus("idle");
      setMailErrorReason("");
    }, 6000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/parts"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
        >
          戻る
        </Link>
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">入庫</h1>
      </div>
      <p className="text-[var(--muted)]">部品の入庫を登録します。</p>

      <form id="inbound-form" onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        {(() => {
          const messages = Object.values(errors).filter((msg): msg is string => Boolean(msg?.trim()));
          return messages.length > 0 ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-[var(--alert)] bg-[var(--alert)]/10 px-4 py-3 text-sm text-[var(--alert)]"
            >
              <ul className="list-disc list-inside space-y-0.5">
                {messages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          ) : null;
        })()}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block" data-inbound-error="partNo">
            <span className="text-sm font-medium text-[var(--foreground)]">部品品番 *</span>
            <div className="mt-1 flex min-w-0 gap-2">
              <input
                type="text"
                value={form.partNo}
                onChange={(e) => { handlePartNoChange(e.target.value); setErrors((p) => ({ ...p, partNo: "" })); }}
                onBlur={(e) => handlePartNoChange(e.target.value)}
                className={`block min-w-0 flex-1 rounded-lg border bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] ${errors.partNo ? "border-2 border-[var(--alert)]" : "border border-[var(--border)]"}`}
                required
              />
              <button
                type="button"
                onClick={() => setBarcodeScannerOpen(true)}
                className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                title="バーコードをスキャン"
              >
                読取
              </button>
            </div>
            {errors.partNo && <p className="mt-1 text-xs text-[var(--alert)]">{errors.partNo}</p>}
          </label>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-3 sm:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-3 items-end">
            <label className="block min-w-0" data-inbound-error="partName">
              <span className="text-sm font-medium text-[var(--foreground)]">部品名</span>
              <input
                type="text"
                value={form.partName}
                onChange={(e) => { setForm((p) => ({ ...p, partName: e.target.value })); setErrors((p) => ({ ...p, partName: "" })); }}
                className={errors.partName ? inputErrorClass : inputClass}
                placeholder="部品名称"
              />
              {errors.partName && <p className="mt-1 text-xs text-[var(--alert)]">{errors.partName}</p>}
            </label>
            <label className="block min-w-0 sm:w-36" data-inbound-error="inboundPlace">
              <span className="text-sm font-medium text-[var(--foreground)]">入庫場所 *</span>
              <select
                value={form.inboundPlace}
                onChange={(e) => { setForm((p) => ({ ...p, inboundPlace: e.target.value })); setErrors((p) => ({ ...p, inboundPlace: "" })); }}
                className={errors.inboundPlace ? inputErrorClass : inputClass}
              >
                <option value="">未選択</option>
                <option value="事務所">事務所</option>
                <option value="研修センター">研修センター</option>
              </select>
              {errors.inboundPlace && <p className="mt-1 text-xs text-[var(--alert)]">{errors.inboundPlace}</p>}
            </label>
          </div>
          <label data-inbound-error="inboundDate">
            <span className="text-sm font-medium text-[var(--foreground)]">入庫日 *</span>
            <input
              type="date"
              value={form.inboundDate}
              onChange={(e) => { setForm((p) => ({ ...p, inboundDate: e.target.value })); setErrors((p) => ({ ...p, inboundDate: "" })); }}
              className={errors.inboundDate ? inputErrorClass : inputClass}
            />
            {errors.inboundDate && <p className="mt-1 text-xs text-[var(--alert)]">{errors.inboundDate}</p>}
          </label>
          <label data-inbound-error="inboundQty">
            <span className="text-sm font-medium text-[var(--foreground)]">入庫数 *</span>
            <input
              type="number"
              value={form.inboundQty || ""}
              onChange={(e) => { setForm((p) => ({ ...p, inboundQty: Number(e.target.value) || 0 })); setErrors((p) => ({ ...p, inboundQty: "" })); }}
              className={errors.inboundQty ? inputErrorClass : inputClass}
              min={0}
            />
            {errors.inboundQty && <p className="mt-1 text-xs text-[var(--alert)]">{errors.inboundQty}</p>}
          </label>
          <label data-inbound-error="inboundPerson">
            <span className="text-sm font-medium text-[var(--foreground)]">入庫担当者</span>
            <select
              value={form.inboundPerson}
              onChange={(e) => { setForm((p) => ({ ...p, inboundPerson: e.target.value })); setErrors((p) => ({ ...p, inboundPerson: "" })); }}
              className={errors.inboundPerson ? inputErrorClass : inputClass}
            >
              <option value="">未選択</option>
              {assigneeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {errors.inboundPerson && <p className="mt-1 text-xs text-[var(--alert)]">{errors.inboundPerson}</p>}
          </label>
          <label data-inbound-error="outboundPerson">
            <span className="text-sm font-medium text-[var(--foreground)]">出庫担当者（注文者）選択</span>
            <select
              value={form.outboundPerson}
              onChange={(e) => { setForm((p) => ({ ...p, outboundPerson: e.target.value })); setErrors((p) => ({ ...p, outboundPerson: "" })); }}
              className={errors.outboundPerson ? inputErrorClass : inputClass}
            >
              <option value="">未選択</option>
              {assigneeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {errors.outboundPerson && <p className="mt-1 text-xs text-[var(--alert)]">{errors.outboundPerson}</p>}
          </label>
          <label data-inbound-error="partCost">
            <span className="text-sm font-medium text-[var(--foreground)]">単価（部品代）</span>
            <input
              type="number"
              value={form.partCost}
              onChange={(e) => { setForm((p) => ({ ...p, partCost: e.target.value })); setErrors((p) => ({ ...p, partCost: "" })); }}
              className={errors.partCost ? inputErrorClass : inputClass}
              min={0}
            />
            {errors.partCost && <p className="mt-1 text-xs text-[var(--alert)]">{errors.partCost}</p>}
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">合計（単価×入庫数）</span>
            <input
              type="number"
              readOnly
              value={(Number(form.partCost) || 0) * (Number(form.inboundQty) || 0)}
              className={`${inputClass} bg-[var(--border)]/30`}
              min={0}
              tabIndex={-1}
              aria-label="単価×入庫数で自動反映"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">単価×入庫数で自動反映されます</p>
          </label>
          <label className="sm:col-span-2" data-inbound-error="orderNo">
            <span className="text-sm font-medium text-[var(--foreground)]">注文番号（オーダーNo）</span>
            <input
              type="text"
              value={form.orderNo}
              onChange={(e) => { setForm((p) => ({ ...p, orderNo: e.target.value })); setErrors((p) => ({ ...p, orderNo: "" })); }}
              className={errors.orderNo ? inputErrorClass : inputClass}
            />
            {errors.orderNo && <p className="mt-1 text-xs text-[var(--alert)]">{errors.orderNo}</p>}
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
            >
              登録
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraImage}
              className="sr-only"
              aria-hidden
            />
            <input
              ref={photoLibraryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoLibraryImage}
              className="sr-only"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]/30"
            >
              カメラ写真を撮る
            </button>
            <button
              type="button"
              onClick={() => photoLibraryInputRef.current?.click()}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]/30"
            >
              フォトライブラリー
            </button>
            {saved && (
              <span className="text-sm text-[var(--muted)]">登録しました（入庫一覧に反映）</span>
            )}
            {mailStatus === "sent" && (
              <span className="text-sm text-[var(--primary)]">メールで告知しました</span>
            )}
            {mailStatus === "skipped" && (
              <span className="text-sm text-[var(--muted)]">メール送信をスキップ（宛先未設定）</span>
            )}
            {mailStatus === "error" && (
              <span className="text-sm text-[var(--alert)]">
                メール送信に失敗しました
                {mailErrorReason && <span className="ml-1 opacity-90">（{mailErrorReason}）</span>}
              </span>
            )}
          </div>
          <div className="ml-auto flex shrink-0 gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-[var(--muted)]">カメラ</span>
              {cameraPreviewUrl ? (
                <div className="relative">
                  <img
                    src={cameraPreviewUrl}
                    alt="カメラで撮影"
                    className="h-24 w-24 rounded-lg border border-[var(--border)] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(cameraPreviewUrl);
                      setCameraPreviewUrl(null);
                    }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
                    aria-label="カメラ画像を削除"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]">
                  —
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-[var(--muted)]">フォト</span>
              {photoPreviewUrl ? (
                <div className="relative">
                  <img
                    src={photoPreviewUrl}
                    alt="フォトライブラリから選択"
                    className="h-24 w-24 rounded-lg border border-[var(--border)] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(photoPreviewUrl);
                      setPhotoPreviewUrl(null);
                    }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
                    aria-label="フォト画像を削除"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]">
                  —
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onDetected={(value) => {
          handlePartNoChange(value);
          setBarcodeScannerOpen(false);
        }}
      />

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">入庫一覧</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-[var(--foreground)]">
              <span className="text-[var(--muted)]">開始日</span>
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-[var(--foreground)]">
              <span className="text-[var(--muted)]">終了日</span>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (!filterStart.trim() || !filterEnd.trim()) {
                  alert("開始日と終了日を選択してください。");
                  return;
                }
                const filtered = list.filter((r) => {
                  const d = r.inboundDate || "";
                  if (d < filterStart) return false;
                  if (d > filterEnd) return false;
                  return true;
                });
                const total = filtered.reduce(
                  (sum, r) => sum + (Number(r.inboundQty) || 0) * (Number(r.partCost) || 0),
                  0
                );
                setPartCostTotal(total);
              }}
              className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--border)]/50"
            >
              月別部品仕入額
            </button>
            {partCostTotal !== null && (
              <span className="text-sm text-[var(--primary)]">
                仕入額: ¥{Math.round(partCostTotal * 0.6).toLocaleString()}
                <span className="ml-1.5 text-[var(--muted)] font-normal">（定価ではなく実際の仕入金額です。）</span>
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--border)]/30">
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">部品品番</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">入庫場所</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">部品名称</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">入庫日</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-right">入庫数</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">入庫担当者</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">出庫担当者</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-right">単価</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-right">合計</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">注文番号（オーダーNo）</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left w-16">削除</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered =
                  filterStart || filterEnd
                    ? list.filter((r) => {
                        const d = r.inboundDate || "";
                        if (filterStart && d < filterStart) return false;
                        if (filterEnd && d > filterEnd) return false;
                        return true;
                      })
                    : list;
                return filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-4 text-center text-[var(--muted)]">
                      {list.length === 0 ? "データがありません。上記フォームで登録してください。" : "指定期間にデータがありません"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const subtotal = (Number(r.partCost) || 0) * (Number(r.inboundQty) || 0);
                    return (
                  <tr key={r.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{r.partNo}</td>
                    <td className="px-3 py-2">{r.inboundPlace ?? "—"}</td>
                    <td className="px-3 py-2">{r.partName ?? ""}</td>
                    <td className="px-3 py-2">{r.inboundDate}</td>
                    <td className="px-3 py-2 text-right">{r.inboundQty ?? "—"}</td>
                    <td className="px-3 py-2">{r.inboundPerson ?? "—"}</td>
                    <td className="px-3 py-2">{r.outboundPerson ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {r.partCost != null ? Number(r.partCost).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{subtotal ? subtotal.toLocaleString() : "—"}</td>
                    <td className="px-3 py-2">{r.orderNo ?? "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          deleteInbound(r.id);
                          setList(getAllInbound());
                        }}
                        className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                    );
                  })
                );
              })()}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
