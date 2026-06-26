import fs from "fs/promises";
import path from "path";

export type MockCandidate = {
  id: string;
  name: string;
  email?: string;
  location: string;
  languages: string[];
  title: string;
  summary: string;
  appliedJobId: string;
  appliedJobTitle: string;
  stage: string;
  lastActivityAt: string;
  tags?: string[];
  ashbyUrl: string;
  linkedinUrl: string | null;
};
export type MockData = { jobs: { id: string; title: string }[]; candidates: MockCandidate[] };

let cache: MockData | null = null;

export async function loadMockData(): Promise<MockData> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "candidates.json");
  const raw = await fs.readFile(filePath, "utf-8");
  cache = JSON.parse(raw) as MockData;
  return cache;
}

const STOP = new Set([
  "the","and","with","that","this","for","from","who","whose","someone","a","an","of","in","on","to",
  "busco","que","con","una","uno","alguien","de","en","experiencia","habla","hable","sepa","y","el","la",
  "looking","need","want","find","fluent","speaks","based","years","year","experience",
]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-zà-ÿ0-9]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Stage A — cheap narrowing so we never send ~1,000 candidates to the LLM.
 * Lexical relevance score over the candidate's text; returns the top `cap`.
 * (The real backend will use vector retrieval here; this mirrors the shape.)
 */
export function narrow(candidates: MockCandidate[], query: string, criteria: string | null, cap: number): MockCandidate[] {
  if (candidates.length <= cap) return candidates;
  const qTokens = new Set(tokens(`${query} ${criteria || ""}`));
  const scored = candidates.map((c) => {
    const hay = `${c.title} ${c.summary} ${c.location} ${c.languages.join(" ")} ${(c.tags || []).join(" ")}`.toLowerCase();
    let score = 0;
    qTokens.forEach((t) => { if (hay.includes(t)) score += 1; });
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map((s) => s.c);
}

export function monthsAgoDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}
