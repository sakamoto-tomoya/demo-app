"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getAllOutbound, addOutbound, deleteOutbound, clearAllOutbound, decrementVehiclePartByPartNo, findVehiclePartByPartNo, findPartsMasterByPartNo, getInboundByPartNo, getOutboundByPartNo, getOrderInboundQty, getOrderRemainingRaw, getRemainingQtyByOrderNo, normalizePartNo, type OutboundRecord } from "@/lib/parts-store";
import { formatYen, parsePrice } from "@/lib/price-utils";
import { getAssigneeNames } from "@/lib/settings";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

/** 出庫担当者名のプルダウン選択肢（固定＋設定から） */
const OUTBOUND_PERSON_OPTIONS = ["坂本", "伊野", "加藤"];

/** 入荷場所・保管場所・戻し先の選択肢 */
const STORAGE_PLACE_OPTIONS = [
  { value: "", label: "未選択" },
  { value: "事務所", label: "事務所" },
  { value: "研修センター", label: "研修センター" },
  { value: "坂本の車載在庫", label: "坂本の車載在庫" },
  { value: "伊野の車載在庫", label: "伊野の車載在庫" },
  { value: "加藤の車載在庫", label: "加藤の車載在庫" },
] as const;

/** 出庫担当者名 → 車載在庫ラベル */
const ASSIGNEE_TO_VEHICLE_STORAGE: Record<string, string> = {
  坂本: "坂本の車載在庫",
  伊野: "伊野の車載在庫",
  加藤: "加藤の車載在庫",
};

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ログイン中のユーザー名（出庫担当者は自分以外選べない） */
const useCurrentUserName = () => {
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { name?: string | null; email?: string | null } | null) => {
        if (data?.name?.trim()) setCurrentUserName(data.name.trim());
        else if (data?.email?.trim()) setCurrentUserName(data.email.trim());
        else setCurrentUserName(null);
      })
      .catch(() => setCurrentUserName(null))
      .finally(() => setLoading(false));
  }, []);
  return { currentUserName, loading };
};

export default function PartsOutboundPage() {
  const [list, setList] = useState<OutboundRecord[]>([]);
  const [saved, setSaved] = useState(false);
  const [assigneeNames, setAssigneeNames] = useState<string[]>([]);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const parkingReceiptInputRef = useRef<HTMLInputElement>(null);
  const { currentUserName, loading: currentUserLoading } = useCurrentUserName();
  const BILLING_TYPE_OPTIONS = ["直収", "現地請求", "代理店請求", "無料", "無償Y（延長保証）"];

  const [form, setForm] = useState({
    partNo: "",
    outboundDate: todayYYYYMMDD(),
    partName: "",
    outboundQty: 0,
    outboundPerson: "",
    receptionNo: "",
    orderNo: "",
    partCost: "",
    billingType: "",
    parkingUsed: false,
    parkingFee: "",
    parkingReceiptImageDataUrl: "",
    storagePlace: "",
    storagePlaceVehicle: "",
    storageBeforeWork: "",
    storageBeforeWorkVehicle: "",
    /** 使用の有無（入荷場所選択時のみ。null=未選択, true=使用した, false=使用していない） */
    storageUseSelected: null as boolean | null,
    /** 使用した場合：自分の車載在庫として登録する / 他の保管場所に戻す */
    storageUseDestination: "" as "" | "vehicle" | "return",
    /** 使用した場合（他の保管場所に戻す）：戻し先 */
    returnToPlace: "",
    /** チェック時は作業前保管場所・作業前保管場所（車載）を表示しない */
    hideBeforeWorkStorage: false,
  });

  useEffect(() => {
    setAssigneeNames(getAssigneeNames());
    setList(getAllOutbound());
  }, []);

  /** ログインユーザーが取れたら出庫担当者を自分に固定 */
  useEffect(() => {
    if (currentUserLoading || currentUserName == null) return;
    setForm((prev) => ({
      ...prev,
      outboundPerson: currentUserName,
    }));
  }, [currentUserName, currentUserLoading]);

  /** 部品品番入力時、部品マスタ→車載部品→入庫履歴の順で部品名称・部品代を反映。マスタにヒットしたら partNo/partName/partCost はマスタの正規値で上書き。オーダー番号は入庫残（FIFO）の先頭を自動転記。 */
  const handlePartNoChange = (value: string) => {
    setForm((p) => {
      const next = { ...p, partNo: value };
      if (normalizePartNo(value) === "582145100") next.partName = "ボタン軸";
      const fromMaster = findPartsMasterByPartNo(value);
      if (fromMaster) {
        next.partNo = fromMaster.partNo ?? value;
        next.partName = (fromMaster.partName ?? "").trim() || next.partNo;
        const cost = fromMaster.partCost != null ? parsePrice(fromMaster.partCost) : null;
        next.partCost = cost !== null ? String(cost) : "";
      } else {
        const fromVehicle = findVehiclePartByPartNo(value);
        if (fromVehicle?.partName?.trim()) next.partName = fromVehicle.partName.trim();
        const inbounds = getInboundByPartNo(value);
        const latestInbound = inbounds[0];
        if (latestInbound?.partCost != null) next.partCost = String(latestInbound.partCost);
      }
      const remainingByOrder = getRemainingQtyByOrderNo(value);
      const firstOrder = remainingByOrder[0];
      if (firstOrder?.orderNo !== undefined) next.orderNo = firstOrder.orderNo;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserLoading && !currentUserName) {
      alert("出庫登録にはログインが必要です。");
      return;
    }
    if (currentUserName && form.outboundPerson !== currentUserName) {
      alert("出庫担当者はログイン中の担当者のみ選択できます。");
      return;
    }
    if (!form.storagePlace?.trim()) {
      alert("入荷場所・保管場所を選択してください。");
      return;
    }
    if (form.storagePlace && form.storageUseSelected === null) {
      alert("入荷場所・保管場所を選択した場合は、使用の有無を選択してください。");
      return;
    }
    if (form.storagePlace && form.storageUseSelected === false) {
      if (!form.storageUseDestination) {
        alert("使用していない場合は、自分の車載在庫として登録するか、他の保管場所に戻すかを選択してください。");
        return;
      }
      if (form.storageUseDestination === "return" && !form.returnToPlace) {
        alert("他の保管場所に戻す場合は、戻し先を選択してください。");
        return;
      }
    }
    const qty = Number(form.outboundQty) || 0;
    const partNo = form.partNo.trim();
    if (!partNo) {
      alert("部品品番を入力してください。");
      return;
    }
    const inbounds = getInboundByPartNo(partNo);
    const outbounds = getOutboundByPartNo(partNo);
    const inboundTotal = inbounds.reduce((s, i) => s + (Number(i.inboundQty) || 0), 0);
    const outboundTotal = outbounds.reduce((s, o) => s + (Number(o.outboundQty) || 0), 0);
    const stock = inboundTotal - outboundTotal;
    if (stock < qty) {
      alert(
        `出庫登録できません。在庫（入庫−出庫）は${stock}個です。${qty}個の出庫は登録できません。`
      );
      return;
    }
    const orderNo = form.orderNo ?? "";
    const remainingByOrder = getRemainingQtyByOrderNo(partNo);
    const orderRemaining = remainingByOrder.find((x) => x.orderNo === orderNo);
    const currentRemaining = orderRemaining?.remaining ?? 0;
    if (orderNo && orderRemaining !== undefined && currentRemaining === 0) {
      alert(
        "このオーダー番号では残りが0です。次のオーダーNOと受付番号を入力して登録してください。"
      );
      return;
    }
    const qtyToRegister = qty;
    if (qty > currentRemaining && orderNo && currentRemaining > 0) {
      if (
        !window.confirm(
          `オーダー番号「${orderNo}」では残り${currentRemaining}個です。このまま登録すると在庫判定がマイナスになります。登録しますか？`
        )
      ) {
        return;
      }
    }
    const isUnused = form.storageUseSelected === false;
    const storagePlaceVehicle =
      form.storagePlaceVehicle ||
      (isUnused && form.storageUseDestination === "vehicle" && form.outboundPerson
        ? ASSIGNEE_TO_VEHICLE_STORAGE[form.outboundPerson] ?? ""
        : "");
    const returnTo = isUnused && form.storageUseDestination === "return" ? form.returnToPlace : "";
    const isReturnOfficeOrCenter = returnTo === "事務所" || returnTo === "研修センター";
    addOutbound({
      partNo: form.partNo,
      outboundDate: form.outboundDate,
      partName: form.partName,
      outboundQty: qtyToRegister,
      outboundPerson: form.outboundPerson,
      receptionNo: form.receptionNo || undefined,
      orderNo: form.orderNo || undefined,
      partCost: parsePrice(form.partCost) ?? undefined,
      billingType: form.billingType || undefined,
      parkingFee: form.parkingUsed && form.parkingFee ? Number(form.parkingFee) : undefined,
      parkingReceiptImageDataUrl: form.parkingUsed ? form.parkingReceiptImageDataUrl || undefined : undefined,
      storagePlace: form.storagePlace || undefined,
      storagePlaceVehicle: storagePlaceVehicle || undefined,
      storageBeforeWork: isReturnOfficeOrCenter ? returnTo : (form.hideBeforeWorkStorage ? undefined : (form.storageBeforeWork || undefined)),
      storageBeforeWorkVehicle: !isReturnOfficeOrCenter && returnTo ? returnTo : (form.hideBeforeWorkStorage ? undefined : (form.storageBeforeWorkVehicle || undefined)),
    });
    decrementVehiclePartByPartNo(form.partNo.trim(), qtyToRegister);
    setList(getAllOutbound());
    setForm((p) => ({
      ...p,
      partNo: "",
      partName: "",
      outboundQty: 0,
      outboundPerson: currentUserName ?? p.outboundPerson,
      receptionNo: "",
      orderNo: "",
      partCost: "",
      billingType: "",
      parkingUsed: false,
      parkingFee: "",
      parkingReceiptImageDataUrl: "",
      storageUseSelected: null,
      storageUseDestination: "",
      returnToPlace: "",
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/parts"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
          >
            戻る
          </Link>
          <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">出庫</h1>
        </div>
        {list.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("出庫履歴をすべて削除します。よろしいですか？")) {
                clearAllOutbound();
                setList([]);
              }
            }}
            className="rounded-lg border border-[var(--alert)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--alert)] hover:bg-[var(--alert)]/10"
          >
            出庫履歴をすべて削除
          </button>
        )}
      </div>
      <p className="text-[var(--muted)]">部品の出庫を登録します。（Power Apps pms_出庫管理と同じ項目）</p>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">部品品番 *</span>
            <div className="mt-1 flex min-w-0 gap-2">
              <input
                type="text"
                value={form.partNo}
                onChange={(e) => handlePartNoChange(e.target.value)}
                onBlur={(e) => handlePartNoChange(e.target.value)}
                className="block min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
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
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">出庫日 *</span>
            <input
              type="date"
              value={form.outboundDate}
              onChange={(e) => setForm((p) => ({ ...p, outboundDate: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">部品名称</span>
            <input
              type="text"
              value={form.partName}
              onChange={(e) => setForm((p) => ({ ...p, partName: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">出庫数 *</span>
            <input
              type="number"
              value={form.outboundQty || ""}
              onChange={(e) => setForm((p) => ({ ...p, outboundQty: Number(e.target.value) || 0 }))}
              className={inputClass}
              min={0}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">出庫担当者名</span>
            {currentUserLoading ? (
              <div className={`${inputClass} bg-[var(--border)]/30`}>読み込み中…</div>
            ) : currentUserName ? (
              <select
                value={form.outboundPerson}
                onChange={(e) => setForm((p) => ({ ...p, outboundPerson: e.target.value }))}
                className={inputClass}
                aria-describedby="outbound-person-security"
              >
                <option value={currentUserName}>{currentUserName}</option>
              </select>
            ) : (
              <div className={`${inputClass} bg-[var(--border)]/30`} id="outbound-person-security">
                未ログインのため選択できません
              </div>
            )}
            {currentUserName && (
              <p id="outbound-person-security" className="mt-1 text-xs text-[var(--muted)]">
                セキュリティのため、ログイン中の担当者のみ登録できます
              </p>
            )}
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">１つあたりの単価を入力してください 例：800</span>
            <input
              type="number"
              value={form.partCost}
              onChange={(e) => setForm((p) => ({ ...p, partCost: e.target.value }))}
              className={inputClass}
              min={0}
              placeholder="例：800"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">受付番号</span>
            <input
              type="text"
              value={form.receptionNo}
              onChange={(e) => setForm((p) => ({ ...p, receptionNo: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">オーダー番号</span>
            <input
              type="text"
              value={form.orderNo}
              onChange={(e) => setForm((p) => ({ ...p, orderNo: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">合計（部品代×出庫数）</span>
            <input
              type="number"
              readOnly
              value={(Number(form.partCost) || 0) * (Number(form.outboundQty) || 0)}
              className={`${inputClass} bg-[var(--border)]/30`}
              min={0}
              tabIndex={-1}
              aria-label="部品代×出庫数で自動反映"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">部品代×出庫数で自動反映されます</p>
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">請求区分</span>
            <select
              value={form.billingType}
              onChange={(e) => setForm((p) => ({ ...p, billingType: e.target.value }))}
              className={inputClass}
            >
              <option value="">未選択</option>
              {BILLING_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">元々の保管場所は？</span>
            <select
              value={form.storagePlace}
              onChange={(e) =>
                setForm((p) => {
                  const nextPlace = e.target.value;
                  return {
                    ...p,
                    storagePlace: nextPlace,
                    storageUseSelected: nextPlace ? p.storageUseSelected : null,
                    ...(nextPlace ? {} : { storageUseDestination: "", returnToPlace: "" }),
                  };
                })
              }
              className={inputClass}
            >
              <option value="">未選択</option>
              <option value="事務所">事務所</option>
              <option value="研修センター">研修センター</option>
              <option value="坂本の車載在庫">坂本の車載在庫</option>
              <option value="伊野の車載在庫">伊野の車載在庫</option>
              <option value="加藤の車載在庫">加藤の車載在庫</option>
            </select>
            {form.storagePlace ? (
              <div className="mt-3">
                <span className="block text-sm font-medium text-[var(--foreground)]">使用の有無</span>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.storageUseSelected === true}
                      onChange={() =>
                        setForm((p) => ({
                          ...p,
                          storageUseSelected: true,
                          storageUseDestination: "",
                          returnToPlace: "",
                        }))
                      }
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">使用した</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.storageUseSelected === false}
                    onChange={() =>
                      setForm((p) => ({ ...p, storageUseSelected: false }))
                    }
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">使用していない</span>
                  </label>
                </div>
                {form.storageUseSelected === null && (
                  <p className="mt-1 text-xs text-[var(--alert)]">使用の有無を選択してください</p>
                )}
                {form.storageUseSelected === false && (
                  <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                    <p className="mb-3 text-sm font-medium text-[var(--foreground)]">
                      自分の車載在庫として登録するか、他の保管場所に戻すかを選択してください。
                    </p>
                    <div className="mb-3 flex flex-col gap-2">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="storageUseDestination"
                          checked={form.storageUseDestination === "vehicle"}
                          onChange={() =>
                            setForm((p) => ({ ...p, storageUseDestination: "vehicle", returnToPlace: "" }))
                          }
                          className="h-4 w-4 border-[var(--border)]"
                        />
                        <span className="text-sm text-[var(--foreground)]">
                          自分の車載在庫（{form.outboundPerson || "—"}の車載）として登録する
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="storageUseDestination"
                          checked={form.storageUseDestination === "return"}
                          onChange={() =>
                            setForm((p) => ({ ...p, storageUseDestination: "return" }))
                          }
                          className="h-4 w-4 border-[var(--border)]"
                        />
                        <span className="text-sm text-[var(--foreground)]">他の保管場所に戻す</span>
                      </label>
                    </div>
                    {form.storageUseDestination === "return" && (
                      <label className="block">
                        <span className="text-sm text-[var(--foreground)]">戻し先</span>
                        <select
                          value={form.returnToPlace}
                          onChange={(e) => setForm((p) => ({ ...p, returnToPlace: e.target.value }))}
                          className={inputClass}
                        >
                          {STORAGE_PLACE_OPTIONS.map((opt) => (
                            <option key={opt.value || "empty"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">パーキングを使用しましたか？</span>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="parkingUsed"
                  checked={form.parkingUsed}
                  onChange={() =>
                    setForm((p) => ({ ...p, parkingUsed: true }))
                  }
                  className="h-4 w-4 border-[var(--border)]"
                />
                <span className="text-sm text-[var(--foreground)]">使用した</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="parkingUsed"
                  checked={!form.parkingUsed}
                  onChange={() =>
                    setForm((p) => ({
                      ...p,
                      parkingUsed: false,
                      parkingFee: "",
                      parkingReceiptImageDataUrl: "",
                    }))
                  }
                  className="h-4 w-4 border-[var(--border)]"
                />
                <span className="text-sm text-[var(--foreground)]">していない</span>
              </label>
            </div>
            {form.parkingUsed && (
                <div className="mt-3 flex min-w-0 gap-2">
                  <input
                    type="number"
                    value={form.parkingFee}
                    onChange={(e) => setForm((p) => ({ ...p, parkingFee: e.target.value }))}
                    className="block min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                    min={0}
                    placeholder="パーキング代を入力してください 例:800"
                  />
                  <input
                    ref={parkingReceiptInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        setForm((p) => ({ ...p, parkingReceiptImageDataUrl: (reader.result as string) ?? "" }));
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                    className="sr-only"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.billingType) {
                        alert("請求区分を選択してください。");
                        return;
                      }
                      parkingReceiptInputRef.current?.click();
                    }}
                    className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                    title="パーキングレシートを撮影"
                  >
                    レシート撮影
                  </button>
                </div>
              )}
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
          >
            登録
          </button>
          {saved && <span className="text-sm text-[var(--muted)]">登録しました</span>}
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-base font-semibold text-[var(--foreground)]">出庫一覧</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--border)]/30">
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">部品品番</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">出庫日</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">部品名称</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-right">入庫時登録数</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-right">出庫時登録数</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">在庫判定</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">出庫担当者名</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">受付番号</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">オーダー番号</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-right">部品代</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">請求区分</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-right">パーキング料金</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">レシート撮影</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">元々の保管場所は？</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">保管場所</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">保管場所（車載）</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">作業前保管場所</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">作業前保管場所（車載）</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">削除</th>
              </tr>
            </thead>
            <tbody>
              {(form.outboundQty > 0 || form.partNo.trim()) && (
                <tr className="bg-[var(--border)]/20">
                  <td className="px-3 py-2">{form.partNo || "—"}</td>
                  <td className="px-3 py-2">{form.outboundDate}</td>
                  <td className="px-3 py-2">{form.partName || "—"}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {form.orderNo?.trim() ? getOrderInboundQty(form.partNo, form.orderNo) || "—" : (form.outboundQty || "")}
                  </td>
                  <td className="px-3 py-2 text-right">{form.outboundQty || ""}</td>
                  <td className="px-3 py-2">
                    {form.orderNo?.trim() && form.partNo.trim()
                      ? (() => {
                          const inbound = getOrderInboundQty(form.partNo, form.orderNo);
                          const currentOut = list
                            .filter((x) => (x.orderNo ?? "").trim() === (form.orderNo ?? "").trim())
                            .reduce((s, x) => s + (x.outboundQty ?? 0), 0);
                          const afterQty = currentOut + (Number(form.outboundQty) || 0);
                          const remaining = inbound - afterQty;
                          const receptionNo = (form.receptionNo ?? "").trim();
                          const sameReceptionCount =
                            list.filter((x) => (x.receptionNo ?? "").trim() === receptionNo).length +
                            (receptionNo !== "" ? 1 : 0);
                          const sameReceptionTwiceOrMore = sameReceptionCount >= 2;
                          const showOver = remaining < 0 && !sameReceptionTwiceOrMore;
                          const showZero = remaining < 0 && sameReceptionTwiceOrMore;
                          if (showZero) return 0;
                          return showOver ? (
                            <span className="font-semibold text-red-600">{remaining}</span>
                          ) : (
                            "—"
                          );
                        })()
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{form.outboundPerson || "—"}</td>
                  <td className="px-3 py-2">{form.receptionNo || "—"}</td>
                  <td className="px-3 py-2">{form.orderNo || "—"}</td>
                  <td className="px-3 py-2 text-right">{form.partCost != null && form.partCost !== "" ? form.partCost : ""}</td>
                  <td className="px-3 py-2">{form.billingType || "—"}</td>
                  <td className="px-3 py-2 text-right">{form.parkingFee != null && form.parkingFee !== "" ? form.parkingFee : ""}</td>
                  <td className="px-3 py-2">
                    {form.parkingReceiptImageDataUrl ? (
                      <img src={form.parkingReceiptImageDataUrl} alt="" className="max-h-8 w-auto rounded" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{form.storagePlace || "—"}</td>
                  <td className="px-3 py-2">{form.storagePlace || "—"}</td>
                  <td className="px-3 py-2">{form.storagePlaceVehicle || "—"}</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2 text-[var(--muted)] text-xs">登録予定</td>
                </tr>
              )}
              {list.length === 0 && !(form.outboundQty > 0 || form.partNo.trim()) ? (
                <tr>
                  <td colSpan={19} className="px-3 py-4 text-center text-[var(--muted)]">
                    出庫履歴はありません
                  </td>
                </tr>
              ) : (
                list.map((r, index) => (
                  <tr key={r.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{r.partNo}</td>
                    <td className="px-3 py-2">{r.outboundDate}</td>
                    <td className="px-3 py-2">{r.partName}</td>
                    <td className="px-3 py-2 text-right">
                      {r.orderNo?.trim() ? getOrderInboundQty(r.partNo, r.orderNo) || "—" : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{r.outboundQty}</td>
                    <td className="px-3 py-2">
                      {(() => {
                        const orderNo = r.orderNo ?? "";
                        const receptionNo = (r.receptionNo ?? "").trim();
                        const remaining = orderNo ? getOrderRemainingRaw(r.partNo, orderNo) : null;
                        const isOver = remaining !== null && remaining < 0;
                        const sameReceptionCount = list.filter(
                          (x) => (x.receptionNo ?? "").trim() === receptionNo
                        ).length;
                        const sameReceptionTwiceOrMore = receptionNo !== "" && sameReceptionCount >= 2;
                        if (sameReceptionTwiceOrMore && isOver) return 0;
                        return isOver ? (
                          <span className="font-semibold text-red-600">{remaining}</span>
                        ) : (
                          "—"
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2">{r.outboundPerson}</td>
                    <td className="px-3 py-2">{r.receptionNo ?? ""}</td>
                    <td className="px-3 py-2">
                      {(() => {
                        const orderNo = r.orderNo ?? "";
                        const receptionNo = (r.receptionNo ?? "").trim();
                        const remaining = orderNo ? getOrderRemainingRaw(r.partNo, orderNo) : null;
                        const isOver = remaining !== null && remaining < 0;
                        const sameReceptionCount = list.filter(
                          (x) => (x.receptionNo ?? "").trim() === receptionNo
                        ).length;
                        const sameReceptionTwiceOrMore = receptionNo !== "" && sameReceptionCount >= 2;
                        const showOver = isOver && !sameReceptionTwiceOrMore;
                        const showZero = isOver && sameReceptionTwiceOrMore;
                        return (
                          <span className={showOver || showZero ? "flex flex-col gap-0.5" : ""}>
                            <span>{orderNo || "—"}</span>
                            {showOver && (
                              <span
                                className="font-semibold text-red-600"
                                title="このオーダー番号は入庫数を超えて出庫登録されています。入庫数と出庫数を確認してください。"
                              >
                                {remaining}
                              </span>
                            )}
                            {showZero && <span>0</span>}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatYen(r.partCost)}</td>
                    <td className="px-3 py-2">{r.billingType ?? ""}</td>
                    <td className="px-3 py-2 text-right">{r.parkingFee != null ? r.parkingFee : ""}</td>
                    <td className="px-3 py-2">
                      {r.parkingReceiptImageDataUrl ? (
                        <a
                          href={r.parkingReceiptImageDataUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block"
                        >
                          <img
                            src={r.parkingReceiptImageDataUrl}
                            alt="パーキングレシート"
                            className="max-h-16 w-auto rounded border border-[var(--border)] object-contain"
                          />
                        </a>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.storagePlace ?? ""}</td>
                    <td className="px-3 py-2">{r.storagePlace ?? ""}</td>
                    <td className="px-3 py-2">{r.storagePlaceVehicle ?? ""}</td>
                    <td className="px-3 py-2">{r.storageBeforeWork ?? ""}</td>
                    <td className="px-3 py-2">{r.storageBeforeWorkVehicle ?? ""}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("この出庫履歴を削除してもよろしいですか？")) {
                            if (deleteOutbound(r.id)) setList(getAllOutbound());
                          }
                        }}
                        className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onDetected={(value) => {
          handlePartNoChange(value);
          setBarcodeScannerOpen(false);
        }}
      />
    </div>
  );
}
