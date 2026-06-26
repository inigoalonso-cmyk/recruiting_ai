import { NextResponse } from "next/server";
import { loadMockData } from "@/lib/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jobs for the dropdown, straight from the data file. */
export async function GET() {
  try {
    const data = await loadMockData();
    return NextResponse.json({ jobs: data.jobs });
  } catch (err) {
    console.error("jobs error:", err);
    return NextResponse.json({ jobs: [] });
  }
}
