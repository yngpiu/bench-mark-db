"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table";
import { SparkLine } from "@/components/spark-line";
import { getParamLabel } from "@/lib/vi-labels";
import { FUNCTION_INDEXES } from "@/lib/function-indexes";
import type { FunctionParam } from "@/lib/sql-parser";

interface TimingStats {
  iterations: number;
  avg: number;
  min: number;
  max: number;
}

interface IndexComparisonData {
  withIndex: { timings: number[]; avg: number; min: number; max: number };
  withoutIndex: { timings: number[]; avg: number; min: number; max: number };
  indexes: string[];
}

interface ExecutionResult {
  rows: Record<string, unknown>[];
  fields: { name: string }[];
  rowCount: number | null;
  executionTimeMs: number;
  timings: number[];
  stats: TimingStats;
  sql: string;
  indexComparison?: IndexComparisonData;
}

interface IndexTimingData {
  timings: number[];
  avg: number;
  min: number;
  max: number;
}

interface ConcurrentResult {
  mode: "db" | "backend";
  concurrency: number;
  totalMs: number;
  throughput: number; // req/s
  timings: number[];
  p50: number;
  p95: number;
  p99: number;
  errors: number;
}

interface BenchmarkPanelProps {
  type: "function" | "procedure";
  name: string;
  params: FunctionParam[];
  defaults: Record<string, string>;
  returnDesc?: string;
  tab1Label: string;
  tab2Label: string;
}

export function BenchmarkPanel({
  type,
  name,
  params,
  defaults,
  returnDesc,
  tab1Label,
  tab2Label,
}: BenchmarkPanelProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of params) {
      if (defaults[p.name]) {
        initial[p.name] = defaults[p.name];
      } else if (p.defaultValue && !p.defaultValue.startsWith("NULL")) {
        initial[p.name] = p.defaultValue;
      } else {
        initial[p.name] = "";
      }
    }
    return initial;
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [iterations, setIterations] = useState(5);
  const [concurrency, setConcurrency] = useState(10);

  const [dbResult, setDbResult] = useState<ExecutionResult | null>(null);
  const [backendResult, setBackendResult] = useState<ExecutionResult | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const [bothLoading, setBothLoading] = useState(false);

  // Explain plan state
  const [explainDb, setExplainDb] = useState<unknown[] | null>(null);
  const [explainBackend, setExplainBackend] = useState<unknown[] | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // Concurrent load state
  const [concurrentResults, setConcurrentResults] = useState<ConcurrentResult[]>([]);
  const [concurrentLoading, setConcurrentLoading] = useState(false);

  const pendingActionRef = useRef<"db" | "backend" | "both" | "concurrent" | null>(null);
  const hasParams = params.length > 0;

  const transIdParams = params.filter((p) => p.name.includes("trans_id"));

  useEffect(() => {
    if (!dialogOpen || transIdParams.length === 0) return;
    fetch("/api/next-id")
      .then((r) => r.json())
      .then((data) => {
        if (!data.nextId) return;
        setValues((prev) => {
          const next = { ...prev };
          let offset = 0;
          for (const p of transIdParams) {
            next[p.name] = String(data.nextId + offset);
            offset++;
          }
          return next;
        });
      })
      .catch(() => {});
  }, [dialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildParams = useCallback(() => {
    return params.map((p) => {
      const v = values[p.name];
      if (v === "" || v === undefined) return null;
      return v;
    });
  }, [params, values]);

  const executeMode = useCallback(
    async (mode: "db" | "backend") => {
      const setResult = mode === "db" ? setDbResult : setBackendResult;
      const setError = mode === "db" ? setDbError : setBackendError;
      const setLoading = mode === "db" ? setDbLoading : setBackendLoading;

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const relatedIndexes = FUNCTION_INDEXES[name] ?? [];
        const res = await fetch("/api/execute-full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, name, params: buildParams(), mode, iterations, relatedIndexes }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Thực thi thất bại");
          return;
        }
        const result = mode === "db" ? data.db : data.backend;
        if (result) setResult(result);
        else setError("Không có kết quả");
      } catch {
        setError("Lỗi kết nối mạng");
      } finally {
        setLoading(false);
      }
    },
    [type, name, buildParams, iterations]
  );

  const executeBoth = useCallback(async () => {
    setBothLoading(true);
    setDbError(null);
    setBackendError(null);
    setDbResult(null);
    setBackendResult(null);
    try {
      const relatedIndexes = FUNCTION_INDEXES[name] ?? [];
      const res = await fetch("/api/execute-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, params: buildParams(), iterations, relatedIndexes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDbError(data.error || "Thực thi thất bại");
        setBackendError(data.error || "Thực thi thất bại");
        return;
      }
      if (data.db) setDbResult(data.db);
      if (data.backend) setBackendResult(data.backend);
    } catch {
      setDbError("Lỗi kết nối mạng");
      setBackendError("Lỗi kết nối mạng");
    } finally {
      setBothLoading(false);
    }
  }, [type, name, buildParams, iterations]);

  const tryExecute = useCallback(
    (action: "db" | "backend" | "both") => {
      if (hasParams) {
        pendingActionRef.current = action;
        setDialogOpen(true);
        return;
      }
      if (action === "both") executeBoth();
      else executeMode(action);
    },
    [hasParams, executeBoth, executeMode]
  );

  // Fetch EXPLAIN plans for both modes
  const fetchExplain = useCallback(async () => {
    setExplainLoading(true);
    setExplainDb(null);
    setExplainBackend(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, name, params: buildParams(), mode: "db" }),
        }),
        fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, name, params: buildParams(), mode: "backend" }),
        }),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      if (d1.plan) setExplainDb(d1.plan);
      if (d2.plan) setExplainBackend(d2.plan);
    } catch {
      // ignore
    } finally {
      setExplainLoading(false);
    }
  }, [type, name, buildParams]);

  // Concurrent load test — fire N requests simultaneously from the client
  const runConcurrent = useCallback(async () => {
    setConcurrentLoading(true);
    setConcurrentResults([]);
    const builtParams = buildParams();

    const runMode = async (mode: "db" | "backend"): Promise<ConcurrentResult> => {
      const start = performance.now();
      let errors = 0;
      const timings: number[] = [];

      const requests = Array.from({ length: concurrency }, async () => {
        const t0 = performance.now();
        try {
          const res = await fetch("/api/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, name, params: builtParams, mode, iterations: 1 }),
          });
          if (!res.ok) errors++;
          else timings.push(performance.now() - t0);
        } catch {
          errors++;
        }
      });

      await Promise.all(requests);
      const totalMs = performance.now() - start;
      const sorted = [...timings].sort((a, b) => a - b);
      const p = (pct: number) => sorted[Math.min(Math.floor((sorted.length * pct) / 100), sorted.length - 1)] ?? 0;

      return {
        mode,
        concurrency,
        totalMs: Math.round(totalMs * 100) / 100,
        throughput: Math.round((timings.length / (totalMs / 1000)) * 10) / 10,
        timings: timings.map((t) => Math.round(t * 100) / 100),
        p50: Math.round(p(50) * 100) / 100,
        p95: Math.round(p(95) * 100) / 100,
        p99: Math.round(p(99) * 100) / 100,
        errors,
      };
    };

    const [r1, r2] = await Promise.all([runMode("db"), runMode("backend")]);
    setConcurrentResults([r1, r2]);
    setConcurrentLoading(false);
  }, [type, name, buildParams, concurrency]);

  const handleDialogConfirm = useCallback(() => {
    setDialogOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action === "concurrent") runConcurrent();
    else if (action === "both") executeBoth();
    else if (action) executeMode(action);
  }, [executeBoth, executeMode, runConcurrent]);

  const timeDiff =
    dbResult && backendResult ? backendResult.stats.avg - dbResult.stats.avg : null;

  const filledCount = params.filter((p) => {
    const v = values[p.name];
    return v !== "" && v !== undefined;
  }).length;

  const requiredParams = params.filter((p) => !p.defaultValue);
  const allRequiredFilled = requiredParams.every((p) => {
    const v = values[p.name];
    return v !== "" && v !== undefined;
  });

  return (
    <div className="space-y-6">
      {/* Param modal */}
      {hasParams && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nhập tham số</DialogTitle>
              <DialogDescription>
                Điền giá trị cho các tham số của{" "}
                {type === "function" ? "hàm" : "thủ tục"}{" "}
                <code className="font-semibold">{name}</code>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2 px-1 max-h-[60vh] overflow-y-auto">
              {params.map((p) => {
                const viLabel = getParamLabel(p.name);
                const isRequired = !p.defaultValue;
                const isEmpty = values[p.name] === "" || values[p.name] === undefined;
                return (
                  <div key={p.name} className="grid gap-1.5">
                    <Label
                      htmlFor={`param-${p.name}`}
                      className="text-sm flex items-center gap-1.5"
                    >
                      <span className="font-semibold">{viLabel}</span>
                      {isRequired && <span className="text-destructive">*</span>}
                      <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 font-normal opacity-90">
                        {p.type}
                      </Badge>
                      {p.mode && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal opacity-75">
                          {p.mode}
                        </Badge>
                      )}
                    </Label>
                    <Input
                      id={`param-${p.name}`}
                      value={values[p.name] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                      placeholder={
                        defaults[p.name]
                          ? `Gợi ý: ${defaults[p.name]}`
                          : p.defaultValue
                            ? `Mặc định: ${p.defaultValue}`
                            : `Nhập ${viLabel.toLowerCase()}...`
                      }
                      className={isRequired && isEmpty ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setValues(Object.fromEntries(params.map((p) => [p.name, ""])))}
              >
                Xóa tất cả
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const reset: Record<string, string> = {};
                  for (const p of params) reset[p.name] = defaults[p.name] ?? "";
                  setValues(reset);
                }}
              >
                Mặc định
              </Button>
              <Button onClick={handleDialogConfirm} disabled={!allRequiredFilled}>
                Xác nhận & Chạy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="iter-count" className="text-sm whitespace-nowrap">Số lần chạy:</Label>
          <Input
            id="iter-count"
            type="number"
            min={1}
            max={100}
            value={iterations}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n >= 1 && n <= 100) setIterations(n);
            }}
            className="w-[70px] font-mono text-sm h-9"
          />
        </div>

        <Button onClick={() => tryExecute("both")} disabled={bothLoading} size="lg">
          {bothLoading
            ? (FUNCTION_INDEXES[name] ?? []).length > 0
              ? `Đang benchmark (không index → có index, ×${iterations})...`
              : `Đang chạy (${iterations} lần)...`
            : `Chạy cả hai ×${iterations}`}
        </Button>
        <Button onClick={() => tryExecute("db")} disabled={dbLoading} variant="outline" size="sm">
          {dbLoading ? "..." : tab1Label}
        </Button>
        <Button onClick={() => tryExecute("backend")} disabled={backendLoading} variant="outline" size="sm">
          {backendLoading ? "..." : tab2Label}
        </Button>
      </div>

      {/* Filled params summary */}
      {hasParams && filledCount > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {params.map((p) => {
            const v = values[p.name];
            if (!v) return null;
            return (
              <Badge key={p.name} variant="secondary" className="gap-1 font-normal">
                {getParamLabel(p.name)}: <span className="font-mono">{v}</span>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Timing comparison */}
      {dbResult && backendResult && (
        <div className="rounded-xl p-5 bg-muted/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              So sánh hiệu năng
              {dbResult.stats.iterations > 1 && (
                <span className="font-normal text-muted-foreground ml-1.5">
                  (trung bình {dbResult.stats.iterations} lần)
                </span>
              )}
            </h3>
            {timeDiff !== null && (
              <Badge variant={timeDiff > 0 ? "default" : "secondary"}>
                {tab1Label} {timeDiff > 0 ? "nhanh hơn" : "chậm hơn"} {Math.abs(timeDiff).toFixed(2)} ms
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TimingBar
              label={tab1Label}
              stats={dbResult.stats}
              maxMs={Math.max(dbResult.stats.avg, backendResult.stats.avg)}
              isFaster={dbResult.stats.avg < backendResult.stats.avg}
            />
            <TimingBar
              label={tab2Label}
              stats={backendResult.stats}
              maxMs={Math.max(dbResult.stats.avg, backendResult.stats.avg)}
              isFaster={backendResult.stats.avg < dbResult.stats.avg}
            />
          </div>
        </div>
      )}

      {/* Main result tabs */}
      <Tabs defaultValue="db" className="space-y-4">
        <TabsList>
          <TabsTrigger value="db" className="gap-2">
            {tab1Label}
            {dbResult && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                TB {dbResult.stats.avg.toFixed(2)} ms
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="backend" className="gap-2">
            {tab2Label}
            {backendResult && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                TB {backendResult.stats.avg.toFixed(2)} ms
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="db">
          <ResultPanel result={dbResult} error={dbError} loading={dbLoading} returnDesc={returnDesc} />
        </TabsContent>
        <TabsContent value="backend">
          <ResultPanel result={backendResult} error={backendError} loading={backendLoading} />
        </TabsContent>
      </Tabs>

      {/* EXPLAIN ANALYZE section */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Kế hoạch thực thi (EXPLAIN ANALYZE)</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchExplain}
            disabled={explainLoading}
          >
            {explainLoading ? "Đang phân tích..." : "Phân tích kế hoạch SQL"}
          </Button>
        </div>
        {(explainDb || explainBackend) && (
          <div className="grid grid-cols-2 gap-4">
            <ExplainPanel label={tab1Label} plan={explainDb} />
            <ExplainPanel label={tab2Label} plan={explainBackend} />
          </div>
        )}
      </section>

      {/* Concurrent load test section */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold">Kiểm tra tải đồng thời (Concurrent)</h3>
          <div className="flex items-center gap-1.5">
            <Label className="text-sm whitespace-nowrap">Số request song song:</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={concurrency}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n) && n >= 1 && n <= 100) setConcurrency(n);
              }}
              className="w-[70px] font-mono text-sm h-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={hasParams ? () => { pendingActionRef.current = "concurrent"; setDialogOpen(true); } : runConcurrent}
            disabled={concurrentLoading}
          >
            {concurrentLoading ? `Đang gửi ${concurrency} request...` : `Gửi ${concurrency} request đồng thời`}
          </Button>
        </div>
        {concurrentResults.length === 2 && (
          <ConcurrentPanel results={concurrentResults} tab1Label={tab1Label} tab2Label={tab2Label} />
        )}
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TimingBar({ label, stats, maxMs, isFaster }: {
  label: string; stats: TimingStats; maxMs: number; isFaster: boolean;
}) {
  const pct = maxMs > 0 ? (stats.avg / maxMs) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{stats.avg.toFixed(2)} ms</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFaster ? "bg-green-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {stats.iterations > 1 && (
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
          <span>Min: {stats.min.toFixed(2)} ms</span>
          <span>Max: {stats.max.toFixed(2)} ms</span>
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result, error, loading, returnDesc }: {
  result: ExecutionResult | null; error: string | null; loading: boolean; returnDesc?: string;
}) {
  if (loading) {
    return <div className="text-center py-8 text-muted-foreground animate-pulse">Đang thực thi...</div>;
  }
  if (error) {
    return <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  }
  if (!result) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nhấn nút &quot;Chạy cả hai&quot; để bắt đầu đo hiệu năng
      </div>
    );
  }

  const isProcedure = result.fields.length === 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {result.stats.iterations > 1 && (
          <Badge variant="secondary" className="font-mono font-normal">{result.stats.iterations} lần chạy</Badge>
        )}
        <Badge variant="secondary" className="font-mono">TB: {result.stats.avg.toFixed(2)} ms</Badge>
        {result.stats.iterations > 1 && (
          <>
            <Badge variant="secondary" className="font-mono">Min: {result.stats.min.toFixed(2)} ms</Badge>
            <Badge variant="secondary" className="font-mono">Max: {result.stats.max.toFixed(2)} ms</Badge>
          </>
        )}
        <Badge variant="secondary">{result.rowCount ?? 0} dòng</Badge>
        {returnDesc && <span className="text-muted-foreground">Kết quả: {returnDesc}</span>}
      </div>

      {/* Cold vs Warm sparkline — only if more than 1 run */}
      {result.timings.length > 1 && (
        <div className="rounded-lg border p-3 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Biểu đồ thời gian từng lần chạy — lần đầu thường chậm hơn (cold cache)
          </div>
          <SparkLine
            data={result.timings}
            color={result.fields.length === 0 ? "rgb(168,85,247)" : "rgb(59,130,246)"}
            height={56}
          />
        </div>
      )}

      {/* Index comparison — shown when executeBoth ran the full index cycle */}
      {result.indexComparison && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="text-xs font-medium">
            Ảnh hưởng Index:{" "}
            <span className="text-muted-foreground font-normal">
              {result.indexComparison.indexes.join(", ")}
            </span>
          </div>
          <IndexTimingCompare
            withData={result.indexComparison.withIndex}
            withoutData={result.indexComparison.withoutIndex}
          />
        </div>
      )}

      {/* SQL */}
      <details>
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          Xem câu lệnh SQL
        </summary>
        <pre className="mt-2 p-4 rounded-lg bg-muted/50 text-xs font-mono whitespace-pre-wrap">{result.sql}</pre>
      </details>

      {/* Data */}
      {isProcedure ? (
        <div className="rounded-lg bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-400">
          Thủ tục thực thi thành công. {result.rowCount ?? 0} dòng bị ảnh hưởng.
        </div>
      ) : (
        <DataTable fields={result.fields} rows={result.rows} />
      )}
    </div>
  );
}

type PlanNode = {
  "Node Type": string;
  "Actual Total Time"?: number;
  "Actual Rows"?: number;
  "Plan Rows"?: number;
  "Total Cost"?: number;
  "Index Name"?: string;
  "Relation Name"?: string;
  Plans?: PlanNode[];
  [key: string]: unknown;
};

function ExplainNode({ node, depth = 0 }: { node: PlanNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.Plans && node.Plans.length > 0;
  const actualTime = node["Actual Total Time"];
  const actualRows = node["Actual Rows"];
  const planRows = node["Plan Rows"];
  const cost = node["Total Cost"];
  const relation = node["Relation Name"] ?? node["Index Name"];

  return (
    <div className={`${depth > 0 ? "ml-4 border-l pl-3 border-border/40" : ""}`}>
      <div
        className={`flex items-start gap-2 py-1 text-xs ${hasChildren ? "cursor-pointer hover:text-foreground" : ""}`}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        {hasChildren && (
          <span className="text-muted-foreground shrink-0 mt-0.5">{open ? "▼" : "▶"}</span>
        )}
        {!hasChildren && <span className="w-3 shrink-0" />}
        <span>
          <span className="font-semibold">{node["Node Type"]}</span>
          {relation && <span className="text-muted-foreground ml-1">on {relation}</span>}
        </span>
        <div className="ml-auto flex gap-3 font-mono text-muted-foreground shrink-0">
          {actualTime !== undefined && (
            <span className={actualTime > 10 ? "text-amber-500" : "text-green-600"}>
              {actualTime.toFixed(2)} ms
            </span>
          )}
          {actualRows !== undefined && planRows !== undefined && (
            <span title="thực tế / ước tính">
              {actualRows} / {planRows} dòng
            </span>
          )}
          {cost !== undefined && <span>cost={cost.toFixed(1)}</span>}
        </div>
      </div>
      {open && hasChildren && node.Plans?.map((child, i) => (
        <ExplainNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function ExplainPanel({ label, plan }: { label: string; plan: unknown[] | null }) {
  if (!plan) return (
    <div className="rounded-xl border p-4 text-xs text-muted-foreground">Chưa có kế hoạch cho {label}</div>
  );

  const root = (plan[0] as { Plan: PlanNode })?.Plan;
  if (!root) return null;

  return (
    <div className="rounded-xl border p-4 space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground">Thời gian thực / ước tính · dòng thực / ước tính · cost</div>
      <ExplainNode node={root} />
    </div>
  );
}


function IndexTimingCompare({
  withData,
  withoutData,
}: {
  withData: IndexTimingData;
  withoutData: IndexTimingData;
}) {
  const maxMs = Math.max(withData.avg, withoutData.avg);
  const indexFaster = withData.avg < withoutData.avg;
  const speedup =
    withoutData.avg > 0 ? ((withoutData.avg - withData.avg) / withoutData.avg) * 100 : 0;

  // Thanh nào dài hơn (chậm hơn) → xanh; thanh nào ngắn hơn (nhanh hơn) → đỏ
  const withIsSlow = withData.avg < withoutData.avg;
  const entries = [
    {
      label: "Có index",
      data: withData,
      barColor: withIsSlow ? "bg-green-500" : "bg-red-400",
      textColor: withIsSlow ? "text-green-600" : "text-red-500",
      sparkColor: withIsSlow ? "rgb(34,197,94)" : "rgb(239,68,68)",
    },
    {
      label: "Không có index",
      data: withoutData,
      barColor: withIsSlow ? "bg-red-400" : "bg-green-500",
      textColor: withIsSlow ? "text-red-500" : "text-green-600",
      sparkColor: withIsSlow ? "rgb(239,68,68)" : "rgb(34,197,94)",
    },
  ];

  return (
    <div className="space-y-2">
      {/* Bars */}
      {entries.map(({ label, data, barColor, textColor }) => (
        <div key={label}>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>{label}</span>
            <span className={`font-mono font-semibold ${textColor}`}>{data.avg.toFixed(2)} ms</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${maxMs > 0 ? (data.avg / maxMs) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}

      {/* Sparklines */}
      {withData.timings.length > 1 && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <SparkLine data={withData.timings} color={entries[0].sparkColor} height={36} showDots={false} />
          <SparkLine data={withoutData.timings} color={entries[1].sparkColor} height={36} showDots={false} />
        </div>
      )}

      {/* Verdict */}
      <Badge
        variant={indexFaster ? "default" : "secondary"}
        className="text-[10px] font-normal"
      >
        {indexFaster
          ? `Index nhanh hơn ${speedup.toFixed(1)}%`
          : `Index không có tác dụng rõ rệt (${Math.abs(speedup).toFixed(1)}%)`}
      </Badge>
    </div>
  );
}

function ConcurrentPanel({ results, tab1Label, tab2Label }: {
  results: ConcurrentResult[]; tab1Label: string; tab2Label: string;
}) {
  const labels = [tab1Label, tab2Label];
  const colors = ["rgb(59,130,246)", "rgb(245,158,11)"];
  const maxThroughput = Math.max(...results.map((r) => r.throughput));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {results.map((r, i) => (
          <div key={r.mode} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{labels[i]}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {r.throughput} req/s
              </Badge>
            </div>
            {/* Throughput bar */}
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Throughput</div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${maxThroughput > 0 ? (r.throughput / maxThroughput) * 100 : 0}%`, backgroundColor: colors[i] }}
                />
              </div>
            </div>
            {/* Latency percentiles */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["P50", r.p50], ["P95", r.p95], ["P99", r.p99]].map(([label, val]) => (
                <div key={String(label)} className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="font-mono text-sm font-semibold">{Number(val).toFixed(1)}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">ms</span></div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Tổng thời gian: {r.totalMs.toFixed(0)} ms · {r.timings.length} thành công · {r.errors} lỗi
            </div>
            {r.timings.length > 1 && (
              <SparkLine data={r.timings} color={colors[i]} height={48} showDots={false} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
