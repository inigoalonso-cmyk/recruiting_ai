import { NextResponse } from "next/server";
import { deliverCallback } from "@/lib/pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The HappyRobot workflow's final POST node calls this when it finishes:
 *   { "requestId": "...", "selected_ids": [...] }
 * selected_ids may arrive as an array, a JSON string, or { selected_ids: [...] }.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const requestId = String(body?.requestId || "");
  if (!requestId) return NextResponse.json({ error: "missing requestId" }, { status: 400 });

  const ids = coerceIds(body?.selected_ids);
  const delivered = deliverCallback(requestId, ids);
  console.log(`[callback] ${requestId}: ${ids.length} ids, delivered=${delivered}`);
  return NextResponse.json({ ok: delivered });
}

function coerceIds(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((x) => String(x));
  if (val && typeof val === "object" && Array.isArray((val as Record<string, unknown>).selected_ids)) {
    return ((val as Record<string, unknown>).selected_ids as unknown[]).map((x) => String(x));
  }
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
      if (parsed && Array.isArray(parsed.selected_ids)) return parsed.selected_ids.map((x: unknown) => String(x));
    } catch {
      // not JSON — maybe comma/space separated ids
      return val.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}
