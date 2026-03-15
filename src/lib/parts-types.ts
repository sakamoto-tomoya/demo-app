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
