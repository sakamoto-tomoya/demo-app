import { NextRequest, NextResponse } from "next/server";
import { cancelReservation } from "@/lib/restaurant-reservation";
import { getTursoClient } from "@/lib/turso";

const DEMO_MODE =
  !process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET_KEY === "sk_test_demo" ||
  process.env.STRIPE_SECRET_KEY.startsWith("sk_test_demo");

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      reservationId?: string;
      reservationNumber?: string;
      paymentMethod?: "onsite_cash" | "credit_card";
      stripeSessionId?: string;
      totalAmount?: number;
    };

    const reservationNumber = String(body.reservationNumber ?? "").trim();
    const paymentMethod = body.paymentMethod ?? "onsite_cash";
    const stripeSessionId = String(body.stripeSessionId ?? "").trim();

    if (!reservationNumber) {
      return NextResponse.json({ success: false, error: "予約番号が必要です。" }, { status: 400 });
    }

    // 予約ステータスをキャンセルに更新（既存のcancelReservation関数を使用）
    // メールアドレスが必要なため、DBから取得
    const client = getTursoClient();
    const dbRes = await client.execute({
      sql: `SELECT reservation_json FROM restaurant_reservations WHERE reservation_number = ? LIMIT 1`,
      args: [reservationNumber],
    });

    if (dbRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "予約情報が見つかりませんでした。" }, { status: 404 });
    }

    let reservationJson: { status?: string; email?: string } = {};
    try {
      reservationJson = JSON.parse(String(dbRes.rows[0].reservation_json)) as { status?: string; email?: string };
    } catch {
      return NextResponse.json({ success: false, error: "予約データの読み込みに失敗しました。" }, { status: 500 });
    }

    if (reservationJson.status === "cancelled") {
      return NextResponse.json({ success: false, error: "この予約はすでにキャンセルされています。" }, { status: 400 });
    }

    const email = reservationJson.email ?? "";

    // Stripe返金処理 (クレジットカードの場合)
    let refundId: string | undefined;
    if (paymentMethod === "credit_card" && stripeSessionId) {
      if (DEMO_MODE || stripeSessionId.startsWith("demo_")) {
        // デモモード: 返金処理をスキップ
        console.log("[cancel-reservation] [TEST MODE] 返金処理をスキップしました");
        refundId = `demo_re_${Date.now()}`;
      } else {
        // 本番Stripe返金
        try {
          const Stripe = (await import("stripe")).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" });

          // Checkout SessionからPaymentIntentを取得
          const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
          const paymentIntentId = session.payment_intent;

          if (!paymentIntentId || typeof paymentIntentId !== "string") {
            return NextResponse.json(
              { success: false, error: "決済情報が見つかりませんでした。" },
              { status: 400 }
            );
          }

          // 全額返金
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: "requested_by_customer",
          });
          refundId = refund.id;
        } catch (stripeError) {
          console.error("[cancel-reservation] Stripe refund error:", stripeError);
          return NextResponse.json(
            { success: false, error: "返金処理に失敗しました。しばらく経ってから再度お試しください。" },
            { status: 500 }
          );
        }
      }
    }

    // 予約をキャンセル状態に更新
    const cancelResult = await cancelReservation({
      reservationNumber,
      email,
      reason: paymentMethod === "credit_card" ? "クレジットカード決済後キャンセル（返金済み）" : "顧客都合によるキャンセル",
    });

    if (!cancelResult.ok) {
      return NextResponse.json(
        { success: false, error: cancelResult.error ?? "キャンセル処理に失敗しました。" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      refundId,
      message: paymentMethod === "credit_card" ? "返金処理が完了しました" : "キャンセルが完了しました",
    });
  } catch (error) {
    console.error("[api/cancel-reservation] POST error:", error);
    return NextResponse.json({ success: false, error: "キャンセル処理でエラーが発生しました。" }, { status: 500 });
  }
}
