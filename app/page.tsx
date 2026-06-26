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

export default function Page() {
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState("");
  const [scope, setScope] = useState<"job" | "pool">("pool");
  const [months, setMonths] = useState(0);
  const [limit, setLimit] = useState(10);

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
              placeholder={t.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runSearch(); } }}
            />
            <button className="send" onClick={runSearch} disabled={loading || !query.trim()}>
              {loading ? t.searching : t.search}
            </button>
          </div>
        </div>

      <div className="controls">
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

      {loading && (
        <div className="results">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      )}

      {!loading && error && <div className="results"><div className="notice">{t.error}</div></div>}

      {!loading && !error && results && results.length === 0 && (
        <div className="results"><div className="notice">{t.empty}</div></div>
      )}

      {!loading && !error && results && results.length > 0 && (
        <>
          <div className="results">
            {results.map((c) => (
              <div key={c.id} className="card">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <div style={{ flex: 1 }}>
                  <h3>{c.name}</h3>
                  <p className="meta">
                    {c.location}
                    {c.languages?.length ? ` · ${t.languages}: ${c.languages.join(", ")}` : ""}
                  </p>
                  <p className="summary">{c.summary}</p>
                  <div className="links">
                    <a className="link" href={c.ashbyUrl} target="_blank" rel="noreferrer">{t.openAshby}</a>
                    {c.linkedinUrl && <a className="link" href={c.linkedinUrl} target="_blank" rel="noreferrer">{t.viewLinkedin}</a>}
                  </div>
                </div>
              </div>
            ))}
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
