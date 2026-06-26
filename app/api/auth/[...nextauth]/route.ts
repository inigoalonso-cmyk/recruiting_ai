import { NextResponse } from "next/server";

// Authentication is disabled in this phase. These stubs keep the route valid
// without depending on next-auth. Re-add SSO here before using real candidate data.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Auth disabled" }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({ error: "Auth disabled" }, { status: 404 });
}
