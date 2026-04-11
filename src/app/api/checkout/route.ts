import { NextRequest, NextResponse } from "next/server";

const DEMO_MODE =
  !process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET_KEY === "sk_test_demo" ||
  process.env.STRIPE_SECRET_KEY.startsWith("sk_test_demo");

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      menuId?: string;
      menuName?: string;
      menuPrice?: number;
      people?: number;
      date?: string;
      time?: string;
      customerName?: string;
      phone?: string;
      email?: string;
    };

    const menuName = String(body.menuName ?? "コース").trim();
    const menuPrice = Number(body.menuPrice ?? 0);
    const people = Number(body.people ?? 1);
    const date = String(body.date ?? "").trim();
    const time = String(body.time ?? "").trim();

    if (!menuPrice || !people || !date || !time) {
      return NextResponse.json({ error: "必要なパラメータが不足しています。" }, { status: 400 });
    }

    if (DEMO_MODE) {
      // デモモード: Stripe APIを呼ばずモックURLを返す
      console.log("[checkout] デモモード: Stripe Checkout をスキップします");
      const origin = request.headers.get("origin") ?? "http://localhost:3000";
      const demoSessionId = `demo_cs_${Date.now()}`;
      const successUrl = `${origin}/restaurant-reservation/complete?session_id=${demoSessionId}&demo=true`;
      return NextResponse.json({ url: successUrl, demo: true, sessionId: demoSessionId });
    }

    // 本番Stripe
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" });

    const origin = request.headers.get("origin") ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: `${menuName} × ${people}名`,
              description: `${date} ${time} のご予約`,
            },
            unit_amount: menuPrice,
          },
          quantity: people,
        },
      ],
      mode: "payment",
      customer_email: body.email ?? undefined,
      success_url: `${origin}/restaurant-reservation/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/restaurant-reservation/payment`,
      metadata: {
        menuId: String(body.menuId ?? ""),
        menuName,
        menuPrice: String(menuPrice),
        people: String(people),
        date,
        time,
        customerName: String(body.customerName ?? ""),
        phone: String(body.phone ?? ""),
        email: String(body.email ?? ""),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Checkout Session URLの生成に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("[api/checkout] POST error:", error);
    return NextResponse.json({ error: "決済処理でエラーが発生しました。" }, { status: 500 });
  }
}
