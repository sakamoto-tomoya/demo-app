"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  getAllPartsMaster,
  importPartsMasterFromRows,
  deletePartsMaster,
  clearAllPartsMaster,
  migratePartsMasterMojibake,
  migratePartsMasterPartCost,
  getAllProductPartsKnowledge,
  addOrUpdateProductPartsKnowledge,
  deleteProductPartsKnowledge,
  formatProductPartsKnowledgeForDify,
  type PartsMasterRecord,
  type ProductPartsKnowledgeRecord,
} from "@/lib/parts-store";
import type { RegisteredPartRow } from "@/lib/parts-types";
import { parsePrice, formatYen } from "@/lib/price-utils";

const PARTS_MASTER_DIFY_DOCUMENT_ID_KEY = "gyoumukannri_parts_master_dify_document_id";
const PARTS_MASTER_DIFY_NAME = "部品マスタ一覧";
const PRODUCT_PARTS_DIFY_DOCUMENT_ID_KEY = "gyoumukannri_product_parts_dify_document_id";
const PRODUCT_PARTS_DIFY_NAME = "製品型番・製品品番_部品一覧";

/**
 * 1行をカンマまたはタブで分割。ダブルクォートで囲まれたフィールド内のカンマは分割しない。
 */
function splitCsvLine(line: string, delimiter: "," | "\t" = ","): string[] {
  if (delimiter === "\t") {
    return line.split("\t").map((c) => c.replace(/^"|"$/g, "").trim());
  }
  const cells: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let end = i + 1;
      while (end < line.length) {
        const next = line.indexOf('"', end);
        if (next === -1) break;
        if (line[next + 1] === '"') {
          end = next + 2;
          continue;
        }
        end = next;
        break;
      }
      cells.push(line.slice(i + 1, end).replace(/""/g, '"').trim());
      i = end + 1;
      if (line[i] === ",") i++;
      continue;
    }
    const comma = line.indexOf(",", i);
    if (comma === -1) {
      cells.push(line.slice(i).trim());
      break;
    }
    cells.push(line.slice(i, comma).trim());
    i = comma + 1;
  }
  return cells;
}

/**
 * メーカー品番リストの貼り付けやCSVの1行から [部品品番, 部品名称, ガス種?, 定価?] をパースする。
 * 4列: 部品品番, 部品名称, ガス種, 定価
 * 3列: 部品品番, 部品名称, 定価（ガス種なし）
 * タブ区切り・カンマ区切りに対応。ダブルクォート内のカンマは列ずれしない。
 */
function parsePartsRows(text: string): { partNo: string; partName: string; gasType?: string; partCost?: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const rows: { partNo: string; partName: string; gasType?: string; partCost?: number }[] = [];
  const delimiter = text.includes("\t") ? "\t" : ",";

  if (lines.length === 0) return rows;

  // まずヘッダー行を推定して、列名からインデックスを決める（列マッピングミスを防ぐ）
  const maybeHeaderCells = splitCsvLine(lines[0], delimiter).map((c) => (c ?? "").toString().trim());
  const headerHas = maybeHeaderCells.some((c) => ["部品名称", "ガス種", "図番", "定価"].some((k) => c.includes(k)));

  let idxPartNo = 0; // 図番
  let idxPartName = 1; // 部品名称
  let idxGasType: number | null = 2; // ガス種
  let idxPrice = 3; // 定価

  let startRow = 0;
  if (headerHas) {
    const findIdx = (keyword: string) => maybeHeaderCells.findIndex((c) => c.includes(keyword));
    // 要件通り: partNumber <- 図番, partName <- 部品名称, gasType <- ガス種, price <- 定価
    const fPartName = findIdx("部品名称");
    const fGasType = findIdx("ガス種");
    const fCaseNo = findIdx("図番"); // 図番を部品品番として扱う（現状のUI要件に合わせる）
    const fPrice = findIdx("定価");
    if (fCaseNo >= 0) idxPartNo = fCaseNo;
    if (fPartName >= 0) idxPartName = fPartName;
    if (fGasType >= 0) idxGasType = fGasType;
    if (fPrice >= 0) idxPrice = fPrice;
    startRow = 1;
  }

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i];
    const cells = splitCsvLine(line, delimiter);

    const partNo = String(cells[idxPartNo] ?? "").trim();
    if (!partNo) continue;
    const partNameRaw = String(cells[idxPartName] ?? "").trim();
    const partName = partNameRaw || partNo;

    const gasTypeRaw = idxGasType == null ? "" : String(cells[idxGasType] ?? "").trim();
    const gasType = gasTypeRaw ? gasTypeRaw : undefined;

    const rawCost = String(cells[idxPrice] ?? "").trim();
    let partCost: number | undefined;
    if (rawCost !== "") {
      const n = parsePrice(rawCost);
      if (n !== null && n >= 0 && n <= 100_000) partCost = n;
    }

    rows.push({ partNo, partName, gasType, partCost });
  }

  return rows;
}

/** 日本語（CJK）の文字数を数える */
function countCjk(s: string): number {
  const cjk = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uff00-\uffef]/g;
  const m = s.match(cjk);
  return m ? m.length : 0;
}

/** CSV/テキストのArrayBufferを文字列に。UTF-8とShift_JISの両方で解釈し、日本語が多く正しく読める方を返す。 */
function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  let best = utf8;
  let bestCount = countCjk(utf8);
  if (utf8.includes("\uFFFD")) bestCount = -1;
  try {
    const shiftJis = new TextDecoder("shift_jis").decode(buffer);
    const sjCount = countCjk(shiftJis);
    if (!shiftJis.includes("\uFFFD") && sjCount > bestCount) {
      best = shiftJis;
    }
  } catch {
    // shift_jis が未対応の環境では UTF-8 のまま
  }
  return best;
}

export default function PartsMasterPage() {
  const [list, setList] = useState<PartsMasterRecord[]>([]);
  const [importResult, setImportResult] = useState<{ added: number; updated: number } | null>(null);
  const [partsCsvImportLoading, setPartsCsvImportLoading] = useState(false);
  const [difyStatus, setDifyStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [difyMessage, setDifyMessage] = useState("");
  const [knowledgeList, setKnowledgeList] = useState<ProductPartsKnowledgeRecord[]>([]);
  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [partNosText, setPartNosText] = useState("");
  const [unitPriceInput, setUnitPriceInput] = useState("");
  const [knowledgeDifyStatus, setKnowledgeDifyStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [knowledgeDifyMessage, setKnowledgeDifyMessage] = useState("");
  const refreshList = useCallback(() => {
    setList(getAllPartsMaster());
  }, []);

  const handlePartsMasterCsvFile = async (file: File) => {
    setPartsCsvImportLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const text = decodeCsvBuffer(buf);
      const rows = parsePartsRows(text);

      // CSV読込直後の1件目
      console.log("[parts/master] CSV imported: firstRow=", rows[0]);

      // rows生成後の1件目（列マッピング確認用）
      if (rows[0]) {
        console.log(
          "[parts/master] CSV->rows mapping check:",
          "partNo=",
          rows[0].partNo,
          "partName=",
          rows[0].partName,
          "gasType=",
          rows[0].gasType,
          "partCost=",
          rows[0].partCost
        );
      }

      const before = getAllPartsMaster().slice(0, 1);
      console.log("[parts/master] DB before: first=", before[0]);

      const r = importPartsMasterFromRows(rows);
      setImportResult(r);

      // DB保存後に再取得
      const after = getAllPartsMaster().slice(0, 1);
      console.log("[parts/master] DB after: first=", after[0]);

      refreshList();

      // 画面描画直前（refreshList後の反映）
      const justLoaded = getAllPartsMaster().slice(0, 1);
      console.log("[parts/master] justLoaded(before render): first=", justLoaded[0]);
    } finally {
      setPartsCsvImportLoading(false);
    }
  };

  const handleClearAll = () => {
    if (!confirm("登録一覧をすべて削除しますか？この操作は取り消せません。")) return;
    clearAllPartsMaster();
    refreshList();
  };

  const refreshKnowledgeList = useCallback(() => {
    setKnowledgeList(getAllProductPartsKnowledge());
  }, []);

  useEffect(() => {
    let needRefresh = false;
    if (migratePartsMasterMojibake() > 0) needRefresh = true;
    if (migratePartsMasterPartCost() > 0) needRefresh = true;
    if (needRefresh) refreshList();
  }, []);

  useEffect(() => {
    refreshList();
    refreshKnowledgeList();
  }, [refreshList, refreshKnowledgeList]);

  const handleDelete = (id: string) => {
    deletePartsMaster(id);
    refreshList();
  };

  /** 登録＋Dify送信を一括実行（部品マスタ・製品型番の両方をDifyに送信） */
  const handleRegisterAndDify = async () => {
    setDifyStatus("sending");
    setKnowledgeDifyStatus("sending");
    setDifyMessage("");
    setKnowledgeDifyMessage("");
    const messages: string[] = [];
    const partsMaster = getAllPartsMaster();
    if (partsMaster.length > 0) {
      try {
        const lines = ["【部品マスタ一覧】", ""];
        for (const r of partsMaster.sort((a, b) => (a.partNo ?? "").localeCompare(b.partNo ?? ""))) {
          lines.push(`部品品番: ${r.partNo}, 部品名称: ${r.partName ?? ""}, 単価: ${r.partCost != null ? r.partCost : "—"}`);
        }
        const text = lines.join("\n");
        const documentId = typeof window !== "undefined" ? localStorage.getItem(PARTS_MASTER_DIFY_DOCUMENT_ID_KEY) : null;
        const res = await fetch("/api/dify/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: PARTS_MASTER_DIFY_NAME, text, documentId: documentId || undefined }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: number; documentId?: string; error?: string; difyResponse?: { code?: string; message?: string } };
        if (data?.ok === true) {
          if (data.documentId && typeof window !== "undefined") localStorage.setItem(PARTS_MASTER_DIFY_DOCUMENT_ID_KEY, data.documentId);
          messages.push("部品マスタ: Difyに送信しました");
        } else messages.push(`部品マスタ: HTTP ${data?.status ?? res.status} | ${data?.difyResponse?.message ?? data?.error ?? "失敗"}`);
      } catch (e) {
        messages.push("部品マスタ: " + (e instanceof Error ? e.message : "送信エラー"));
      }
    }
    const knowledgeRecords = getAllProductPartsKnowledge();
    if (knowledgeRecords.length > 0) {
      try {
        const text = formatProductPartsKnowledgeForDify(knowledgeRecords);
        const documentId = typeof window !== "undefined" ? localStorage.getItem(PRODUCT_PARTS_DIFY_DOCUMENT_ID_KEY) : null;
        const res = await fetch("/api/dify/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: PRODUCT_PARTS_DIFY_NAME, text, documentId: documentId || undefined }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: number; documentId?: string; error?: string; difyResponse?: { code?: string; message?: string } };
        if (data?.ok === true) {
          if (data.documentId && typeof window !== "undefined") localStorage.setItem(PRODUCT_PARTS_DIFY_DOCUMENT_ID_KEY, data.documentId);
          messages.push("製品型番と部品: Difyに送信しました");
        } else messages.push(`製品型番と部品: HTTP ${data?.status ?? res.status} | ${data?.difyResponse?.message ?? data?.error ?? "失敗"}`);
      } catch (e) {
        messages.push("製品型番と部品: " + (e instanceof Error ? e.message : "送信エラー"));
      }
    }
    setDifyStatus("idle");
    setKnowledgeDifyStatus("idle");
    if (messages.length > 0) {
      setDifyMessage(messages.join("。"));
      setKnowledgeDifyMessage(messages.join("。"));
    }
    refreshList();
    refreshKnowledgeList();
  };

  const handleKnowledgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = productCode.trim();
    if (!code) {
      alert("製品型番・製品品番を入力してください。");
      return;
    }
    const partNos = partNosText
      .split(/[\s,\t、]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    addOrUpdateProductPartsKnowledge(code, productName || undefined, partNos);
    setProductCode("");
    setProductName("");
    setPartNosText("");
    setUnitPriceInput("");
    refreshKnowledgeList();
  };

  const handleKnowledgeDelete = (id: string) => {
    if (!confirm("この製品の部品対応を削除しますか？")) return;
    deleteProductPartsKnowledge(id);
    refreshKnowledgeList();
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
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">部品マスタ</h1>
      </div>

      <section>
        <p className="mb-3 text-sm text-[var(--muted)]">
          製品型番・製品品番に対して部品品番を登録し、Difyナレッジに送信すると「交換候補部品を教えて」などの質問に利用されます。
        </p>
        <form onSubmit={handleKnowledgeSubmit} className="mb-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">製品型番・製品品番 *</span>
            <input
              type="text"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="例: ABC-1234"
              className="mt-1 block w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">製品名（任意）</span>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="例: 〇〇給湯器"
              className="mt-1 block w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">単価入力</span>
            <input
              type="text"
              inputMode="numeric"
              value={unitPriceInput}
              onChange={(e) => setUnitPriceInput(e.target.value)}
              placeholder="例: 4900"
              className="mt-1 block w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
            />
          </label>
        </form>

        {/* CSV取り込み（部品マスタ: [部品品番, 部品名称, ガス種?, 定価?]） */}
        <div className="mb-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-4">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            CSVで部品マスタを取り込む
          </label>
          <p className="mt-1 text-xs text-[var(--muted)]">
            1行1件、カンマ区切りまたはタブ区切り。文字化けしやすい場合はBOM付きUTF-8推奨。
          </p>
          <input
            className="mt-3 block w-full text-sm text-[var(--muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-[var(--primary-foreground)]"
            type="file"
            accept=".csv,text/csv"
            disabled={partsCsvImportLoading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void handlePartsMasterCsvFile(f);
              // 同じファイルを連続で選べるように
              e.currentTarget.value = "";
            }}
          />
          {partsCsvImportLoading && <p className="mt-2 text-sm text-[var(--primary)]">取り込み中…</p>}
        </div>
      </section>

      {importResult && (
        <p className="text-sm text-[var(--foreground)]">
          登録: {importResult.added}件、更新: {importResult.updated}件
        </p>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--foreground)]">登録一覧</h2>
          <button
            type="button"
            onClick={handleClearAll}
            className="rounded border border-red-200 bg-[var(--card)] px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 hover:border-red-300"
          >
            登録一覧一括削除
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--border)]/30">
                <th scope="col" className="border-b border-[var(--border)] px-3 py-2 text-left">部品品番</th>
                <th scope="col" className="border-b border-[var(--border)] px-3 py-2 text-left">部品名称</th>
                <th scope="col" className="border-b border-[var(--border)] px-3 py-2 text-left">ガス種</th>
                <th scope="col" className="border-b border-[var(--border)] px-3 py-2 text-right">単価</th>
                <th scope="col" id="delete-header" className="border-b border-[var(--border)] px-3 py-2 text-left w-20 min-w-[4.5rem]">削除</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-[var(--muted)]">
                    <span>データがありません。</span>
                  </td>
                </tr>
              ) : (
                (() => {
                  const displayRows: RegisteredPartRow[] = list
                    .sort((a, b) => (a.partNo ?? "").localeCompare(b.partNo ?? ""))
                    .map((r) => ({
                      id: r.id,
                      partNumber: r.partNo ?? null,
                      partName: r.partName ?? null,
                      gasType: r.gasType ?? null,
                      unitPrice: r.partCost != null ? r.partCost : null,
                    }));
                  return displayRows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)]">
                      <td className="px-3 py-2">{row.partNumber ?? ""}</td>
                      <td className="px-3 py-2">{row.partName ?? ""}</td>
                      <td className="px-3 py-2">{row.gasType ?? ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatYen(row.unitPrice)}
                      </td>
                      <td className="px-3 py-2 w-20 min-w-[4.5rem]" headers="delete-header">
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                          aria-label={`${row.partNumber ?? ""} を削除`}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ));
                })()
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleRegisterAndDify}
            disabled={difyStatus === "sending" || knowledgeDifyStatus === "sending"}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-50"
          >
            {(difyStatus === "sending" || knowledgeDifyStatus === "sending") ? "学習データ登録中…" : "学習データ登録"}
          </button>
          {(difyMessage || knowledgeDifyMessage) && (
            <p className="text-center text-sm text-[var(--muted)]">{difyMessage || knowledgeDifyMessage}</p>
          )}
        </div>
      </section>
    </div>
  );
}
