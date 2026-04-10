"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 製品型番・製品品番と部品の対応は部品マスタページに統合しました。
 */
export default function PartsKnowledgeRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/parts/master");
  }, [router]);
  return (
    <div className="p-4 text-[var(--muted)]">
      部品マスタへ移動しています…
    </div>
  );
}
