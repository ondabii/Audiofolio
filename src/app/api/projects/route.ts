import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  try {
    const DB = (process.env as any).DB;
    if (!DB) {
      return NextResponse.json({ error: "Database binding not found" }, { status: 500 });
    }

    const { results } = await DB.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
