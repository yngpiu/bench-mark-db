import { NextRequest, NextResponse } from "next/server";
import { timedQuery, timedQueryRollback } from "@/lib/db";
import { functionQueries, procedureQueries } from "@/lib/equivalent-queries";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, params, mode, iterations = 1 } = body as {
      type: "function" | "procedure";
      name: string;
      params: unknown[];
      mode: "db" | "backend";
      iterations?: number;
    };

    if (!name || !mode) {
      return NextResponse.json(
        { error: "name and mode are required" },
        { status: 400 }
      );
    }

    const runs = Math.min(Math.max(Math.round(iterations), 1), 100);

    let sql: string;

    if (mode === "db") {
      if (type === "function") {
        const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
        sql = `SELECT * FROM ${name}(${placeholders})`;
      } else {
        const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
        sql = `CALL ${name}(${placeholders})`;
      }
    } else {
      const queryMap = type === "function" ? functionQueries : procedureQueries;
      const eq = queryMap[name];
      if (!eq) {
        return NextResponse.json(
          { error: `No equivalent backend query defined for ${name}` },
          { status: 400 }
        );
      }
      sql = eq.sql;
    }

    // Procedures mutate data → use rollback so benchmarks don't persist changes
    const exec = type === "procedure" ? timedQueryRollback : timedQuery;

    const timings: number[] = [];
    let lastResult = await exec(sql, params);
    timings.push(lastResult.executionTimeMs);

    for (let i = 1; i < runs; i++) {
      const r = await exec(sql, params);
      timings.push(r.executionTimeMs);
      lastResult = r;
    }

    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);

    return NextResponse.json({
      rows: lastResult.result.rows,
      rowCount: lastResult.result.rowCount,
      fields: (lastResult.result.fields ?? []).map((f) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
      executionTimeMs: Math.round(avg * 100) / 100,
      timings: timings.map((t) => Math.round(t * 100) / 100),
      stats: {
        iterations: runs,
        avg: Math.round(avg * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
      },
      sql: sql.trim(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
