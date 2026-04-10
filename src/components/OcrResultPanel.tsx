"use client";

/**
 * OCR 結果の詳細表示（Mock 時用）
 * - PDF プレビュー
 * - 抽出項目一覧（値・信頼度・座標）
 * - 要確認項目の色分け（信頼度が低い項目を強調）
 */

import type { OcrFieldMapping } from "@/lib/ocr-types";

/** 項目キー → 日本語ラベル（画面表示用） */
const FIELD_LABELS: Record<string, string> = {
  receptionNo: "修理受付番号",
  requestStoreName: "ご依頼店名",
  requestStoreFurigana: "フリガナ（依頼店）",
  requestContactName: "ご担当者名",
  requestPhone: "電話番号（依頼店）",
  requestFax: "FAX（依頼店）",
  requestAddress: "依頼元住所",
  requestPostalCode: "依頼元郵便番号",
  receptionDate: "受付日",
  desiredVisitDate: "訪問希望日",
  desiredVisitTime: "訪問希望時間",
  warranty: "保証",
  paymentMethod: "支払方法",
  customerName: "お客様名",
  customerFurigana: "フリガナ（お客様）",
  postalCode: "郵便番号",
  address: "住所",
  phone: "自宅電話",
  mobile: "携帯番号",
  modelName: "型式名",
  modelCode: "型式コード",
  reportedModelName: "お申し出型式名",
  gasType: "ガス種",
  inquiryContent: "問合/依頼内容",
  internalContact: "社内連絡",
  memo: "メモ",
};

/** 信頼度がこの値未満なら「要確認」として色分け */
const CONFIDENCE_WARN_THRESHOLD = 0.9;

type Props = {
  mapping: OcrFieldMapping;
  /** Mock モードかどうか（バッジ表示用） */
  isMock?: boolean;
  /** 選択中PDFのプレビュー用URL（指定時はこのPDFを表示。未指定時は /sample.pdf） */
  previewUrl?: string | null;
};

export function OcrResultPanel({ mapping, isMock, previewUrl }: Props) {
  const entries = Object.entries(mapping).filter(([, meta]) => meta.value != null && String(meta.value).trim() !== "");
  const sorted = entries.sort(([a], [b]) => (FIELD_LABELS[a] ?? a).localeCompare(FIELD_LABELS[b] ?? b));

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
      {/* 見出しと Mock バッジ */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          OCR 抽出結果
        </h3>
        {isMock && (
          <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
            Mock（サンプルデータ）
          </span>
        )}
      </div>

      {/* 1. PDF プレビュー（選択したPDFを表示。未選択時は public/sample.pdf） */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--muted)]">PDF プレビュー</p>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden">
          <iframe
            src={previewUrl ?? "/sample.pdf"}
            title={previewUrl ? "選択したPDF" : "サンプルPDF"}
            className="w-full h-[360px] block"
          />
        </div>
        <p className="text-xs text-[var(--muted)]">
          {previewUrl ? "選択したPDFを表示しています" : "※ public/sample.pdf を配置するとプレビューが表示されます"}
        </p>
      </div>

      {/* 2. 抽出項目一覧（値・信頼度・座標） */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--muted)]">抽出項目一覧（この項目は PDF のどの位置から取得したか）</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--border)]/30">
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">項目</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">値</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">信頼度</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">PDF上の位置（座標）</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(([key, meta]) => {
                const label = FIELD_LABELS[key] ?? key;
                const confidence = meta.confidence ?? 0;
                const isLowConfidence = confidence < CONFIDENCE_WARN_THRESHOLD;
                const bbox = meta.bbox;
                const bboxStr = bbox
                  ? `ページ${bbox.page} (x:${bbox.x}, y:${bbox.y}) 幅${bbox.w}×高さ${bbox.h}`
                  : "—";
                return (
                  <tr
                    key={key}
                    className={`border-b border-[var(--border)] ${
                      isLowConfidence ? "bg-[var(--alert-bg)]/50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium">{label}</span>
                      {isLowConfidence && (
                        <span className="ml-1 rounded bg-[var(--alert)]/20 px-1.5 py-0.5 text-xs text-[var(--alert)]">
                          要確認
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 break-all">{String(meta.value)}</td>
                    <td className="px-3 py-2">
                      <span className={isLowConfidence ? "text-[var(--alert)]" : "text-[var(--foreground)]"}>
                        {Math.round(confidence * 100)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--muted)]">{bboxStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 転記結果・要確認の凡例 */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <span>下のフォームに上記の値が自動転記されています。</span>
        <span className="flex items-center gap-1">
          <span className="rounded bg-[var(--alert)]/20 px-1.5 py-0.5 text-[var(--alert)]">要確認</span>
          は信頼度 {Math.round(CONFIDENCE_WARN_THRESHOLD * 100)}% 未満の項目です。内容を目視で確認してください。
        </span>
      </div>
    </div>
  );
}
