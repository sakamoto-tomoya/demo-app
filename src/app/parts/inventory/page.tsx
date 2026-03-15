"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getVehiclePartsMergedByPartNo,
  addOrIncrementVehiclePart,
  setVehiclePartQuantityByPartNo,
  deleteVehiclePartByPartNo,
  type VehiclePartRecord,
} from "@/lib/parts-store";

const inputClass =
  "block w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]";

export default function PartsInventoryPage() {
  const [list, setList] = useState<VehiclePartRecord[]>([]);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    partNo: "",
    storagePlaceVehicle: "",
    partName: "",
    quantity: 0,
  });

  useEffect(() => {
    setList(getVehiclePartsMergedByPartNo());
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addOrIncrementVehiclePart({
      partNo: form.partNo,
      storagePlaceVehicle: form.storagePlaceVehicle,
      partName: form.partName,
      quantity: Number(form.quantity) || 0,
    });
    setList(getVehiclePartsMergedByPartNo());
    setForm((p) => ({ ...p, partNo: "", partName: "", quantity: 0 }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateQty = (partNo: string, quantity: number) => {
    setVehiclePartQuantityByPartNo(partNo, quantity);
    setList(getVehiclePartsMergedByPartNo());
  };

  const handleDelete = (partNo: string) => {
    if (confirm("この部品を削除しますか？")) {
      deleteVehiclePartByPartNo(partNo);
      setList(getVehiclePartsMergedByPartNo());
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
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">棚卸</h1>
      </div>
      <p className="text-[var(--muted)]">
        車載部品の在庫数（部品数）を確認・更新します。（Power Apps pms_車載部品）
      </p>

      <form onSubmit={handleAdd} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">新規登録</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">部品品番 *</span>
            <input
              type="text"
              value={form.partNo}
              onChange={(e) => setForm((p) => ({ ...p, partNo: e.target.value }))}
              className={inputClass}
              required
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[var(--foreground)]">保管場所（車載）</span>
            <input
              type="text"
              value={form.storagePlaceVehicle}
              onChange={(e) => setForm((p) => ({ ...p, storagePlaceVehicle: e.target.value }))}
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
            <span className="text-sm font-medium text-[var(--foreground)]">部品数 *</span>
            <input
              type="number"
              value={form.quantity || ""}
              onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) || 0 }))}
              className={inputClass}
              min={0}
            />
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
          >
            追加
          </button>
          {saved && <span className="text-sm text-[var(--muted)]">追加しました</span>}
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-base font-semibold text-[var(--foreground)]">車載部品一覧（実数入力で更新）</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--border)]/30">
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">部品品番</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">保管場所</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">部品名称</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-right">部品数</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">更新</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left w-16">削除</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-[var(--muted)]">
                    データがありません。上記フォームで追加してください。
                  </td>
                </tr>
              ) : (
                list.map((r) => (
                  <tr key={r.id ?? r.partNo} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{r.partNo}</td>
                    <td className="px-3 py-2">{r.storagePlaceVehicle}</td>
                    <td className="px-3 py-2">{r.partName}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={r.quantity}
                        onChange={(e) => updateQty(r.partNo ?? "", Number(e.target.value) || 0)}
                        className={`${inputClass} w-20 text-right`}
                        min={0}
                      />
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)] text-xs">入力で保存</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(r.partNo ?? "")}
                        className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-red-50 hover:border-red-300 hover:text-red-700"
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
    </div>
  );
}
