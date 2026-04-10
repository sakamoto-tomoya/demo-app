"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CaseForm = dynamic(() => import("@/components/CaseForm"), { ssr: false });

export default function NewCasePage() {
  const router = useRouter();
  const [showCompletionActions, setShowCompletionActions] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
        案件管理
      </h1>
      <CaseForm
        onSuccess={() => {
          setShowCompletionActions(true);
        }}
        onCancel={() => router.back()}
        showCompletionActions={showCompletionActions}
      />
    </div>
  );
}
