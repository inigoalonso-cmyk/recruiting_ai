/**
 * Precompute candidate embeddings (run once, or whenever candidates.json changes):
 *   npm run embed
 * Writes data/embeddings.bin (Float32 matrix) + data/embeddings-index.json (id order).
 * This is the only place candidates are embedded; search just embeds the query.
 */
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const EMBED_DIM = 256;
const BATCH = 200;

type Candidate = { id: string; title: string; summary: string; location: string; languages: string[] };

function text(c: Candidate): string {
  return [c.title, c.summary, c.location, (c.languages || []).join(", ")].filter(Boolean).join(" — ");
}

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const candidatesPath = path.join(dataDir, "candidates.json");
  const binPath = path.join(dataDir, "embeddings.bin");
  const indexPath = path.join(dataDir, "embeddings-index.json");

  if (!fs.existsSync(candidatesPath)) {
    console.error("data/candidates.json not found");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(candidatesPath, "utf-8"));
  const candidates: Candidate[] = data.candidates;

  if (fs.existsSync(indexPath) && fs.existsSync(binPath)) {
    const existing = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    if (existing.count === candidates.length) {
      console.log(`Embeddings already up to date (${existing.count}). Skipping.`);
      return;
    }
  }
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set — skipping embeddings (the app will narrow with keyword match instead).");
    return;
  }
  const model = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log(`Embedding ${candidates.length} candidates with ${model} (dim=${EMBED_DIM})...`);

  const all = new Float32Array(candidates.length * EMBED_DIM);
  const ids: string[] = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const res = await openai.embeddings.create({
      model,
      input: batch.map(text),
      dimensions: EMBED_DIM,
    });
    batch.forEach((c, j) => {
      ids.push(c.id);
      const vec = res.data[j].embedding;
      const off = (i + j) * EMBED_DIM;
      for (let k = 0; k < EMBED_DIM; k++) all[off + k] = vec[k];
    });
    console.log(`   ${Math.min(i + BATCH, candidates.length)}/${candidates.length}`);
  }

  fs.writeFileSync(binPath, Buffer.from(all.buffer));
  fs.writeFileSync(
    indexPath,
    JSON.stringify({ ids, dim: EMBED_DIM, count: candidates.length, model, createdAt: new Date().toISOString() }),
  );
  console.log(`Done. ${candidates.length} embeddings -> data/embeddings.bin`);
}

main().catch((e) => {
  console.error("Embed failed:", e);
  process.exit(1);
});
