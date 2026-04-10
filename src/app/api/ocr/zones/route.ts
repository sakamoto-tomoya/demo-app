import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

export type ZoneDefinition = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ZoneTemplateResponse = {
  id: string;
  name: string;
  page: number;
  zones: ZoneDefinition[];
};

const ZONES_DIR = path.join(process.cwd(), "src", "config", "ocr-zones");

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "with_requester";
  const safeId = id === "without_requester" ? "without_requester" : "with_requester";
  const p = path.join(ZONES_DIR, `${safeId}.json`);
  if (!existsSync(p)) {
    return NextResponse.json({ error: "Zone template not found" }, { status: 404 });
  }
  const raw = readFileSync(p, "utf-8");
  const template = JSON.parse(raw) as ZoneTemplateResponse;
  return NextResponse.json(template);
}
