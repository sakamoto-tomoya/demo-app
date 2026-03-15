import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getEmailConfig } from "@/lib/email-config";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

type InboundNotifyBody = {
  toEmails: string[];
  record: {
    partNo: string;
    partName?: string;
    inboundDate: string;
    inboundQty: number;
    inboundPerson: string;
    outboundPerson?: string;
    partCost?: number;
    orderNo?: string;
  };
};

function buildMessage(record: InboundNotifyBody["record"]): string {
  const lines = [
    "【入庫登録の通知】",
    "",
    `部品品番: ${record.partNo}`,
    record.partName ? `部品名: ${record.partName}` : null,
    `入庫日: ${record.inboundDate}`,
    `入庫数: ${record.inboundQty}`,
    `入庫担当者: ${record.inboundPerson}`,
    `出庫担当者: ${record.outboundPerson ?? "—"}`,
    record.partCost != null ? `部品代: ${record.partCost}` : null,
    record.orderNo ? `注文番号: ${record.orderNo}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;
  if (isDemoMode) {
    return NextResponse.json(
      { sent: false, reason: "デモモードではメール送信できません。" },
      { status: 403 }
    );
  }
  try {
    const body = (await request.json()) as InboundNotifyBody;
    const { toEmails, record } = body;
    if (!Array.isArray(toEmails) || toEmails.length === 0) {
      return NextResponse.json({ sent: false, reason: "toEmails required" }, { status: 400 });
    }
    const validEmails = toEmails.filter((e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));
    if (validEmails.length === 0) {
      return NextResponse.json({ sent: false, reason: "No valid email addresses" }, { status: 400 });
    }

    const emailConfig = getEmailConfig();
    if (!emailConfig) {
      return NextResponse.json(
        { sent: false, reason: "メール設定がありません。設定ページの「メール設定」でSMTPを設定してください。" },
        { status: 200 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465,
      auth: { user: emailConfig.user, pass: emailConfig.pass },
    });

    const text = buildMessage(record);
    await transporter.sendMail({
      from: emailConfig.from,
      to: validEmails,
      subject: `【入庫登録】${record.partNo} - ${record.inboundDate}`,
      text,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[inbound/notify]", err instanceof Error ? err.message : "error");
    return NextResponse.json(
      { sent: false, reason: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    );
  }
}
