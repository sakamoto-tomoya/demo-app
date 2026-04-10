import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import type { OcrTemplate } from "@/lib/ocr/extractFields-types";

const TEMPLATES_DIR = path.join(process.cwd(), "src", "config", "ocr-templates");

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "paloma-default";
  const p = path.join(TEMPLATES_DIR, `${id}.json`);
  if (!existsSync(p)) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  const raw = readFileSync(p, "utf-8");
  const template = JSON.parse(raw) as OcrTemplate;
  return NextResponse.json(template);
}
