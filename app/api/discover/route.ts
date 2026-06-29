import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  query: string;
  limit?: number;
};

type SerpResult = {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
};

/** Strip the trailing " - LinkedIn" / " | LinkedIn" site suffix from result titles. */
function cleanName(title: string): string {
  return title.replace(/\s*[-|]\s*LinkedIn\s*$/i, "").trim();
}

function toCandidate(r: SerpResult, idx: number) {
  const link = r.link || "";
  const isLinkedin = /linkedin\.com/i.test(link);
  return {
    id: link || String(r.position ?? idx),
    name: cleanName(r.title || "").trim() || "Unknown",
    location: "",
    languages: [] as string[],
    summary: r.snippet || "",
    ashbyUrl: null,
    linkedinUrl: isLinkedin ? link : null,
    sourceUrl: link || null,
  };
}

async function serpSearch(q: string, num: number, apiKey: string): Promise<SerpResult[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", q);
  url.searchParams.set("num", String(num));
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`SerpAPI returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.organic_results) ? (data.organic_results as SerpResult[]) : [];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const query = String(body.query || "").trim();
  if (!query) return NextResponse.json({ candidates: [] });

  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 20);

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.error("[discover] missing SERPAPI_KEY");
    return NextResponse.json({ error: "Online discovery is not configured." }, { status: 500 });
  }

  try {
    // Bias toward public professional profiles with the site: filter.
    let organic = await serpSearch(`${query} site:linkedin.com/in`, limit, apiKey);
    // If the site: filter returns nothing, retry once without it.
    if (organic.length === 0) {
      organic = await serpSearch(query, limit, apiKey);
    }
    const candidates = organic.slice(0, limit).map(toCandidate);
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[discover] SerpAPI failure", err);
    return NextResponse.json({ error: "Could not reach the online search provider." }, { status: 502 });
  }
}
