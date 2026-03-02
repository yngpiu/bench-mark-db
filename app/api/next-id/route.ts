import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query(
      "SELECT COALESCE(MAX(trans_id), 0)::int + 1 AS next_id FROM fin_trans"
    );
    return NextResponse.json({ nextId: result.rows[0].next_id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
