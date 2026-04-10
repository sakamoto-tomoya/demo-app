/**
 * マイナンバー連携のデモ用マスタ（公的API・カード読取は未接続）。
 * ポートフォリオ／UI検証用。本番の資格確認・電カル連携の代替にはなりません。
 */

import type { ClinicIntegrationsPayload } from "@/lib/clinic-types";

export type DemoFamilyHospital = {
  id: string;
  name: string;
  city: string;
  /** マイナ登録住所の都道府県（候補絞り込み用・デモ） */
  prefecture: string;
  note: string;
};

export type DemoPrescription = {
  id: string;
  label: string;
  issuedOn: string;
  prescriber: string;
};

export const DEMO_MYNUMBER_PREFECTURES = [
  { value: "東京都", label: "東京都（マイナ登録住所のデモ）" },
  { value: "神奈川県", label: "神奈川県（マイナ登録住所のデモ）" },
  { value: "埼玉県", label: "埼玉県（マイナ登録住所のデモ）" },
  { value: "大阪府", label: "大阪府（マイナ登録住所のデモ）" },
  { value: "ALL", label: "全国の登録医療機関を表示（デモ）" },
] as const;

export const DEMO_FAMILY_HOSPITALS: DemoFamilyHospital[] = [
  {
    id: "fh_001",
    name: "さくら台クリニック",
    city: "東京都世田谷区",
    prefecture: "東京都",
    note: "内科・生活習慣病（かかりつけ登録想定）",
  },
  {
    id: "fh_004",
    name: "港南メディカルクリニック",
    city: "東京都港区",
    prefecture: "東京都",
    note: "循環器・内科（かかりつけ登録想定）",
  },
  {
    id: "fh_002",
    name: "みどりヶ丘ファミリー診療所",
    city: "神奈川県横浜市",
    prefecture: "神奈川県",
    note: "総合診療・小児（かかりつけ登録想定）",
  },
  {
    id: "fh_003",
    name: "ひまわり診療所",
    city: "埼玉県さいたま市",
    prefecture: "埼玉県",
    note: "内科・在宅支援（かかりつけ登録想定）",
  },
  {
    id: "fh_005",
    name: "なんば駅前内科クリニック",
    city: "大阪府大阪市中央区",
    prefecture: "大阪府",
    note: "内科（かかりつけ登録想定）",
  },
];

/** マイナに登録された住所（都道府県）に基づき、かかりつけ候補を返す（デモ） */
export function listHospitalsFromMynumberDemo(prefecture: string): DemoFamilyHospital[] {
  const p = prefecture.trim();
  if (!p || p === "ALL") return [...DEMO_FAMILY_HOSPITALS];
  return DEMO_FAMILY_HOSPITALS.filter((h) => h.prefecture === p);
}

export const DEMO_PRESCRIPTIONS: DemoPrescription[] = [
  {
    id: "rx_bp",
    label: "降圧剤（1日1回・朝食後）",
    issuedOn: "2025-11-08",
    prescriber: "かかりつけ医",
  },
  {
    id: "rx_dm",
    label: "血糖降下薬（1日2回）",
    issuedOn: "2025-12-01",
    prescriber: "かかりつけ医",
  },
  {
    id: "rx_statin",
    label: "脂質異常症用薬",
    issuedOn: "2025-10-15",
    prescriber: "かかりつけ医",
  },
  {
    id: "rx_allergy",
    label: "抗アレルギー薬（頓服）",
    issuedOn: "2026-01-20",
    prescriber: "皮膚科（紹介）",
  },
  {
    id: "rx_nsaid",
    label: "消炎鎮痛薬（湿布・外用）",
    issuedOn: "2026-02-02",
    prescriber: "整形外科（紹介）",
  },
];

export function parseClinicIntegrations(raw: string | null | undefined): ClinicIntegrationsPayload | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const o = JSON.parse(raw) as Partial<ClinicIntegrationsPayload>;
    if (o?.kind !== "mynumber_demo_v1" || !o.familyHospital?.id || !o.familyHospital?.name) return null;
    if (!Array.isArray(o.prescriptions)) return null;
    const city = String(o.familyHospital.city ?? "");
    let mynumberSnapshot: ClinicIntegrationsPayload["mynumberSnapshot"];
    if (o.mynumberSnapshot && typeof o.mynumberSnapshot === "object") {
      const s = o.mynumberSnapshot as { registeredAddressPrefecture?: string };
      const pref = String(s.registeredAddressPrefecture ?? "").trim();
      if (pref) mynumberSnapshot = { registeredAddressPrefecture: pref };
    }
    return {
      kind: "mynumber_demo_v1",
      linkedAt: String(o.linkedAt ?? ""),
      mynumberSnapshot,
      familyHospital: {
        id: String(o.familyHospital.id),
        name: String(o.familyHospital.name),
        city,
      },
      prescriptions: o.prescriptions.map((p) => ({
        id: String((p as { id?: string }).id ?? ""),
        label: String((p as { label?: string }).label ?? ""),
        issuedOn: String((p as { issuedOn?: string }).issuedOn ?? ""),
        prescriber: String((p as { prescriber?: string }).prescriber ?? ""),
      })),
    };
  } catch {
    return null;
  }
}

export function buildClinicIntegrationsJson(input: {
  enabled: boolean;
  familyHospitalId: string;
  prescriptionIds: string[];
  /** マイナ登録住所として選んだ都道府県、または ALL */
  mynumberRegisteredPrefecture: string;
}): string | null {
  if (!input.enabled) return null;
  const h = DEMO_FAMILY_HOSPITALS.find((x) => x.id === input.familyHospitalId);
  if (!h) return null;
  const allowed = listHospitalsFromMynumberDemo(input.mynumberRegisteredPrefecture);
  if (!allowed.some((x) => x.id === h.id)) return null;
  const ids = new Set(input.prescriptionIds);
  const rx = DEMO_PRESCRIPTIONS.filter((p) => ids.has(p.id)).map((p) => ({
    id: p.id,
    label: p.label,
    issuedOn: p.issuedOn,
    prescriber: p.prescriber,
  }));
  const pref = input.mynumberRegisteredPrefecture.trim() || "ALL";
  const payload: ClinicIntegrationsPayload = {
    kind: "mynumber_demo_v1",
    linkedAt: new Date().toISOString(),
    mynumberSnapshot: {
      registeredAddressPrefecture: pref,
    },
    familyHospital: { id: h.id, name: h.name, city: h.city },
    prescriptions: rx,
  };
  return JSON.stringify(payload);
}
