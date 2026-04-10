import { NextRequest, NextResponse } from "next/server";
import { requireAccessAuth } from "@/lib/access-auth";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Guard for debug endpoints:
 * - Enabled only in development by default.
 * - Can be explicitly enabled in production via DEBUG_API_ENABLED=true.
 * - Applies existing access gate and basic rate limiting.
 */
export async function guardDebugRoute(request: NextRequest): Promise<Response | null> {
  const enabledInProd = process.env.DEBUG_API_ENABLED === "true";
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && !enabledInProd) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;

  const rateErr = checkRateLimit(request);
  if (rateErr) return rateErr;

  return null;
}
