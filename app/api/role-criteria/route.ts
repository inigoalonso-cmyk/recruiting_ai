import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saved per-role criteria templates from data/role-criteria.json. */
export async function GET() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "role-criteria.json"), "utf-8");
    return NextResponse.json({ roles: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ roles: [] });
  }
}
