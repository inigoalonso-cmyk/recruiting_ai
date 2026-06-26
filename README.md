# Candidate Finder

AI candidate search over a local data file. A recruiter types who they're looking
for in natural language (Spanish or English) and gets the best-matching candidates,
each with a link to their Ashby profile and LinkedIn. **No scores shown.**

This is the **test build**: no Ashby, no HappyRobot, no login. The only data source
is `data/candidates.json` (10,000 fake candidates). Search is powered by
**multilingual embeddings** — cheap and bilingual (a Spanish query matches an
English profile and vice versa). When it works well, we swap the file for the real
Ashby/HappyRobot backend behind the same data layer.

## How it works

1. **Precompute (once):** `npm run embed` reads `data/candidates.json`, embeds each
   candidate (title + summary + location + languages) with `text-embedding-3-small`
   (256 dims) and writes `data/embeddings.bin` + `data/embeddings-index.json`.
2. **Search (per query):** hard filters (job scope / freshness) → embed the query →
   cosine similarity over the precomputed vectors → return the top N. No chat-LLM
   call per search (≈ free). Optional `RERANK=true` adds a small `gpt-4o-mini`
   reorder over the top ~15.

## Setup

```bash
npm install
cp .env.example .env        # set OPENAI_API_KEY
npm run embed               # precompute embeddings (~1-2 min for 10k)
npm run dev                 # http://localhost:3000
```

## Deploy on Railway

1. Push this folder to a Git repo, create a Railway project from it.
2. Set `OPENAI_API_KEY` (and optionally `OPENAI_EMBED_MODEL`, `RERANK`) in Railway
   env vars.
3. Deploy. The build runs `npm install && npm run embed && npm run build`, then
   starts with `next start`. You get a public URL.

(The embeddings file is generated at build time, so `OPENAI_API_KEY` must be set
in Railway before the first deploy.)

## API

- `POST /api/search` — `{ query, jobId, scope, criteria, minMonthsInactive, limit }`
  → `{ candidates: [ { id, name, location, languages, summary, ashbyUrl, linkedinUrl } ] }`
- `GET /api/jobs` — `{ jobs: [ { id, title } ] }` for the dropdown.
- `GET /api/role-criteria` — saved role templates from `data/role-criteria.json`.

## Layout

```
app/
  page.tsx              search UI (box, dropdown, scope toggle, freshness, cards, export)
  layout.tsx, globals.css
  api/search/route.ts   embeddings search over the file
  api/jobs/route.ts     jobs from the file
  api/role-criteria     role templates
lib/
  mock.ts               loads candidates.json
  embeddings.ts         vector load + cosine ranking + query embedding
  i18n.ts               EN/ES strings + language detection
scripts/embed.ts        precompute embeddings
data/
  candidates.json       10k fake candidates (test data)
  role-criteria.json    editable role templates
```

## Switching to the real backend later

Replace the data access in `lib/mock.ts` / `lib/embeddings.ts` (and the search
route) so it calls the real Ashby + HappyRobot backend instead of reading the file.
The UI and the `/api/search` response shape stay the same. Auth (Google SSO) should
be added back before using real candidate data — the stubs in `lib/auth.ts`,
`lib/session.ts` and `app/api/auth/...` mark where it goes.
```
