"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const CaseForm = dynamic(() => import("@/components/CaseForm"), { ssr: false });

export default function NewCasePage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
        案件管理
      </h1>
      <p className="text-[var(--muted)]">
        PDFをアップロードすると書類OCRで項目を自動転記します。手入力も可能です。
      </p>
      <CaseForm
        onSuccess={() => router.push("/")}
        onCancel={() => router.back()}
      />
    </div>
  );
}
