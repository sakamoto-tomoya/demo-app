/** 案件ステータス */
export type CaseStatus =
  | "new"           // 新規
  | "parts_order"   // 部品手配中
  | "estimate"      // 見積中
  | "waiting_contact"  // 連絡待ち
  | "no_contact"    // 連絡取れず
  | "visit_confirmed"   // 訪問日確定
  | "contact_only"  // 連絡のみ指定案件
  | "sns_sent"      // 不在SNS送信済み
  | "completed"     // 完了
  | "cancelled";    // キャンセル

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  new: "新規",
  parts_order: "部品手配中",
  estimate: "見積中",
  waiting_contact: "連絡待ち",
  no_contact: "連絡取れず",
  visit_confirmed: "訪問日確定",
  contact_only: "連絡のみ指定案件",
  sns_sent: "不在SNS送信済み",
  completed: "完了",
  cancelled: "キャンセル",
};

/** ステータスの表示ラベル（廃止済み visit_scheduled なども表示用に返す） */
export function getStatusLabel(status: string): string {
  if (status in CASE_STATUS_LABELS) return CASE_STATUS_LABELS[status as CaseStatus];
  if (status === "visit_scheduled") return "訪問日決定";
  return status;
}

/** 訪問日決定以外のステータス（アラート対象） */
export const ALERT_TARGET_STATUSES: CaseStatus[] = [
  "new",
  "parts_order",
  "estimate",
  "waiting_contact",
  "no_contact",
  "contact_only",
  "sns_sent",
];

/** アラート基準日数（登録日から何日後で色分けするか） */
export const ALERT_DAYS_THRESHOLD = 5;

/** 器具分類（Difyナレッジ・完了詳細用） */
export const APPLIANCE_CATEGORY_OPTIONS = [
  "ビルトインコンロ",
  "テーブルコンロ",
  "給湯器",
  "湯沸し器",
  "業務用炊飯器",
  "その他",
] as const;
export type ApplianceCategory = (typeof APPLIANCE_CATEGORY_OPTIONS)[number];

/** 症状分類（Difyナレッジ・完了詳細用） */
export const SYMPTOM_CATEGORY_OPTIONS = [
  "点火不良",
  "点火後消火",
  "火力不安定",
  "エラー表示",
  "お湯が出ない",
  "ガス臭い",
  "その他",
] as const;
export type SymptomCategory = (typeof SYMPTOM_CATEGORY_OPTIONS)[number];

/** 作業結果（Difyナレッジ・完了詳細用） */
export const WORK_RESULT_OPTIONS = [
  "正常復旧",
  "改善",
  "未改善",
  "経過観察",
  "部品手配待ち",
] as const;
export type WorkResult = (typeof WORK_RESULT_OPTIONS)[number];

/** 完了詳細（Difyナレッジ連携用・パロマ固定） */
export interface CompletionDetail {
  manufacturer: string;
  category: string;
  model: string;
  inquiry_content: string;
  symptom_category: string;
  confirmed_cause: string;
  part_number: string;
  part_name: string;
  work_detail: string;
  work_result: string;
  note: string;
  solution_summary: string;
  is_completed: boolean;
}

/** 出張修理依頼書（パロマ社内用）に準拠した案件データ */
export interface CaseRecord {
  id: string;
  /** 修理受付番号 */
  receptionNo?: string;
  /** ご依頼店名 */
  requestStoreName?: string;
  /** フリガナ（依頼店） */
  requestStoreFurigana?: string;
  /** ご担当者名（依頼元） */
  requestContactName?: string;
  /** 電話番号（依頼元） */
  requestPhone?: string;
  /** FAX番号（依頼元） */
  requestFax?: string;
  /** 電話番号・FAX（依頼元・後方互換） */
  requestPhoneFax?: string;
  /** 依頼元住所 */
  requestAddress?: string;
  /** 依頼元郵便番号（ハイフンなし想定） */
  requestPostalCode?: string;
  /** 御社指定No（依頼元） */
  requestSpecifiedNo?: string;
  /** 依頼元メールアドレス（同依頼元で次回自動入力用） */
  requestStoreEmail?: string;
  /** 受付日 */
  receptionDate?: string;
  /** 訪問希望日 */
  desiredVisitDate?: string;
  /** 訪問希望時間 */
  desiredVisitTime?: string;
  /** 保証 */
  warranty?: string;
  /** 支払方法 */
  paymentMethod?: string;
  /** 請求先宛名（現地請求・指定先別途請求書発行時） */
  billingName?: string;
  /** 請求先郵便番号（現地請求・指定先別途請求書発行時） */
  billingPostalCode?: string;
  /** 請求先住所（現地請求・指定先別途請求書発行時） */
  billingAddress?: string;
  /** 入力者 */
  inputBy?: string;
  /** お客様名 */
  customerName: string;
  /** フリガナ（お客様） */
  customerFurigana?: string;
  /** 郵便番号（ハイフンなし想定） */
  postalCode: string;
  /** 住所 */
  address: string;
  /** 自宅電話 */
  phone: string;
  /** 携帯番号 */
  mobile?: string;
  /** 店舗Ｎo． */
  storeNo?: string;
  /** 店舗区分 */
  storeType?: string;
  /** 型式名 */
  modelName?: string;
  /** 型式コード */
  modelCode?: string;
  /** お申し出型式名 */
  reportedModelName?: string;
  /** 銘板番号 */
  nameplateNo?: string;
  /** ｶﾞｽ種 */
  gasType?: string;
  /** 問合/依頼内容（症状・使用年数・請求先等） */
  inquiryContent?: string;
  /** 問合内容の生テキスト（分解前） */
  inquiry_raw?: string;
  /** 問合先頭行から抽出した型式候補 */
  model_candidate?: string;
  /** 症状（問合内ラベルから分解） */
  symptom?: string;
  /** 使用年数（購入日）メモ（問合内ラベルから分解） */
  usage_years_note?: string;
  /** 連絡日時メモ（問合内ラベルから分解） */
  contact_datetime_note?: string;
  /** 訪問希望日メモ（問合内ラベルから分解） */
  preferred_visit_note?: string;
  /** 費用説明メモ（問合内ラベルから分解） */
  fee_explanation_note?: string;
  /** 社内連絡 */
  internalContact?: string;
  /** その他メモ */
  memo: string;
  status: CaseStatus;
  /** 登録日（ISO文字列） */
  createdAt: string;
  /** 更新日（ISO文字列。未設定の場合は登録日を表示に利用） */
  updatedAt?: string;
  /** 訪問予定日（訪問日決定時、ISO日付文字列） */
  visitDate: string | null;
  /** 訪問予定時間帯 開始（30分刻み HH:mm） */
  visitTimeStart?: string;
  /** 訪問予定時間帯 終了（30分刻み HH:mm） */
  visitTimeEnd?: string;
  /** 訪問時間は当日朝連絡 */
  visitTimeMorningContact?: boolean;
  /** 連絡取れず時の連絡実施時間（複数可） */
  contactAttemptTimes?: string[];
  /** 処理担当者 */
  assignedTo?: string;
  /** 緯度（地図ピン用） */
  lat: number | null;
  /** 経度（地図ピン用） */
  lng: number | null;
  /** 完了処理：請求書発行日（yyyy-MM-dd） */
  completionEstimateDate?: string;
  /** 完了日（yyyy-MM-dd） */
  completionDate?: string;
  /** 完了処理：見積有効期限（yyyy-MM-dd） */
  completionEstimateExpiry?: string;
  /** 完了処理：出力書類種別（印刷タイトル用） */
  completionOutputType?: "report" | "estimate" | "invoice";
  /** 完了処理：御中（宛先） */
  completionRecipient?: string;
  /** 完了処理：請求先郵便番号 */
  completionRecipientPostalCode?: string;
  /** 完了処理：請求先住所 */
  completionRecipientAddress?: string;
  /** 完了処理：御社指定No */
  completionRecipientSpecifiedNo?: string;
  /** 完了処理：現場情報（お客様名） */
  completionSiteCustomerName?: string;
  /** 完了処理：現場住所 */
  completionSiteAddress?: string;
  /** 完了処理：作業内容（修理内容詳細） */
  completionRepairDetail?: string;
  /** 完了処理：出張料（3500円等） */
  completionTripFee?: string;
  /** 完了処理：技術料（合計） */
  completionTechnicalFee?: string;
  /** 完了処理：技術料 数量 */
  completionTechnicalQty?: string;
  /** 完了処理：技術料 単価 */
  completionTechnicalUnitPrice?: string;
  /** 完了処理：使用部品（部品名称） */
  completionPartsUsed?: string;
  /** 完了処理：使用部品（部品品番） */
  completionPartsPartNo?: string;
  /** 完了処理：使用部品（オーダー番号） */
  completionPartsOrderNo?: string;
  /** 完了処理：使用部品 数量 */
  completionPartsQty?: string;
  /** 完了処理：使用部品 単価 */
  completionPartsUnitPrice?: string;
  /** 完了処理：使用部品 合計 */
  completionPartsTotal?: string;
  /** 完了処理：小計 */
  completionSubtotal?: string;
  /** 完了処理：税率（％） */
  completionTaxRate?: string;
  /** 完了処理：ご請求金額（税込） */
  completionTotalAmount?: string;
  /** 完了処理：入金状況（true=入金済、未設定は入金未） */
  completionPaymentReceived?: boolean;
  /** 完了処理：入金予定日（yyyy-MM-dd） */
  completionExpectedPaymentDate?: string;
  /** 請求書発行日時（請求書を印刷した日時・ISO文字列。発行した案件の対象判定に使用） */
  invoiceIssuedAt?: string;
  /** 完了処理：備考 */
  completionRemarks?: string;
  /** 完了処理：パーキング使用（部品名称がボタン軸のとき） */
  completionParkingUsed?: boolean;
  /** 完了処理：パーキング代（円） */
  completionParkingFee?: string;
  /** 完了処理：パーキングレシート画像（Data URL） */
  completionParkingReceiptImageDataUrl?: string;
  /** 完了処理：入荷場所or保管場所（部品名称がボタン軸のとき） */
  completionStoragePlace?: string;
  /** 完了処理：ガス漏れチェック画像（Data URL） */
  completionGasLeakCheckImageDataUrl?: string;
  /** 完了処理：作業前写真（Data URL配列・最大3枚） */
  completionBeforeWorkPhotos?: string[];
  /** 完了処理：作業中写真（Data URL配列・最大3枚） */
  completionDuringWorkPhotos?: string[];
  /** 完了処理：作業後写真（Data URL配列・最大3枚） */
  completionAfterWorkPhotos?: string[];
  /** 完了処理：お客様サイン画像（Data URL） */
  completionCustomerSignatureDataUrl?: string;
  /** 完了詳細（Difyナレッジ連携用・症状分類・確定原因・解決方法要約など） */
  completionDetail?: CompletionDetail;
  /** Difyナレッジへ登録済みか */
  difySynced?: boolean;
  /** Dify登録日時（ISO文字列） */
  difySyncedAt?: string | null;
  /** DifyドキュメントID（登録成功時に取得できれば保存） */
  difyDocumentId?: string | null;
  /** Dify登録失敗時のエラーメッセージ */
  difySyncError?: string | null;
  /** 最後にDifyへ送った本文のSHA-256ハッシュ（内容変更検知・再送スキップ用） */
  difyContentHash?: string | null;

  /** 未確認で登録した項目名の一覧（未アクション表示・現場での警告表示・追記で削除） */
  unconfirmed_fields?: string[];

  /** 完了報告書：初回生成日時（ISO文字列）。永続DB用。 */
  report_generated_at?: string | null;
  /** 完了報告書：生成/ダウンロード状態。永続DB用。 */
  report_status?: ReportStatus | null;
  /** 完了報告書：バージョン（任意） */
  report_version?: string | null;
  /** 完了報告書：最終ダウンロード日時（ISO文字列・任意） */
  report_last_downloaded_at?: string | null;
}

/** 完了報告書の生成・ダウンロード状態 */
export type ReportStatus = "not_generated" | "generated" | "downloaded";

export type CaseRecordInput = Omit<CaseRecord, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};
