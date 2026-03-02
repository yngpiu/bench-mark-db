import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { functionQueries, procedureQueries } from "@/lib/equivalent-queries";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, params, mode } = body as {
      type: "function" | "procedure";
      name: string;
      params: unknown[];
      mode: "db" | "backend";
    };

    if (!name || !mode) {
      return NextResponse.json({ error: "name and mode are required" }, { status: 400 });
    }

    let sql: string;

    if (mode === "db") {
      const placeholders = (params ?? []).map((_, i) => `$${i + 1}`).join(", ");
      sql = type === "function"
        ? `SELECT * FROM ${name}(${placeholders})`
        : `CALL ${name}(${placeholders})`;
    } else {
      const queryMap = type === "function" ? functionQueries : procedureQueries;
      const eq = queryMap[name];
      if (!eq) {
        return NextResponse.json({ error: `No equivalent query defined for ${name}` }, { status: 400 });
      }
      sql = eq.sql;
    }

    // EXPLAIN ANALYZE inside a transaction that rolls back (safe for procedures/mutations)
    const client = await (await import("@/lib/db")).default.connect();
    let plan: unknown;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `EXPLAIN (ANALYZE, FORMAT JSON, BUFFERS, VERBOSE) ${sql}`,
        params ?? []
      );
      await client.query("ROLLBACK");
      plan = result.rows[0]["QUERY PLAN"];
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({ plan, sql: sql.trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Explain failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
