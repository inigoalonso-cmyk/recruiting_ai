"use client";

import { useEffect, useMemo, useState } from "react";
import { dict, detectLang, type Lang } from "@/lib/i18n";

type Candidate = {
  id: string;
  name: string;
  location: string;
  languages: string[];
  summary: string;
  ashbyUrl: string;
  linkedinUrl: string | null;
};
type Job = { id: string; title: string };
type Role = { id: string; label: string; criteria: string };

/** Rotating example prompts, bilingual EN/ES. */
const EXAMPLES = [
  "Looking for a forward deployed engineer in San Francisco",
  "Busco un diseñador de producto en Berlín que hable alemán",
  "Senior backend engineer in London, fluent in English",
  "Busco un ingeniero de ventas en Madrid con experiencia enterprise",
];

/** Initials for the avatar, e.g. "Fatima Smith" -> "FS". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/** Stable hue from a name so each avatar gets a consistent colour. */
function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

type Seniority = "lead" | "senior" | "mid" | "junior";
/** Seniority is conveyed in the summary text (lead / senior / mid-level / junior). */
function seniority(summary: string): Seniority | null {
  const s = summary.toLowerCase();
  if (/\blead\b/.test(s)) return "lead";
  if (/\bsenior\b/.test(s)) return "senior";
  if (/\bmid-level\b|\bmid\b/.test(s)) return "mid";
  if (/\bjunior\b/.test(s)) return "junior";
  return null;
}

export default function Page() {
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState("");
  const [scope, setScope] = useState<"job" | "pool">("pool");
  const [months, setMonths] = useState(0);
  const [limit, setLimit] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [phIdx, setPhIdx] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const lang: Lang = useMemo(() => detectLang(query), [query]);
  const t = dict[lang];

  useEffect(() => {
    fetch("/api/jobs").then((r) => r.json()).then((d) => setJobs(d.jobs || [])).catch(() => {});
    fetch("/api/role-criteria").then((r) => r.json()).then((d) => setRoles(d.roles || [])).catch(() => {});
  }, []);

  // Rotate the placeholder examples while the box is empty.
  useEffect(() => {
    const id = setInterval(() => setPhIdx((i) => (i + 1) % EXAMPLES.length), 3800);
    return () => clearInterval(id);
  }, []);

  const senLabel: Record<Seniority, string> = {
    lead: t.senLead, senior: t.senSenior, mid: t.senMid, junior: t.senJunior,
  };

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(false);
    setResults(null);
    setSelected(new Set());
    const criteria = roles.find((r) => r.id === roleId)?.criteria ?? null;
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, jobId: jobId || null, scope, criteria, minMonthsInactive: months || null, limit }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.candidates || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const chosen = (results || []).filter((c) => selected.has(c.id));

  function exportCsv() {
    const rows = [
      ["name", "location", "languages", "summary", "ashbyUrl", "linkedinUrl"],
      ...chosen.map((c) => [c.name, c.location, (c.languages || []).join("; "), c.summary, c.ashbyUrl, c.linkedinUrl || ""]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "shortlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyList() {
    const md = chosen
      .map((c) => `- **${c.name}** — ${c.location}\n  Ashby: ${c.ashbyUrl}${c.linkedinUrl ? `\n  LinkedIn: ${c.linkedinUrl}` : ""}`)
      .join("\n");
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      {/* Logo lives in the background image (bg.png), so the top area stays minimal. */}
      <header className="topbar">
        <span>Candidate Finder</span>
      </header>

      <main className="wrap">
        <div className="hero">
          <h1 className="h1">{t.title}</h1>
          <p className="sub">{t.subtitle}</p>

          <div className="searchbox-wrap">
            <textarea
              className="searchbox"
              placeholder={EXAMPLES[phIdx]}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  runSearch();
                }
              }}
            />
            <button className="send" onClick={runSearch} disabled={loading || !query.trim()}>
              {loading ? t.searching : t.search}
            </button>
          </div>

          {/* Ghost trigger for the collapsible filters — keeps the area clean by default. */}
          <div className="filters-row">
            <button
              className={`filters-toggle ${showFilters ? "open" : ""}`}
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {t.filters}
            </button>
          </div>

          {showFilters && (
            <div className="filters-panel">
              <div className="field">
                <label>{t.job}</label>
                <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  <option value="">{t.allJobs}</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Scope</label>
                <div className="toggle">
                  <button className={scope === "job" ? "active" : ""} onClick={() => setScope("job")}>{t.scopeJob}</button>
                  <button className={scope === "pool" ? "active" : ""} onClick={() => setScope("pool")}>{t.scopePool}</button>
                </div>
              </div>

              <div className="field">
                <label>{t.role}</label>
                <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  <option value="">{t.none}</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>

              <div className="field">
                <label>{t.freshness}</label>
                <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                  <option value={0}>{t.freshnessAny}</option>
                  <option value={3}>3{t.months}</option>
                  <option value={6}>6{t.months}</option>
                  <option value={12}>12{t.months}</option>
                </select>
              </div>

              <div className="field">
                <label>{t.limit}</label>
                <input className="num" type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="results">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton">
                <div className="sk-avatar" />
                <div className="sk-lines">
                  <div className="sk-line w60" />
                  <div className="sk-line w40" />
                  <div className="sk-line w90" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="results">
            <div className="notice notice-error">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="notice-title">{t.errorTitle}</p>
              <p className="notice-text">{t.error}</p>
            </div>
          </div>
        )}

        {!loading && !error && results && results.length === 0 && (
          <div className="results">
            <div className="notice">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="notice-title">{t.emptyTitle}</p>
              <p className="notice-text">{t.empty}</p>
            </div>
          </div>
        )}

        {!loading && !error && results && results.length > 0 && (
          <>
            <p className="results-summary">
              {results.length} {results.length === 1 ? t.candidate : t.candidates}
            </p>

            <div className="results">
              {results.map((c, i) => {
                const sen = seniority(c.summary);
                return (
                  <div key={c.id} className="card" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={c.name} />
                    <div className="avatar" style={{ background: `hsl(${hue(c.name)} 45% 32%)` }}>
                      {initials(c.name)}
                    </div>
                    <div className="card-body">
                      <h3 className="card-name">{c.name}</h3>
                      <p className="card-sub">
                        <span>{c.location}</span>
                        {sen && <span className={`badge badge-${sen}`}>{senLabel[sen]}</span>}
                      </p>
                      {c.languages?.length > 0 && (
                        <div className="pills">
                          {c.languages.map((l) => <span key={l} className="pill">{l}</span>)}
                        </div>
                      )}
                      <p className="summary">{c.summary}</p>
                      <div className="links">
                        <a className="link-btn" href={c.ashbyUrl} target="_blank" rel="noreferrer">{t.openAshby}</a>
                        {c.linkedinUrl && <a className="link-btn" href={c.linkedinUrl} target="_blank" rel="noreferrer">{t.viewLinkedin}</a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bar">
              <span className="muted">{chosen.length} {t.selected}</span>
              <span style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" onClick={exportCsv} disabled={!chosen.length}>{t.exportCsv}</button>
                <button className="btn btn-ghost" onClick={copyList} disabled={!chosen.length}>
                  {copied ? t.copied : t.copyList}
                </button>
              </span>
            </div>
          </>
        )}
      </main>
    </>
  );
}
