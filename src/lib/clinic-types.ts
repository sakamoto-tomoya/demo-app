export type ClinicReceptionStatus =
  | "provisional"
  | "checked_in"
  | "waiting"
  | "calling"
  | "in_consultation"
  | "done"
  | "absent"
  | "cancelled";

export type ClinicOriginType = "home" | "current" | "none";

/** マイナ連携デモで保存する JSON の型（@/lib/clinic-mynumber-demo と一致） */
export type ClinicIntegrationsPayload = {
  kind: "mynumber_demo_v1";
  linkedAt: string;
  /** マイナに登録された住所の都道府県（デモ）。ALL＝全国表示で取得した場合 */
  mynumberSnapshot?: {
    registeredAddressPrefecture: string;
  };
  familyHospital: { id: string; name: string; city: string };
  prescriptions: { id: string; label: string; issuedOn: string; prescriber: string }[];
};

export type ClinicMynumberDemoSummary = {
  linked: boolean;
  hospitalLine: string;
  prescriptionCount: number;
  prescriptionLabels: string[];
  /** 取得時に使ったマイナ登録住所（都道府県）のデモ。全国のときは「全国」 */
  mynumberAddressPrefecture: string | null;
};

export type ClinicReceptionRow = {
  id: string;
  serviceDate: string;
  receptionNo: number;
  department: string;
  patientName: string;
  birthDate: string;
  phone: string;
  firstVisit: boolean;
  symptomNote: string;
  originType: ClinicOriginType;
  originText: string;
  travelMinutes: number;
  notifyPush: boolean;
  notifyCall: boolean;
  status: ClinicReceptionStatus;
  sessionToken: string;
  createdAt: string;
  updatedAt: string;
  integrationsJson: string | null;
  integrations: ClinicIntegrationsPayload | null;
};

/** 管理画面・API 用（電話マスク済み、トークンなし） */
export type ClinicReceptionPublic = Omit<
  ClinicReceptionRow,
  "sessionToken" | "phone" | "integrationsJson" | "integrations"
> & {
  phoneMasked: string;
  mynumberDemo: ClinicMynumberDemoSummary | null;
};

export type ClinicMonitorState = {
  serviceDate: string;
  callingReceptionNo: number | null;
  nextReceptionNo: number | null;
  announcement: string;
  avgConsultMinutes: number;
  updatedAt: string;
};

/** 予約（clinic_appointments） */
export type ClinicAppointmentStatus = "confirmed" | "cancelled" | "completed" | "no_show";

export type ClinicAppointmentPublic = {
  id: string;
  hospitalId: string;
  hospitalName: string;
  appointmentDate: string;
  startTime: string;
  durationMinutes: number;
  department: string;
  patientName: string;
  birthDate: string;
  phoneMasked: string;
  firstVisit: boolean;
  symptomNote: string;
  originType: ClinicOriginType;
  originText: string;
  travelMinutes: number;
  notifyPush: boolean;
  notifyCall: boolean;
  status: ClinicAppointmentStatus;
  createdAt: string;
  updatedAt: string;
  mynumberDemo: ClinicMynumberDemoSummary | null;
};
