import { Pool, type QueryResult } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface TimedResult {
  result: QueryResult;
  executionTimeMs: number;
}

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function timedQuery(text: string, params?: unknown[]): Promise<TimedResult> {
  const client = await pool.connect();
  try {
    const start = performance.now();
    const result = await client.query(text, params);
    const executionTimeMs = performance.now() - start;
    return { result, executionTimeMs };
  } finally {
    client.release();
  }
}

/**
 * Execute inside a transaction that always rolls back.
 * Used for benchmarking procedures that mutate data —
 * measures real execution time without persisting changes.
 */
export async function timedQueryRollback(text: string, params?: unknown[]): Promise<TimedResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const start = performance.now();
    const result = await client.query(text, params);
    const executionTimeMs = performance.now() - start;
    await client.query("ROLLBACK");
    return { result, executionTimeMs };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
