import { NextRequest, NextResponse } from "next/server";
import { timedQuery, timedQueryRollback } from "@/lib/db";
import pool from "@/lib/db";
import { AVAILABLE_INDEXES } from "@/lib/function-indexes";
import { functionQueries, procedureQueries } from "@/lib/equivalent-queries";

// Legacy generic queries used by the standalone /index-benchmark page
const INDEX_QUERIES: Record<string, { sql: string; params: unknown[] }> = {
  idx_account_district: {
    sql: "SELECT * FROM fin_account WHERE district_id = $1",
    params: [1],
  },
  idx_loan_account_id: {
    sql: "SELECT * FROM fin_loan WHERE account_id = $1",
    params: [8261],
  },
  idx_order_account_id: {
    sql: "SELECT * FROM fin_order WHERE account_id = $1",
    params: [8261],
  },
  idx_trans_account_id: {
    sql: "SELECT * FROM fin_trans WHERE account_id = $1 ORDER BY trans_date DESC LIMIT 50",
    params: [8261],
  },
};

const avg = (arr: number[]) =>
  arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const round = (n: number) => Math.round(n * 100) / 100;

function buildStats(timings: number[]) {
  return {
    timings: timings.map(round),
    avg: round(avg(timings)),
    min: round(Math.min(...timings)),
    max: round(Math.max(...timings)),
  };
}

export async function GET() {
  return NextResponse.json({ indexes: Object.keys(AVAILABLE_INDEXES) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    indexName,
    iterations = 5,
    // Integrated mode fields
    type,
    name,
    params,
  } = body as {
    indexName: string;
    iterations?: number;
    type?: "function" | "procedure";
    name?: string;
    params?: unknown[];
  };

  const indexInfo = AVAILABLE_INDEXES[indexName];
  if (!indexInfo) {
    return NextResponse.json({ error: `Unknown index: ${indexName}` }, { status: 400 });
  }

  const runs = Math.min(Math.max(Math.round(iterations), 1), 50);
  const client = await pool.connect();

  // ── INTEGRATED MODE: run actual function/procedure ──────────────────────────
  if (type && name && params !== undefined) {
    const isProc = type === "procedure";
    const exec = isProc ? timedQueryRollback : timedQuery;

    const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
    const dbSql = isProc
      ? `CALL ${name}(${placeholders})`
      : `SELECT * FROM ${name}(${placeholders})`;

    const queryMap = isProc ? procedureQueries : functionQueries;
    const backendSql = queryMap[name]?.sql ?? null;

    try {
      // ── Phase 1: DROP index → chạy KHÔNG có index trước (cold cache) ──────────
      await client.query(`DROP INDEX IF EXISTS ${indexName}`);

      // WITHOUT index — db (cold)
      const dbWithoutTimings: number[] = [];
      for (let i = 0; i < runs; i++) {
        const r = await exec(dbSql, params);
        dbWithoutTimings.push(r.executionTimeMs);
      }

      // WITHOUT index — backend (cold)
      const backendWithoutTimings: number[] = [];
      if (backendSql) {
        for (let i = 0; i < runs; i++) {
          const r = await exec(backendSql, params);
          backendWithoutTimings.push(r.executionTimeMs);
        }
      }

      // ── Phase 2: CREATE index → chạy CÓ index sau (warm cache) ───────────────
      await client.query(indexInfo.ddl);

      // WITH index — db (warm)
      const dbWithTimings: number[] = [];
      for (let i = 0; i < runs; i++) {
        const r = await exec(dbSql, params);
        dbWithTimings.push(r.executionTimeMs);
      }

      // WITH index — backend (warm)
      const backendWithTimings: number[] = [];
      if (backendSql) {
        for (let i = 0; i < runs; i++) {
          const r = await exec(backendSql, params);
          backendWithTimings.push(r.executionTimeMs);
        }
      }

      return NextResponse.json({
        indexName,
        label: indexInfo.label,
        table: indexInfo.table,
        column: indexInfo.column,
        iterations: runs,
        db: {
          withIndex: buildStats(dbWithTimings),
          withoutIndex: buildStats(dbWithoutTimings),
        },
        backend: backendSql
          ? {
              withIndex: buildStats(backendWithTimings),
              withoutIndex: buildStats(backendWithoutTimings),
            }
          : null,
      });
    } catch (err: unknown) {
      await client.query(indexInfo.ddl).catch(() => {});
      const message = err instanceof Error ? err.message : "Benchmark failed";
      return NextResponse.json({ error: message }, { status: 500 });
    } finally {
      client.release();
    }
  }

  // ── LEGACY MODE: generic representative query (for standalone page) ─────────
  const queryDef = INDEX_QUERIES[indexName];
  if (!queryDef) {
    client.release();
    return NextResponse.json({ error: `No query defined for index: ${indexName}` }, { status: 400 });
  }

  try {
    const withTimings: number[] = [];
    for (let i = 0; i < runs; i++) {
      const r = await timedQuery(queryDef.sql, queryDef.params);
      withTimings.push(r.executionTimeMs);
    }

    await client.query(`DROP INDEX IF EXISTS ${indexName}`);

    const withoutTimings: number[] = [];
    for (let i = 0; i < runs; i++) {
      const r = await timedQuery(queryDef.sql, queryDef.params);
      withoutTimings.push(r.executionTimeMs);
    }

    await client.query(indexInfo.ddl);

    return NextResponse.json({
      indexName,
      table: indexInfo.table,
      column: indexInfo.column,
      query: queryDef.sql,
      iterations: runs,
      withIndex: buildStats(withTimings),
      withoutIndex: buildStats(withoutTimings),
    });
  } catch (err: unknown) {
    await client.query(indexInfo.ddl).catch(() => {});
    const message = err instanceof Error ? err.message : "Benchmark failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
