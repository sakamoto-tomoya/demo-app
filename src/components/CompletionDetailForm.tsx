"use client";

import { useState, useMemo, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import type { CaseRecord, CompletionDetail } from "@/lib/types";
import {
  APPLIANCE_CATEGORY_OPTIONS,
  SYMPTOM_CATEGORY_OPTIONS,
  WORK_RESULT_OPTIONS,
} from "@/lib/types";
import {
  validateCompletionDetail,
  buildCompletionDetail,
  type CompletionDetailValidationError,
} from "@/lib/completion-detail";
import {
  CompletionFormSection,
  type CompletionFormPayload,
  type CompletionFormSectionHandle,
} from "@/components/CompletionFormSection";

const INPUT_CLASS =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] min-w-0";

type FormState = Partial<CompletionDetail>;

function initialFormState(record: CaseRecord | null, existing: Partial<CompletionDetail> | null | undefined): FormState {
  const d = existing ?? {};
  return {
    manufacturer: "パロマ",
    category: d.category ?? "",
    model: d.model ?? (record?.modelName ?? ""),
    inquiry_content: d.inquiry_content ?? (record?.inquiryContent ?? ""),
    symptom_category: d.symptom_category ?? "",
    confirmed_cause: d.confirmed_cause ?? "",
    part_number: d.part_number ?? (record?.completionPartsPartNo ?? ""),
    part_name: d.part_name ?? (record?.completionPartsUsed ?? ""),
    work_detail: d.work_detail ?? (record?.completionRepairDetail ?? ""),
    work_result: d.work_result ?? "",
    note: d.note ?? (record?.completionRemarks ?? ""),
    solution_summary: d.solution_summary ?? "",
    is_completed: true,
  };
}

export type CompletionDetailFormHandle = {
  getDetail: () => Partial<CompletionDetail>;
  setErrors: (errs: CompletionDetailValidationError[]) => void;
  getCompletionPayload?: () => CompletionFormPayload | undefined;
  getPartsRowsForOutbound?: () => ReturnType<CompletionFormSectionHandle["getPartsRowsForOutbound"]>;
};

type Props = {
  record: CaseRecord | null;
  existingDetail?: Partial<CompletionDetail> | null;
  onSave?: (detail: CompletionDetail) => void;
  showSaveButton?: boolean;
  /** フォームのみ表示し、保存ボタンは親で扱う場合 */
  standalone?: boolean;
};

export const CompletionDetailForm = forwardRef<CompletionDetailFormHandle, Props>(function CompletionDetailForm(
  {
    record,
    existingDetail,
    onSave,
    showSaveButton = true,
    standalone = false,
  },
  ref
) {
  const [form, setForm] = useState<FormState>(() =>
    initialFormState(record, existingDetail)
  );
  const [errors, setErrors] = useState<CompletionDetailValidationError[]>([]);
  const [saved, setSaved] = useState(false);
  const completionFormSectionRef = useRef<CompletionFormSectionHandle | null>(null);

  useImperativeHandle(ref, () => ({
    getDetail: () => ({ ...form }),
    setErrors: (errs) => setErrors(errs),
    getCompletionPayload: () => completionFormSectionRef.current?.getCompletionPayload?.(),
    getPartsRowsForOutbound: () => completionFormSectionRef.current?.getPartsRowsForOutbound?.() ?? [],
  }), [form]);

  /** 親フォームの型式名が入力されていたら完了内訳の型式に自動反映 */
  useEffect(() => {
    const name = (record?.modelName ?? "").trim();
    if (name) {
      setForm((prev) => ({ ...prev, model: name }));
    }
  }, [record?.modelName]);

  const set = (key: keyof FormState, value: string | boolean) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== key));
  };

  const validationErrors = useMemo(() => validateCompletionDetail(form), [form]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateCompletionDetail(form);
    setErrors(errs);
    if (errs.length > 0) return;
    const detail = buildCompletionDetail(form, { is_completed: true });
    onSave?.(detail);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="mb-1 text-base font-semibold text-[var(--foreground)]">
        完了内訳入力
      </h2>
      <p className="mb-4 text-xs text-[var(--muted)]">
        メーカーはパロマ固定。完了案件の正解データとして保存し、後でDifyナレッジへ連携しやすい形式で保持します。
      </p>

      {/* div にしている理由: 完了処理ページの <form id="complete-form"> 内に埋め込まれるため、form の入れ子（HTML 不正）を避ける */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">メーカー</span>
            <input
              type="text"
              value="パロマ"
              readOnly
              className={INPUT_CLASS + " bg-[var(--border)]/30"}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">器具分類</span>
            <select
              value={form.category ?? ""}
              onChange={(e) => set("category", e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">選択してください</option>
              {APPLIANCE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">型式 <span className="text-red-600">*</span></span>
          <input
            type="text"
            value={form.model ?? ""}
            onChange={(e) => set("model", e.target.value)}
            className={INPUT_CLASS}
            placeholder="例: RTS65AWK14R"
          />
          {errors.some((e) => e.field === "model") && (
            <p className="mt-1 text-xs text-red-600">{errors.find((e) => e.field === "model")?.message}</p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">問合内容 <span className="text-red-600">*</span></span>
          <textarea
            value={form.inquiry_content ?? ""}
            onChange={(e) => set("inquiry_content", e.target.value)}
            rows={3}
            className={INPUT_CLASS}
            placeholder="症状・使用年数・連絡日時・請求先など"
          />
          {errors.some((e) => e.field === "inquiry_content") && (
            <p className="mt-1 text-xs text-red-600">{errors.find((e) => e.field === "inquiry_content")?.message}</p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">症状分類 <span className="text-red-600">*</span></span>
          <select
            value={form.symptom_category ?? ""}
            onChange={(e) => set("symptom_category", e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">選択してください</option>
            {SYMPTOM_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.some((e) => e.field === "symptom_category") && (
            <p className="mt-1 text-xs text-red-600">{errors.find((e) => e.field === "symptom_category")?.message}</p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">確定原因 <span className="text-red-600">*</span></span>
          <input
            type="text"
            value={form.confirmed_cause ?? ""}
            onChange={(e) => set("confirmed_cause", e.target.value)}
            className={INPUT_CLASS}
            placeholder="例: 立消え安全装置不良"
          />
          {errors.some((e) => e.field === "confirmed_cause") && (
            <p className="mt-1 text-xs text-red-600">{errors.find((e) => e.field === "confirmed_cause")?.message}</p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">作業内容 <span className="text-red-600">*</span></span>
          <textarea
            value={form.work_detail ?? ""}
            onChange={(e) => set("work_detail", e.target.value)}
            rows={2}
            className={INPUT_CLASS}
            placeholder="修理内容の詳細"
          />
          {errors.some((e) => e.field === "work_detail") && (
            <p className="mt-1 text-xs text-red-600">{errors.find((e) => e.field === "work_detail")?.message}</p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">作業結果</span>
          <select
            value={form.work_result ?? ""}
            onChange={(e) => set("work_result", e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">選択してください</option>
            {WORK_RESULT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">備考</span>
          <textarea
            value={form.note ?? ""}
            onChange={(e) => set("note", e.target.value)}
            rows={2}
            className={INPUT_CLASS}
            placeholder="その他メモ"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">解決方法要約 <span className="text-red-600">*</span></span>
          <input
            type="text"
            value={form.solution_summary ?? ""}
            onChange={(e) => set("solution_summary", e.target.value)}
            className={INPUT_CLASS}
            placeholder="例: 立消え安全装置交換で改善 / 配線補修後に正常復旧"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">1文で簡潔に入力してください。</p>
          {errors.some((e) => e.field === "solution_summary") && (
            <p className="mt-1 text-xs text-red-600">{errors.find((e) => e.field === "solution_summary")?.message}</p>
          )}
        </label>

        {record && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
            <CompletionFormSection
              ref={completionFormSectionRef}
              record={record}
              hideSaveButton
            />
          </div>
        )}

        {showSaveButton && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
            >
              {standalone ? "完了詳細を保存" : "完了詳細を保存"}
            </button>
            {saved && (
              <span className="text-sm text-[var(--primary)]">保存しました。</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
