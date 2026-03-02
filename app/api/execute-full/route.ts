import { NextRequest, NextResponse } from "next/server";
import { timedQuery, timedQueryRollback } from "@/lib/db";
import pool from "@/lib/db";
import { functionQueries, procedureQueries } from "@/lib/equivalent-queries";
import { AVAILABLE_INDEXES } from "@/lib/function-indexes";

function buildDbSql(type: string, name: string, params: unknown[]): string {
  const ph = params.map((_, i) => `$${i + 1}`).join(", ");
  return type === "function" ? `SELECT * FROM ${name}(${ph})` : `CALL ${name}(${ph})`;
}

const round = (n: number) => Math.round(n * 100) / 100;

function mkStats(timings: number[]) {
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  return {
    iterations: timings.length,
    avg: round(avg),
    min: round(Math.min(...timings)),
    max: round(Math.max(...timings)),
  };
}

function mkIndexData(timings: number[]) {
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  return {
    timings: timings.map(round),
    avg: round(avg),
    min: round(Math.min(...timings)),
    max: round(Math.max(...timings)),
  };
}

function buildResult(
  lastResult: { result: { rows: unknown[]; fields: { name: string; dataTypeID: number }[]; rowCount: number | null } },
  sql: string,
  withTimings: number[],
  withoutTimings: number[] | null,
  indexes: string[]
) {
  return {
    rows: lastResult.result.rows,
    rowCount: lastResult.result.rowCount,
    fields: (lastResult.result.fields ?? []).map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    executionTimeMs: round(withTimings.reduce((a, b) => a + b, 0) / withTimings.length),
    timings: withTimings.map(round),
    stats: mkStats(withTimings),
    sql: sql.trim(),
    ...(withoutTimings && indexes.length > 0
      ? {
          indexComparison: {
            withIndex: mkIndexData(withTimings),
            withoutIndex: mkIndexData(withoutTimings),
            indexes,
          },
        }
      : {}),
  };
}

async function warmup(exec: typeof timedQuery, sql: string, params: unknown[]) {
  await exec(sql, params);
}

async function measure(exec: typeof timedQuery, sql: string, params: unknown[], runs: number) {
  const timings: number[] = [];
  let last;
  for (let i = 0; i < runs; i++) {
    const r = await exec(sql, params);
    timings.push(r.executionTimeMs);
    last = r;
  }
  return { timings, last: last! };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, params, iterations = 1, mode, relatedIndexes = [] } = body as {
      type: "function" | "procedure";
      name: string;
      params: unknown[];
      iterations?: number;
      mode?: "db" | "backend";
      relatedIndexes?: string[];
    };

    const runs = Math.min(Math.max(Math.round(iterations), 1), 100);
    const exec = type === "procedure" ? timedQueryRollback : timedQuery;

    const dbSql = buildDbSql(type, name, params);
    const queryMap = type === "function" ? functionQueries : procedureQueries;
    const backendSql = queryMap[name]?.sql ?? null;

    const runDb = !mode || mode === "db";
    const runBackend = (!mode || mode === "backend") && backendSql;

    const validIndexes = (relatedIndexes ?? []).filter((idx) => AVAILABLE_INDEXES[idx]);

    // ── WITH INDEX CYCLE ────────────────────────────────────────────────────────
    if (validIndexes.length > 0) {
      const client = await pool.connect();
      try {
        // Phase 1: DROP indexes → warmup → measure WITHOUT index
        for (const idx of validIndexes) {
          await client.query(`DROP INDEX IF EXISTS ${idx}`);
        }

        let dbWithout: { timings: number[]; last: Awaited<ReturnType<typeof exec>> } | null = null;
        let backendWithout: { timings: number[]; last: Awaited<ReturnType<typeof exec>> } | null = null;

        if (runDb) {
          await warmup(exec, dbSql, params);
          dbWithout = await measure(exec, dbSql, params, runs);
        }
        if (runBackend) {
          await warmup(exec, backendSql!, params);
          backendWithout = await measure(exec, backendSql!, params, runs);
        }

        // Phase 2: CREATE indexes → warmup → measure WITH index
        for (const idx of validIndexes) {
          await client.query(AVAILABLE_INDEXES[idx].ddl);
        }

        let dbWith: { timings: number[]; last: Awaited<ReturnType<typeof exec>> } | null = null;
        let backendWith: { timings: number[]; last: Awaited<ReturnType<typeof exec>> } | null = null;

        if (runDb) {
          await warmup(exec, dbSql, params);
          dbWith = await measure(exec, dbSql, params, runs);
        }
        if (runBackend) {
          await warmup(exec, backendSql!, params);
          backendWith = await measure(exec, backendSql!, params, runs);
        }

        const dbResult = dbWith
          ? buildResult(dbWith.last, dbSql, dbWith.timings, dbWithout?.timings ?? null, validIndexes)
          : null;
        const backendResult = backendWith
          ? buildResult(backendWith.last, backendSql!, backendWith.timings, backendWithout?.timings ?? null, validIndexes)
          : null;

        return NextResponse.json({ db: dbResult, backend: backendResult });
      } catch (err) {
        for (const idx of validIndexes) {
          await client.query(AVAILABLE_INDEXES[idx].ddl).catch(() => {});
        }
        throw err;
      } finally {
        client.release();
      }
    }

    // ── NO INDEXES: warmup → measure ─────────────────────────────────────────
    let dbResult = null;
    let backendResult = null;

    if (runDb) {
      await warmup(exec, dbSql, params);
      const m = await measure(exec, dbSql, params, runs);
      dbResult = buildResult(m.last, dbSql, m.timings, null, []);
    }
    if (runBackend) {
      await warmup(exec, backendSql!, params);
      const m = await measure(exec, backendSql!, params, runs);
      backendResult = buildResult(m.last, backendSql!, m.timings, null, []);
    }

    return NextResponse.json({ db: dbResult, backend: backendResult });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
