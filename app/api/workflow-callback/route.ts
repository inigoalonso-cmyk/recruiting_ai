import { NextResponse } from "next/server";
import { deliverCallback, deliverToOldest } from "@/lib/pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The HappyRobot workflow's final POST node calls this when it finishes:
 *   { "requestId": "...", "selected_ids": [...] }
 * requestId may also arrive as a `?rid=` query param (more reliable than the body).
 * selected_ids may arrive as an array, a JSON string, or { selected_ids: [...] }.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ridFromQuery = new URL(req.url).searchParams.get("rid") || "";
  const requestId = String(body?.requestId || ridFromQuery || "");

  const ids = coerceIds(body?.selected_ids);
  // Match by requestId; if none came through, deliver to the single waiting search.
  const delivered = requestId ? deliverCallback(requestId, ids) : deliverToOldest(ids);
  console.log(`[callback] id=${requestId || "(none)"}: ${ids.length} ids, delivered=${delivered}`);
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
