"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCase, updateCase } from "@/lib/store";
import type { CaseRecord } from "@/lib/types";

type OutputType = "report" | "estimate" | "invoice";

function parseNum(s: string): number {
  const n = parseInt(String(s).replace(/[^0-9０-９]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function parsePartsRows(c: CaseRecord): { partName: string; partNo: string; qty: string; unitPrice: string }[] {
  const partName = (c.completionPartsUsed ?? "").split("\n");
  const partNo = (c.completionPartsPartNo ?? "").split("\n");
  const qty = (c.completionPartsQty ?? "").split("\n");
  const price = (c.completionPartsUnitPrice ?? "").split("\n");
  const n = Math.max(partName.length, partNo.length, qty.length, price.length, 1);
  return Array.from({ length: n }, (_, i) => ({
    partName: partName[i] ?? "",
    partNo: partNo[i] ?? "",
    qty: qty[i] ?? "",
    unitPrice: price[i] ?? "",
  }));
}

const TRIP_FEE = 3500;

/** 請求書の備考欄：振込先等（表形式で揃える） */
function InvoiceRemarksBlock({ invoiceDate }: { invoiceDate: string }) {
  const dueLabel = invoiceDate ? `請求書作成日 ${invoiceDate}から14日` : "請求書作成日から14日";
  return (
    <div className="space-y-1 text-sm">
      <table className="w-full max-w-md border-collapse ml-auto" style={{ tableLayout: "fixed" }}>
        <tbody>
          <tr>
            <td className="align-top pr-3 font-medium w-20">振込先</td>
            <td className="align-top">
              <div>横浜銀行綱島支店　　普通　6030068</div>
              <div>みずほ銀行新横浜支店　普通　3047819</div>
              <div>三井住友銀行新横浜支店　普通　883007</div>
            </td>
          </tr>
          <tr>
            <td className="align-top pr-3 font-medium">口座名義</td>
            <td className="align-top">ライフホーム(カ</td>
          </tr>
          <tr>
            <td className="align-top pr-3 font-medium">振込期限</td>
            <td className="align-top">{dueLabel}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-8 mb-4 text-right mr-8">※恐れ入りますが振込手数料のご負担をお願いします。</p>
      <p className="text-right mr-8">※お振込の際は、請求書番号、御社名の記載をお願い致します。</p>
    </div>
  );
}

/** 角印: company-seal.jpg が無いときは public/company-seal.svg を表示 */
const SEAL_FALLBACK = "/company-seal.svg";

/** 住所から市・区までを返す */
function getAddressUpToCityOrWard(address: string): string {
  const t = (address ?? "").trim();
  if (!t) return "";
  let last = -1;
  const iCity = t.lastIndexOf("市");
  const iWard = t.lastIndexOf("区");
  if (iCity >= 0) last = Math.max(last, iCity);
  if (iWard >= 0) last = Math.max(last, iWard);
  if (last < 0) return "";
  return t.slice(0, last + 1);
}

export default function CompletePrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [mounted, setMounted] = useState(false);
  const [record, setRecord] = useState<CaseRecord | null | undefined>(undefined);
  const [sealSrc, setSealSrc] = useState<string>("/company-seal.jpg");
  const [hidePhotosForFaxPrint, setHidePhotosForFaxPrint] = useState(false);
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);
  const [emailForReport, setEmailForReport] = useState("");
  const typeParam = searchParams.get("type");
  const outputType: OutputType =
    typeParam === "estimate" ? "estimate"
    : typeParam === "invoice" ? "invoice"
    : typeParam === "report" ? "report"
    : (record?.completionOutputType ?? "report");

  useEffect(() => {
    setMounted(true);
    if (!id) setRecord(null);
    else setRecord(getCase(id) ?? null);
  }, [id]);

  useEffect(() => {
    if (!mounted || !id || !record) return;
    if (outputType !== "invoice") return;
    if (record.invoiceIssuedAt) return;
    const updated = updateCase(id, { invoiceIssuedAt: new Date().toISOString() });
    if (updated) setRecord(updated);
  }, [mounted, id, record?.id, record?.invoiceIssuedAt, outputType]);

  const { partsRows, technicalTotal, partsTotal, subtotal, taxRate, taxAmount, totalWithTax } = useMemo(() => {
    if (!record) {
      return {
        partsRows: [] as { partName: string; partNo: string; qty: string; unitPrice: string }[],
        technicalTotal: 0,
        partsTotal: 0,
        subtotal: TRIP_FEE,
        taxRate: 10,
        taxAmount: 0,
        totalWithTax: TRIP_FEE,
      };
    }
    const rows = parsePartsRows(record);
    const techQty = parseNum(record.completionTechnicalQty ?? "1");
    const techUnit = parseNum(record.completionTechnicalUnitPrice ?? "");
    const technicalTotal = techQty * techUnit;
    const partsTotal = rows.reduce(
      (sum, row) => sum + parseNum(row.qty) * parseNum(row.unitPrice),
      0
    );
    const subtotal = TRIP_FEE + technicalTotal + partsTotal;
    const taxRate = parseNum(String(record.completionTaxRate ?? "").replace("%", "")) || 10;
    const taxAmount = Math.floor(subtotal * (taxRate / 100));
    const totalWithTax = subtotal + taxAmount;
    return { partsRows: rows, technicalTotal, partsTotal, subtotal, taxRate, taxAmount, totalWithTax };
  }, [record]);

  const handlePrint = () => {
    window.print();
  };

  const handleFaxPrint = () => {
    setHidePhotosForFaxPrint(true);
    const onAfterPrint = () => {
      setHidePhotosForFaxPrint(false);
      window.removeEventListener("afterprint", onAfterPrint);
    };
    window.addEventListener("afterprint", onAfterPrint);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  const wrapperClass = "min-h-screen bg-white p-6 text-black print:p-0";

  if (!mounted) {
    return (
      <div className={wrapperClass}>
        <div className="p-6 text-[var(--muted)]">読み込み中…</div>
      </div>
    );
  }

  if (!id) {
    return (
      <div className={wrapperClass}>
        <div className="p-6 text-[var(--muted)]">案件が指定されていません。</div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className={wrapperClass}>
        <div className="p-6 text-[var(--muted)]">案件が見つかりません。</div>
      </div>
    );
  }

  const openEmailPreviewModal = () => {
    setEmailForReport((record?.requestStoreEmail ?? "").trim());
    setShowEmailPreviewModal(true);
  };

  const handleEmailSend = () => {
    const to = emailForReport.trim();
    const specifiedNo = (record?.requestSpecifiedNo ?? record?.completionRecipientSpecifiedNo ?? "").trim();
    const subject = specifiedNo
      ? (outputType === "report" ? "【完了報告】" : outputType === "estimate" ? "【御見積書】" : "【請求書】") + ` 御社指定No. ${specifiedNo}`
      : "";
    const storeName = (record?.requestStoreName ?? record?.completionRecipient ?? "").trim() || "依頼元名";
    const contactName = (record?.requestContactName ?? "").trim() || "ご担当者様";
    const body = [
      storeName,
      contactName + "様",
      "",
      "表題のご依頼案件",
      "完了致しましたのでご報告いたします。",
      "",
      "署名",
    ].join("\n");
    if (id && to) {
      updateCase(id, { requestStoreEmail: to });
      setRecord(getCase(id) ?? record);
    }
    setShowEmailPreviewModal(false);
    const mailtoUrl = subject
      ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : `mailto:${encodeURIComponent(to)}?body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className={wrapperClass}>
        {showEmailPreviewModal && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowEmailPreviewModal(false)}>
            <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">メールで報告</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                送信先アドレスを入力し「送信」を押すとメールソフトが開きます。件名は御社指定Noがある場合のみ自動入力され、ない場合は手動で入力してください。入力したアドレスは案件に保存され、次回から自動入力されます。添付が必要な場合は「印刷をしてFAXで報告」でPDF保存後、メールに添付してください。
              </p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-[var(--foreground)]">送信先メールアドレス</label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="依頼元のメールアドレス"
                  value={emailForReport}
                  onChange={(e) => setEmailForReport(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleEmailSend}
                  disabled={!emailForReport.trim()}
                  className="rounded-lg bg-[var(--primary)] px-4 py-2.5 font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
                >
                  送信
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailPreviewModal(false)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="no-print mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleFaxPrint}
            className="rounded-lg bg-[var(--primary)] px-5 py-2.5 font-medium text-[var(--primary-foreground)] hover:opacity-90"
          >
            印刷をしてFAXで報告
          </button>
          <button
            type="button"
            onClick={openEmailPreviewModal}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
          >
            メールで報告
          </button>
          <Link
            href={id ? `/cases/${id}/edit` : "/"}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
          >
            戻る
          </Link>
          <p className="text-sm text-[var(--muted)]">
            上記ボタンで印刷ダイアログを開き、「送信先」で「PDFに保存」を選ぶとPDFで保存できます。
          </p>
        </div>

        <div className="mx-auto max-w-[210mm] space-y-6 text-left text-sm print:space-y-3 print:py-0 print:pt-0">
          <h1 className="text-center text-lg font-bold print:mb-0 print:mt-0">
            {outputType === "report"
              ? "完了報告書"
              : outputType === "estimate"
                ? "御見積書"
                : "請求書"}
          </h1>

          <div className="space-y-0.5 text-left print:space-y-1 print:mb-0 print:mt-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                {(() => {
                  const isInvoiceRequest =
                    outputType === "invoice" &&
                    (record.paymentMethod === "現地請求（依頼元へ請求書発行）" ||
                      record.paymentMethod === "現地請求（指定先別途請求書発行）");
                  const name = isInvoiceRequest
                    ? (record.requestStoreName ?? "").trim()
                    : (record.completionRecipient ?? record.requestStoreName ?? "").trim();
                  const postalCode = isInvoiceRequest
                    ? (record.requestPostalCode ?? "").trim()
                    : (record.completionRecipientPostalCode ?? record.requestPostalCode ?? "").trim();
                  const address = isInvoiceRequest
                    ? (record.requestAddress ?? "").trim()
                    : (record.completionRecipientAddress ?? record.requestAddress ?? "").trim();
                  return (
                    <>
                      <p className="flex items-baseline gap-2">
                        <span>{name}</span>
                        <span className="font-medium">御中</span>
                      </p>
                      {(postalCode || address) ? (
                        <p className="flex flex-wrap items-baseline gap-2">
                          {postalCode ? (
                            <span>〒{String(postalCode).replace(/(\d{3})(\d{4})/, "$1-$2")}</span>
                          ) : null}
                          {address ? <span>{address}</span> : null}
                        </p>
                      ) : null}
                    </>
                  );
                })()}
                {outputType !== "invoice" &&
                ((record.requestPhone ?? "").trim() || (record.requestFax ?? "").trim()) ? (
                  <p className="flex flex-wrap items-baseline gap-6">
                    {(record.requestPhone ?? "").trim() && <span>TEL: {record.requestPhone}</span>}
                    {(record.requestFax ?? "").trim() && <span>FAX: {record.requestFax}</span>}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 flex flex-col items-end gap-0.5">
                <span>
                  <span className="font-medium">
                    {outputType === "report"
                      ? "完了報告日"
                      : outputType === "estimate"
                        ? "見積作成日"
                        : "請求書作成日"}
                  </span>{" "}
                  {outputType === "invoice"
                    ? (record.createdAt ? record.createdAt.slice(0, 10).replace(/-/g, "/") : "")
                    : (record.completionEstimateDate ?? "")}
                </span>
                {(record.receptionNo ?? "").trim() ? (
                  <span>
                    <span className="font-medium">
                      {outputType === "report"
                        ? "受付番号"
                        : outputType === "estimate"
                          ? "見積No"
                          : "請求書発行No"}
                    </span>{" "}
                    {record.receptionNo}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 print:mb-2">
              <div className="space-y-0.5 text-right text-sm leading-snug [&_p]:my-0">
                <p>パロマみなとサービスショップ</p>
                <p>ライフホーム株式会社</p>
                <p>〒223-0057 横浜市港北区新羽町1224</p>
                <p>TEL:045-532-1791　FAX:045-532-1792</p>
                {outputType === "invoice" && (
                  <p>登録番号 T1020001091705</p>
                )}
              </div>
              {(outputType === "estimate" || outputType === "invoice") && (
                <img
                  src={sealSrc}
                  alt="角印"
                  className="h-10 w-10 shrink-0 object-contain print:h-12 print:w-12"
                  onError={() => setSealSrc(SEAL_FALLBACK)}
                />
              )}
            </div>
          </div>

          <div className="border-b border-black pb-2 text-left print:mb-3 print:mt-0">
            {(record.completionRecipientSpecifiedNo ?? record.requestSpecifiedNo ?? "").trim() ? (
              <p className="mb-1 flex gap-2">
                <span className="font-medium shrink-0 w-[5.5em]">御社指定No</span>
                <span>{record.completionRecipientSpecifiedNo ?? record.requestSpecifiedNo}</span>
              </p>
            ) : null}
            <p className="flex gap-2">
              <span className="font-medium shrink-0 w-[5.5em]">作業内容</span>
              <span>{record.completionRepairDetail ?? ""}</span>
            </p>
          </div>

          <div className="flex items-baseline gap-2 print:mb-4">
            <span className="font-medium">ご請求金額</span>
            <span className="text-base font-bold">¥{totalWithTax.toLocaleString()}</span>
            <span className="text-gray-600">(税込)</span>
          </div>

          <table className="w-full border-collapse border border-black print:my-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-2 py-1.5 text-left font-medium">品　目</th>
                <th className="border border-black px-2 py-1.5 text-center w-16 font-medium">数量</th>
                <th className="border border-black px-2 py-1.5 text-right w-24 font-medium">単価</th>
                <th className="border border-black px-2 py-1.5 text-right w-24 font-medium">合計</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1.5">出張料</td>
                <td className="border border-black px-2 py-1.5 text-center">1</td>
                <td className="border border-black px-2 py-1.5 text-right">3,500</td>
                <td className="border border-black px-2 py-1.5 text-right">3,500</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1.5">技術料</td>
                <td className="border border-black px-2 py-1.5 text-center">
                  {record.completionTechnicalQty ?? "1"}
                </td>
                <td className="border border-black px-2 py-1.5 text-right">
                  {record.completionTechnicalUnitPrice ? Number(record.completionTechnicalUnitPrice).toLocaleString() : ""}
                </td>
                <td className="border border-black px-2 py-1.5 text-right">
                  {technicalTotal.toLocaleString()}
                </td>
              </tr>
              {partsRows.map((row, idx) => {
                const rowTotal = parseNum(row.qty) * parseNum(row.unitPrice);
                const partLabel = row.partName.trim()
                  ? `部品（${row.partName}）${row.partNo}`
                  : row.partNo.trim()
                    ? `部品　${row.partNo}`
                    : "";
                if (!partLabel) return null;
                return (
                  <tr key={idx}>
                    <td className="border border-black px-2 py-1.5">{partLabel}</td>
                    <td className="border border-black px-2 py-1.5 text-center">{row.qty}</td>
                    <td className="border border-black px-2 py-1.5 text-right">
                      {row.unitPrice ? Number(row.unitPrice).toLocaleString() : ""}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-right">
                      {rowTotal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-end">
            <table className="w-full max-w-xs border-collapse border border-black">
              <tbody>
                <tr>
                  <td className="border border-black px-2 py-1.5 font-medium">小計</td>
                  <td className="border border-black px-2 py-1.5 text-right">
                    {subtotal.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black px-2 py-1.5 font-medium">消費税</td>
                  <td className="border border-black px-2 py-1.5 text-right">
                    {taxAmount.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black px-2 py-1.5 font-semibold">合計</td>
                  <td className="border border-black px-2 py-1.5 text-right font-semibold">
                    {totalWithTax.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-12 min-h-[120px] print:mt-16 print:min-h-[180px]">
            <p className="font-medium">備　考</p>
            {outputType === "invoice" ? (
              <div className="mt-0.5 border-b border-black pb-0.5 print:min-h-[8em] print:pb-0.5">
                <InvoiceRemarksBlock invoiceDate={record.createdAt ? record.createdAt.slice(0, 10).replace(/-/g, "/") : ""} />
                {(record.completionRemarks ?? "").trim() ? (
                  <p className="mt-3 whitespace-pre-wrap">{(record.completionRemarks ?? "").trim()}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-0.5 min-h-[4em] whitespace-pre-wrap border-b border-black pb-0.5 print:min-h-[8em] print:pb-0.5">
                {(record.completionRemarks ?? "").trim() || " "}
              </p>
            )}
          </div>

          {outputType === "report" && (
            <div
              className={`mt-10 space-y-6 print:mt-12 print:space-y-8 print-break-before-page ${hidePhotosForFaxPrint ? "print-hide-for-fax" : ""}`}
            >
              <div>
                <p className="mb-2 font-medium">作業前写真</p>
                <div className="flex flex-wrap gap-2">
                  {(record.completionBeforeWorkPhotos ?? []).map((url, i) => (
                    <img key={i} src={url} alt={`作業前${i + 1}`} className="h-24 w-24 object-cover border border-black print:h-28 print:w-28" />
                  ))}
                  {(record.completionBeforeWorkPhotos ?? []).length === 0 && (
                    <span className="text-sm text-black/60">—</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 font-medium">作業中写真</p>
                <div className="flex flex-wrap gap-2">
                  {(record.completionDuringWorkPhotos ?? []).map((url, i) => (
                    <img key={i} src={url} alt={`作業中${i + 1}`} className="h-24 w-24 object-cover border border-black print:h-28 print:w-28" />
                  ))}
                  {(record.completionDuringWorkPhotos ?? []).length === 0 && (
                    <span className="text-sm text-black/60">—</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 font-medium">作業後写真</p>
                <div className="flex flex-wrap gap-2">
                  {(record.completionAfterWorkPhotos ?? []).map((url, i) => (
                    <img key={i} src={url} alt={`作業後${i + 1}`} className="h-24 w-24 object-cover border border-black print:h-28 print:w-28" />
                  ))}
                  {(record.completionAfterWorkPhotos ?? []).length === 0 && (
                    <span className="text-sm text-black/60">—</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 font-medium">お客様サイン</p>
                {record.completionCustomerSignatureDataUrl ? (
                  <img
                    src={record.completionCustomerSignatureDataUrl}
                    alt="お客様サイン"
                    className="max-h-20 border-b border-black print:max-h-24"
                  />
                ) : (
                  <span className="text-sm text-black/60">—</span>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
