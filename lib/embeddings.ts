import fs from "fs";
import path from "path";
import OpenAI from "openai";

export const EMBED_DIM = 256;

type EmbeddingIndex = { ids: string[]; dim: number; count: number; model: string; createdAt: string };

let _vectors: Float32Array | null = null;
let _index: EmbeddingIndex | null = null;

const binPath = () => path.join(process.cwd(), "data", "embeddings.bin");
const indexPath = () => path.join(process.cwd(), "data", "embeddings-index.json");

export function embeddingsExist(): boolean {
  return fs.existsSync(binPath()) && fs.existsSync(indexPath());
}

export function loadIndex(): EmbeddingIndex {
  if (_index) return _index;
  _index = JSON.parse(fs.readFileSync(indexPath(), "utf-8")) as EmbeddingIndex;
  return _index;
}

export function loadVectors(): Float32Array {
  if (_vectors) return _vectors;
  const buf = fs.readFileSync(binPath());
  _vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return _vectors;
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
  const res = await openai.embeddings.create({ model, input: text, dimensions: EMBED_DIM });
  return new Float32Array(res.data[0].embedding);
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

/** Rank a subset of candidate ids by cosine similarity to the query vector. */
export function rankByEmbedding(
  queryVec: Float32Array,
  candidateIds: string[],
  index: EmbeddingIndex,
  vectors: Float32Array,
  limit: number,
): string[] {
  const pos = new Map<string, number>();
  index.ids.forEach((id, i) => pos.set(id, i));
  const scored: { id: string; score: number }[] = [];
  for (const id of candidateIds) {
    const gi = pos.get(id);
    if (gi === undefined) continue;
    const vec = vectors.subarray(gi * index.dim, gi * index.dim + index.dim);
    scored.push({ id, score: cosine(queryVec, vec) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.id);
}
