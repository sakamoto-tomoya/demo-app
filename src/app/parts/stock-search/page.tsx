"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  getVehiclePartsMergedByPartNo,
  getVehiclePartsByPartNo,
  deleteVehiclePartByPartNo,
  getInboundByPartNo,
  getOutboundByPartNo,
  getOrderRemainingRaw,
  type VehiclePartRecord,
} from "@/lib/parts-store";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

const PARTS_ORDER_URL = process.env.NEXT_PUBLIC_PARTS_ORDER_URL ?? "";

export default function PartsStockSearchPage() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [list, setList] = useState<VehiclePartRecord[]>([]);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [expandedPartNo, setExpandedPartNo] = useState<string | null>(null);

  const refreshList = () => {
    const merged = getVehiclePartsMergedByPartNo();
    if (!query.trim()) {
      setList(merged);
      return;
    }
    const q = query.trim().toLowerCase();
    setList(
      merged.filter(
        (r) =>
          (r.partNo ?? "").toLowerCase().includes(q) ||
          (r.partName ?? "").toLowerCase().includes(q) ||
          (r.storagePlaceVehicle ?? "").toLowerCase().includes(q)
      )
    );
  };

  useEffect(() => {
    refreshList();
  }, [query, pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") refreshList();
    };
    const onFocus = () => refreshList();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [query, pathname]);

  const handleDelete = (partNo: string) => {
    if (confirm("この部品を削除しますか？")) {
      deleteVehiclePartByPartNo(partNo);
      refreshList();
    }
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
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">在庫検索</h1>
      </div>
      <p className="text-[var(--muted)]">
        部品品番・部品名称・保管場所で検索します。
      </p>

      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">検索</span>
        <div className="mt-1 flex max-w-md min-w-0 gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="部品品番・部品名称・保管場所"
            className="block min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
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

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--border)]/30">
              <th className="border-b border-[var(--border)] px-3 py-2 text-left w-12"></th>
              <th className="border-b border-[var(--border)] px-3 py-2 text-left">部品品番</th>
              <th className="border-b border-[var(--border)] px-3 py-2 text-left">部品名称</th>
              <th className="border-b border-[var(--border)] px-3 py-2 text-right">部品数</th>
              <th className="border-b border-[var(--border)] px-3 py-2 text-left w-16">削除</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-[var(--muted)]">
                  {query.trim() ? "該当なし" : "データがありません"}
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const partNo = r.partNo ?? "";
                const isExpanded = expandedPartNo === partNo;
                const inbounds = getInboundByPartNo(partNo);
                const outbounds = getOutboundByPartNo(partNo);
                const vehicleParts = getVehiclePartsByPartNo(partNo);
                const storageDisplay = vehicleParts
                  .filter((vp) => (vp.storagePlaceVehicle ?? "").trim())
                  .map((vp) => {
                    const place = vp.storagePlaceVehicle?.trim() ?? "";
                    const qty = vp.quantity ?? 0;
                    return place ? `${place}${qty > 0 ? `（${qty}個）` : ""}` : null;
                  })
                  .filter(Boolean) as string[];
                const uniqueStorageDisplay = storageDisplay.length > 0 ? storageDisplay.join("、") : "—";
                return (
                  <React.Fragment key={r.id ?? partNo}>
                    <tr className="border-b border-[var(--border)]">
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => setExpandedPartNo(isExpanded ? null : partNo)}
                          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                          title={isExpanded ? "詳細を閉じる" : "詳細を見る"}
                        >
                          {isExpanded ? "－" : "詳細"}
                        </button>
                      </td>
                      <td className="px-3 py-2">{r.partNo}</td>
                      <td className="px-3 py-2">{r.partName ?? ""}</td>
                      <td className="px-3 py-2 text-right">{r.quantity ?? "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(partNo)}
                          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-[var(--border)] bg-[var(--card)]/50">
                        <td colSpan={5} className="px-3 py-4">
                          <div className="space-y-4 text-xs">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                              <div className="min-w-0 flex-1">
                                <p className="mb-2 font-medium text-[var(--foreground)]">入庫情報</p>
                                {inbounds.length === 0 ? (
                                  <p className="text-[var(--muted)]">入荷履歴はありません</p>
                                ) : (
                                  <table className="w-full max-w-2xl border-collapse border border-[var(--border)]">
                                    <thead>
                                      <tr className="bg-[var(--border)]/30">
                                        <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">入庫日</th>
                                        <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">オーダーNo</th>
                                        <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">部品名称</th>
                                        <th className="border-b border-[var(--border)] px-2 py-1.5 text-right">入庫数</th>
                                        <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">入庫担当</th>
                                        <th className="border-b border-[var(--border)] px-2 py-1.5 text-right">残り</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {inbounds.map((i) => {
                                        const orderNo = i.orderNo ?? "";
                                        const remaining = orderNo ? getOrderRemainingRaw(partNo, orderNo) : null;
                                        return (
                                          <tr key={i.id}>
                                            <td className="border-b border-[var(--border)] px-2 py-1.5 whitespace-nowrap">{i.inboundDate}</td>
                                            <td className="border-b border-[var(--border)] px-2 py-1.5">{orderNo || "—"}</td>
                                            <td className="border-b border-[var(--border)] px-2 py-1.5">{i.partName ?? "—"}</td>
                                            <td className="border-b border-[var(--border)] px-2 py-1.5 text-right tabular-nums">{i.inboundQty}</td>
                                            <td className="border-b border-[var(--border)] px-2 py-1.5">{i.inboundPerson ?? "—"}</td>
                                            <td className="border-b border-[var(--border)] px-2 py-1.5 text-right tabular-nums">{remaining !== null ? remaining : "—"}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="mb-2 font-medium text-[var(--foreground)]">出庫情報</p>
                              {outbounds.length === 0 ? (
                                <p className="text-[var(--muted)]">出庫履歴はありません</p>
                              ) : (
                                <table className="w-full max-w-2xl border-collapse border border-[var(--border)]">
                                  <thead>
                                    <tr className="bg-[var(--border)]/30">
                                      <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">出庫日</th>
                                      <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">受付番号</th>
                                      <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">オーダーNo</th>
                                      <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">部品名称</th>
                                      <th className="border-b border-[var(--border)] px-2 py-1.5 text-right">出庫数</th>
                                      <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">出庫担当者</th>
                                      <th className="border-b border-[var(--border)] px-2 py-1.5 text-left">保管場所</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {outbounds.map((o) => (
                                      <tr key={o.id}>
                                        <td className="border-b border-[var(--border)] px-2 py-1.5 whitespace-nowrap">{o.outboundDate}</td>
                                        <td className="border-b border-[var(--border)] px-2 py-1.5">{o.receptionNo ?? "—"}</td>
                                        <td className="border-b border-[var(--border)] px-2 py-1.5">{o.orderNo ?? "—"}</td>
                                        <td className="border-b border-[var(--border)] px-2 py-1.5">{o.partName ?? "—"}</td>
                                        <td className="border-b border-[var(--border)] px-2 py-1.5 text-right tabular-nums">{o.outboundQty}</td>
                                        <td className="border-b border-[var(--border)] px-2 py-1.5">{o.outboundPerson ?? "—"}</td>
                                        <td className="border-b border-[var(--border)] px-2 py-1.5">{o.storagePlace ?? o.storagePlaceVehicle ?? "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 font-medium text-[var(--foreground)]">在庫の保管場所</p>
                              <p className="text-[var(--muted)]">{uniqueStorageDisplay}</p>
                            </div>
                            <div>
                              <p className="font-medium text-[var(--foreground)]">
                                現在残り: <span className="font-semibold tabular-nums">{r.quantity ?? 0}</span> 個
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onDetected={(value) => {
          setQuery(value);
          setBarcodeScannerOpen(false);
        }}
      />
    </div>
  );
}
