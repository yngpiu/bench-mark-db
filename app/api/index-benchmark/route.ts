import { NextRequest, NextResponse } from "next/server";
import { timedQuery } from "@/lib/db";
import pool from "@/lib/db";

// Known indexes from bank.sql
export const AVAILABLE_INDEXES: Record<string, { table: string; column: string; ddl: string }> = {
  idx_account_district: {
    table: "fin_account",
    column: "district_id",
    ddl: "CREATE INDEX IF NOT EXISTS idx_account_district ON public.fin_account(district_id)",
  },
  idx_loan_account_id: {
    table: "fin_loan",
    column: "account_id",
    ddl: "CREATE INDEX IF NOT EXISTS idx_loan_account_id ON public.fin_loan(account_id)",
  },
  idx_order_account_id: {
    table: "fin_order",
    column: "account_id",
    ddl: "CREATE INDEX IF NOT EXISTS idx_order_account_id ON public.fin_order(account_id)",
  },
  idx_trans_account_id: {
    table: "fin_trans",
    column: "account_id",
    ddl: "CREATE INDEX IF NOT EXISTS idx_trans_account_id ON public.fin_trans(account_id)",
  },
};

// Representative query for each index
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

export async function GET() {
  return NextResponse.json({ indexes: Object.keys(AVAILABLE_INDEXES) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { indexName, iterations = 5 } = body as {
    indexName: string;
    iterations?: number;
  };

  const indexInfo = AVAILABLE_INDEXES[indexName];
  if (!indexInfo) {
    return NextResponse.json({ error: `Unknown index: ${indexName}` }, { status: 400 });
  }

  const queryDef = INDEX_QUERIES[indexName];
  const runs = Math.min(Math.max(Math.round(iterations), 1), 50);
  const client = await pool.connect();

  try {
    // Run WITH index first
    const withTimings: number[] = [];
    for (let i = 0; i < runs; i++) {
      const r = await timedQuery(queryDef.sql, queryDef.params);
      withTimings.push(r.executionTimeMs);
    }

    // Temporarily drop the index
    await client.query(`DROP INDEX IF EXISTS ${indexName}`);

    // Run WITHOUT index
    const withoutTimings: number[] = [];
    for (let i = 0; i < runs; i++) {
      const r = await timedQuery(queryDef.sql, queryDef.params);
      withoutTimings.push(r.executionTimeMs);
    }

    // Restore the index
    await client.query(indexInfo.ddl);

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const round = (n: number) => Math.round(n * 100) / 100;

    return NextResponse.json({
      indexName,
      table: indexInfo.table,
      column: indexInfo.column,
      query: queryDef.sql,
      iterations: runs,
      withIndex: {
        timings: withTimings.map(round),
        avg: round(avg(withTimings)),
        min: round(Math.min(...withTimings)),
        max: round(Math.max(...withTimings)),
      },
      withoutIndex: {
        timings: withoutTimings.map(round),
        avg: round(avg(withoutTimings)),
        min: round(Math.min(...withoutTimings)),
        max: round(Math.max(...withoutTimings)),
      },
    });
  } catch (err: unknown) {
    // Always restore index on error
    await client.query(indexInfo.ddl).catch(() => {});
    const message = err instanceof Error ? err.message : "Benchmark failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
