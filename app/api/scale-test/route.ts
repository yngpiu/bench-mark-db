import { NextRequest, NextResponse } from "next/server";
import { timedQuery } from "@/lib/db";
import { functionQueries } from "@/lib/equivalent-queries";

export interface ScalePreset {
  label: string;
  params: unknown[];
}

// Functions that support scaling and their preset series
export const SCALE_CONFIGS: Record<string, {
  description: string;
  paramName: string;
  dbSql: (params: unknown[]) => string;
  backendSql: string;
  presets: ScalePreset[];
}> = {
  fn_loan_stats_by_region: {
    description: "Số vùng miền trả về (p_top_n)",
    paramName: "p_top_n",
    dbSql: (params) => `SELECT * FROM fn_loan_stats_by_region(${params[0]})`,
    backendSql: functionQueries.fn_loan_stats_by_region.sql,
    presets: [
      { label: "5 vùng", params: [5] },
      { label: "10 vùng", params: [10] },
      { label: "20 vùng", params: [20] },
      { label: "Tất cả", params: [9999] },
    ],
  },
  fn_cashflow_report: {
    description: "Kỳ báo cáo (tháng / quý / năm)",
    paramName: "p_period",
    dbSql: (params) => `SELECT * FROM fn_cashflow_report('${params[0]}')`,
    backendSql: functionQueries.fn_cashflow_report.sql,
    presets: [
      { label: "Theo năm", params: ["year"] },
      { label: "Theo quý", params: ["quarter"] },
      { label: "Theo tháng", params: ["month"] },
    ],
  },
  fn_account_summary: {
    description: "Khoảng ngày (1 năm / 3 năm / 5 năm / toàn bộ)",
    paramName: "p_date_from / p_date_to",
    dbSql: (params) => `SELECT * FROM fn_account_summary($1, $2, $3)`,
    backendSql: functionQueries.fn_account_summary.sql,
    presets: [
      { label: "1 năm (2025)", params: [8261, "2025-01-01", "2025-12-31"] },
      { label: "3 năm (2023–2025)", params: [8261, "2023-01-01", "2025-12-31"] },
      { label: "5 năm (2021–2025)", params: [8261, "2021-01-01", "2025-12-31"] },
      { label: "Toàn bộ", params: [8261, "2000-01-01", "2030-12-31"] },
    ],
  },
};

export async function GET() {
  return NextResponse.json({
    functions: Object.entries(SCALE_CONFIGS).map(([name, cfg]) => ({
      name,
      description: cfg.description,
      paramName: cfg.paramName,
      presets: cfg.presets.map((p) => p.label),
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { functionName, iterations = 3 } = body as {
    functionName: string;
    iterations?: number;
  };

  const config = SCALE_CONFIGS[functionName];
  if (!config) {
    return NextResponse.json({ error: `No scale config for ${functionName}` }, { status: 400 });
  }

  const runs = Math.min(Math.max(Math.round(iterations), 1), 20);
  const round = (n: number) => Math.round(n * 100) / 100;
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const results = [];

  for (const preset of config.presets) {
    const dbSql = config.dbSql(preset.params);
    const backendSql = config.backendSql;

    const dbTimings: number[] = [];
    const backendTimings: number[] = [];

    for (let i = 0; i < runs; i++) {
      // DB
      const dr = await timedQuery(dbSql, dbSql.includes("$1") ? preset.params : []);
      dbTimings.push(dr.executionTimeMs);
      // Backend
      const br = await timedQuery(backendSql, preset.params);
      backendTimings.push(br.executionTimeMs);
    }

    results.push({
      label: preset.label,
      params: preset.params,
      db: { avg: round(avg(dbTimings)), min: round(Math.min(...dbTimings)), max: round(Math.max(...dbTimings)) },
      backend: { avg: round(avg(backendTimings)), min: round(Math.min(...backendTimings)), max: round(Math.max(...backendTimings)) },
    });
  }

  return NextResponse.json({
    functionName,
    description: config.description,
    iterations: runs,
    results,
  });
}
