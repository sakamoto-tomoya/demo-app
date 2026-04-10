/**
 * 部品管理の型定義（Power Apps Paloma在庫管理のSharePointリストと同じ構成）
 */

/** 入庫管理（pms_入庫管理） */
export interface InboundRecord {
  id: string;
  /** 部品品番 */
  partNo: string;
  /** 部品名 */
  partName?: string;
  /** 入庫日 */
  inboundDate: string;
  /** 入庫数 */
  inboundQty: number;
  /** 入庫担当者 */
  inboundPerson: string;
  /** 出庫担当者 */
  outboundPerson?: string;
  /** 部品代 */
  partCost?: number;
  /** 注文番号（オーダーNo） */
  orderNo?: string;
  /** 入庫場所 */
  inboundPlace?: string;
  /** カメラで撮影した画像（Data URL） */
  cameraImageDataUrl?: string;
  /** フォトライブラリで選択した画像（Data URL） */
  photoImageDataUrl?: string;
  createdAt: string;
}

/** 出庫管理（pms_出庫管理） */
export interface OutboundRecord {
  id: string;
  /** 部品品番 */
  partNo: string;
  /** 出庫日 */
  outboundDate: string;
  /** 部品名称 */
  partName: string;
  /** 出庫数 */
  outboundQty: number;
  /** 出庫担当者 */
  outboundPerson: string;
  /** 受付番号 */
  receptionNo?: string;
  /** オーダー番号 */
  orderNo?: string;
  /** 修理伝票番号 */
  repairSlipNo?: string;
  /** 部品代 */
  partCost?: number;
  /** パーキング料金 */
  parkingFee?: number;
  /** パーキングレシート画像（Data URL） */
  parkingReceiptImageDataUrl?: string;
  /** 使用チェック */
  usageCheck?: string;
  /** 請求区分 */
  billingType?: string;
  /** 保管場所 */
  storagePlace?: string;
  /** 保管場所（車載） */
  storagePlaceVehicle?: string;
  /** 作業前保管場所 */
  storageBeforeWork?: string;
  /** 作業前保管場所（車載） */
  storageBeforeWorkVehicle?: string;
  createdAt: string;
}

/** 部品マスタ（メーカー品番一覧の登録用。入庫・出庫で部品名・単価の参照に利用） */
export interface PartsMasterRecord {
  id: string;
  /** 部品品番（図番） */
  partNo: string;
  /** 部品名称 */
  partName: string;
  /** ガス種（任意） */
  gasType?: string;
  /** 参考単価・定価（任意） */
  partCost?: number;
  createdAt: string;
}

/** 登録一覧テーブル用の1行。列マッピングを明確にする */
export type RegisteredPartRow = {
  id: string;
  partNumber: string | null;
  partName: string | null;
  gasType: string | null;
  unitPrice: number | null;
};

/**
 * 製品型番・製品品番に対する部品品番の対応（Difyナレッジ用）。
 * 型式/品番ごとに部品一覧を登録し、ナレッジとしてDifyに送信できる。
 */
export interface ProductPartsKnowledgeRecord {
  id: string;
  /** 製品型番 または 製品品番 */
  productCode: string;
  /** 製品名（任意・表示用） */
  productName?: string;
  /** 対応する部品品番の一覧 */
  partNos: string[];
  createdAt: string;
}

/** 車載部品（pms_車載部品）＝在庫・棚卸のマスタ */
export interface VehiclePartRecord {
  id: string;
  /** 部品品番 */
  partNo: string;
  /** 保管場所（車載） */
  storagePlaceVehicle: string;
  /** 部品名称 */
  partName: string;
  /** 部品数 */
  quantity: number;
  createdAt: string;
  updatedAt?: string;
}
