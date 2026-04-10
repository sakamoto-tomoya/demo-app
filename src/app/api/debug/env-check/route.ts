import { guardDebugRoute } from "@/lib/debug-route-guard";
import { NextRequest, NextResponse } from "next/server";

// 開発用: 環境変数の設定状況を確認するための簡易API
// 本番にデプロイする場合は、このファイルを削除するか保護してください。

function check(name: string): string {
  const v = process.env[name];
  if (v === undefined) return "MISSING";
  if (String(v).trim() === "") return "EMPTY";
  return "OK";
}

export async function GET(request: NextRequest) {
  const guard = await guardDebugRoute(request);
  if (guard) return guard;

  const result = {
    SETTINGS_PASSWORD: check("SETTINGS_PASSWORD"),

    AUTH_SECRET: check("AUTH_SECRET"),
    AUTH_GOOGLE_ID: check("AUTH_GOOGLE_ID"),
    AUTH_GOOGLE_SECRET: check("AUTH_GOOGLE_SECRET"),
    AUTH_URL: check("AUTH_URL"),

    GOOGLE_APPLICATION_CREDENTIALS: check("GOOGLE_APPLICATION_CREDENTIALS"),
    GOOGLE_CLOUD_PROJECT_ID: check("GOOGLE_CLOUD_PROJECT_ID"),
    DOCUMENT_AI_LOCATION: check("DOCUMENT_AI_LOCATION"),
    DOCUMENT_AI_PROCESSOR_ID: check("DOCUMENT_AI_PROCESSOR_ID"),

    NEXT_PUBLIC_SALESFORCE_URL: check("NEXT_PUBLIC_SALESFORCE_URL"),

    DIFY_BASE_URL: check("DIFY_BASE_URL"),
    DIFY_API_KEY: check("DIFY_API_KEY"),
    DIFY_APP_API_KEY: check("DIFY_APP_API_KEY"),
    DIFY_REPAIR_ASSIST_API_KEY: check("DIFY_REPAIR_ASSIST_API_KEY"),
    DIFY_REPAIR_ASSIST_WORKFLOW_URL: check("DIFY_REPAIR_ASSIST_WORKFLOW_URL"),
    DIFY_RECEPTION_CHECK_API_KEY: check("DIFY_RECEPTION_CHECK_API_KEY"),
    DIFY_RECEPTION_CHECK_URL: check("DIFY_RECEPTION_CHECK_URL"),
    DIFY_CASE_WORKFLOW_API_KEY: check("DIFY_CASE_WORKFLOW_API_KEY"),
    DIFY_CASE_WORKFLOW_URL: check("DIFY_CASE_WORKFLOW_URL"),
    DIFY_WORKFLOW_API_KEY: check("DIFY_WORKFLOW_API_KEY"),
    DIFY_WORKFLOW_URL: check("DIFY_WORKFLOW_URL"),
    DIFY_KNOWLEDGE_API_KEY: check("DIFY_KNOWLEDGE_API_KEY"),
    DIFY_KNOWLEDGE_DATASET_ID: check("DIFY_KNOWLEDGE_DATASET_ID"),
    DIFY_RECEPTION_KNOWLEDGE_DATASET_ID: check("DIFY_RECEPTION_KNOWLEDGE_DATASET_ID"),
    DIFY_REPAIR_HISTORY_DATASET_ID: check("DIFY_REPAIR_HISTORY_DATASET_ID"),
    DIFY_DATASET_ID: check("DIFY_DATASET_ID"),

    TURSO_DATABASE_URL: check("TURSO_DATABASE_URL"),
    TURSO_AUTH_TOKEN: check("TURSO_AUTH_TOKEN"),
  };

  return NextResponse.json(result);
}

