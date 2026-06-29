import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { loadMockData, narrow, monthsAgoDate, type MockCandidate } from "@/lib/mock";
import { embeddingsExist, loadIndex, loadVectors, embedQuery, rankByEmbedding } from "@/lib/embeddings";
import { waitForCallback } from "@/lib/pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NARROW_CAP = 60;            // candidates handed to the workflow agent
const CALLBACK_TIMEOUT_MS = 45000; // how long we wait for the workflow callback

type Body = {
  query: string;
  jobId?: string | null;
  scope?: "job" | "pool";
  criteria?: string | null;
  minMonthsInactive?: number | null;
  limit?: number;
};

function toResult(c: MockCandidate) {
  return {
    id: c.id, name: c.name, location: c.location, languages: c.languages,
    summary: c.summary, ashbyUrl: c.ashbyUrl, linkedinUrl: c.linkedinUrl,
  };
}

function baseUrl(req: Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return host ? `${proto}://${host}` : "";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const query = String(body.query || "").trim();
  if (!query) return NextResponse.json({ candidates: [] });
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
  const criteria = body.criteria ?? null;

  // 1. Load + hard filters
  const data = await loadMockData();
  let candidates: MockCandidate[] = data.candidates;
  if (body.scope === "job" && body.jobId) candidates = candidates.filter((c) => c.appliedJobId === body.jobId);
  if (body.minMonthsInactive && body.minMonthsInactive > 0) {
    const cutoff = monthsAgoDate(body.minMonthsInactive);
    candidates = candidates.filter((c) => new Date(c.lastActivityAt) < cutoff);
  }
  if (candidates.length === 0) return NextResponse.json({ candidates: [] });

  // 2. Narrow to a manageable shortlist for the agent
  let narrowed: MockCandidate[];
  try {
    if (embeddingsExist() && process.env.OPENAI_API_KEY) {
      const qVec = await embedQuery(criteria ? `${query} ${criteria}` : query);
      const index = loadIndex();
      const vectors = loadVectors();
      const ids = rankByEmbedding(qVec, candidates.map((c) => c.id), index, vectors, NARROW_CAP);
      const byId = new Map(candidates.map((c) => [c.id, c]));
      narrowed = ids.map((id) => byId.get(id)!).filter(Boolean);
    } else {
      narrowed = narrow(candidates, query, criteria, NARROW_CAP);
    }
  } catch {
    narrowed = narrow(candidates, query, criteria, NARROW_CAP);
  }

  const webhook = process.env.HAPPYROBOT_WEBHOOK_URL;

  // 3a. No workflow connected -> local fallback so the UI still works.
  if (!webhook) {
    return NextResponse.json({ candidates: narrowed.slice(0, limit).map(toResult) });
  }

  // 3b. Delegate to the HappyRobot workflow, then wait for its callback.
  const requestId = randomUUID();
  const callbackUrl = `${baseUrl(req)}/api/workflow-callback?rid=${requestId}`;
  const wait = waitForCallback(requestId, CALLBACK_TIMEOUT_MS);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.HAPPYROBOT_WEBHOOK_SECRET) headers["X-Webhook-Secret"] = process.env.HAPPYROBOT_WEBHOOK_SECRET;
  const payload = {
    query, criteria, limit, requestId, callbackUrl,
    candidates: narrowed.map((c) => ({
      id: c.id, name: c.name, location: c.location, languages: c.languages,
      title: c.title, summary: c.summary, ashbyUrl: c.ashbyUrl, linkedinUrl: c.linkedinUrl,
    })),
  };

  try {
    const res = await fetch(webhook, { method: "POST", headers, body: JSON.stringify(payload), cache: "no-store" });
    if (!res.ok) {
      console.error("[search] webhook returned", res.status);
      return NextResponse.json({ error: `Workflow returned ${res.status}` }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Could not reach the HappyRobot workflow" }, { status: 502 });
  }

  const ids = await wait;
  if (!ids) {
    console.warn("[search] callback timed out for", requestId);
    return NextResponse.json({ error: "Workflow timed out" }, { status: 504 });
  }

  const byId = new Map(narrowed.map((c) => [c.id, c]));
  const picked = ids
    .map((id) => byId.get(id))
    .filter((c): c is MockCandidate => Boolean(c))
    .map(toResult);
  console.log(`[search] callback ${requestId}: ${ids.length} ids, matched ${picked.length}`);
  return NextResponse.json({ candidates: picked });
}
