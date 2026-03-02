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
import { getParamLabel } from "@/lib/vi-labels";
import type { FunctionParam } from "@/lib/sql-parser";

interface TimingStats {
  iterations: number;
  avg: number;
  min: number;
  max: number;
}

interface ExecutionResult {
  rows: Record<string, unknown>[];
  fields: { name: string }[];
  rowCount: number | null;
  executionTimeMs: number;
  timings: number[];
  stats: TimingStats;
  sql: string;
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

  const [dbResult, setDbResult] = useState<ExecutionResult | null>(null);
  const [backendResult, setBackendResult] = useState<ExecutionResult | null>(
    null
  );
  const [dbError, setDbError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const [bothLoading, setBothLoading] = useState(false);

  const pendingActionRef = useRef<"db" | "backend" | "both" | null>(null);
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
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            name,
            params: buildParams(),
            mode,
            iterations,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Thực thi thất bại");
          return;
        }
        setResult(data);
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
    await Promise.all([executeMode("db"), executeMode("backend")]);
    setBothLoading(false);
  }, [executeMode]);

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

  const handleDialogConfirm = useCallback(() => {
    setDialogOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action === "both") executeBoth();
    else if (action) executeMode(action);
  }, [executeBoth, executeMode]);

  const timeDiff =
    dbResult && backendResult
      ? backendResult.stats.avg - dbResult.stats.avg
      : null;

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
      {/* Param modal — opens automatically when user clicks any run button */}
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
                  const isEmpty =
                    values[p.name] === "" || values[p.name] === undefined;
                  return (
                    <div key={p.name} className="grid gap-1.5">
                      <Label
                        htmlFor={`param-${p.name}`}
                        className="text-sm flex items-center gap-1.5"
                      >
                        <span className="font-semibold">{viLabel}</span>
                        {isRequired && (
                          <span className="text-destructive">*</span>
                        )}
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px] px-1.5 py-0 font-normal opacity-90"
                      >
                        {p.type}
                      </Badge>
                      {p.mode && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 font-normal opacity-75"
                        >
                          {p.mode}
                        </Badge>
                      )}
                    </Label>
                      <Input
                        id={`param-${p.name}`}
                        value={values[p.name] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [p.name]: e.target.value,
                          }))
                        }
                        placeholder={
                          defaults[p.name]
                            ? `Gợi ý: ${defaults[p.name]}`
                            : p.defaultValue
                              ? `Mặc định: ${p.defaultValue}`
                              : `Nhập ${viLabel.toLowerCase()}...`
                        }
                      />
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setValues(
                    Object.fromEntries(params.map((p) => [p.name, ""]))
                  );
                }}
              >
                Xóa tất cả
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const reset: Record<string, string> = {};
                  for (const p of params) {
                    reset[p.name] = defaults[p.name] ?? "";
                  }
                  setValues(reset);
                }}
              >
                Mặc định
              </Button>
              <Button
                onClick={handleDialogConfirm}
                disabled={!allRequiredFilled}
              >
                Xác nhận & Chạy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Iteration count selector */}
        <div className="flex items-center gap-1.5">
          <Label htmlFor="iter-count" className="text-sm whitespace-nowrap">
            Số lần chạy:
          </Label>
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

        <Button
          onClick={() => tryExecute("both")}
          disabled={bothLoading}
          size="lg"
        >
          {bothLoading
            ? `Đang chạy (${iterations} lần)...`
            : `Chạy cả hai ×${iterations}`}
        </Button>
        <Button
          onClick={() => tryExecute("db")}
          disabled={dbLoading}
          variant="outline"
          size="sm"
        >
          {dbLoading ? "..." : tab1Label}
        </Button>
        <Button
          onClick={() => tryExecute("backend")}
          disabled={backendLoading}
          variant="outline"
          size="sm"
        >
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
                {tab1Label}{" "}
                {timeDiff > 0 ? "nhanh hơn" : "chậm hơn"}{" "}
                {Math.abs(timeDiff).toFixed(2)} ms
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TimingBar
              label={tab1Label}
              stats={dbResult.stats}
              maxMs={Math.max(dbResult.stats.avg, backendResult.stats.avg)}
              variant="db"
            />
            <TimingBar
              label={tab2Label}
              stats={backendResult.stats}
              maxMs={Math.max(dbResult.stats.avg, backendResult.stats.avg)}
              variant="backend"
            />
          </div>
        </div>
      )}

      {/* Result tabs */}
      <Tabs defaultValue="db" className="space-y-4">
        <TabsList variant="line">
          <TabsTrigger value="db" className="gap-2">
            {tab1Label}
            {dbResult && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                TB {dbResult.stats.avg.toFixed(2)} ms
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="backend" className="gap-2">
            {tab2Label}
            {backendResult && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                TB {backendResult.stats.avg.toFixed(2)} ms
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="db">
          <ResultPanel
            result={dbResult}
            error={dbError}
            loading={dbLoading}
            returnDesc={returnDesc}
          />
        </TabsContent>

        <TabsContent value="backend">
          <ResultPanel
            result={backendResult}
            error={backendError}
            loading={backendLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TimingBar({
  label,
  stats,
  maxMs,
  variant,
}: {
  label: string;
  stats: TimingStats;
  maxMs: number;
  variant: "db" | "backend";
}) {
  const pct = maxMs > 0 ? (stats.avg / maxMs) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">
          {stats.avg.toFixed(2)} ms
        </span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            variant === "db" ? "bg-blue-500" : "bg-amber-500"
          }`}
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

function ResultPanel({
  result,
  error,
  loading,
  returnDesc,
}: {
  result: ExecutionResult | null;
  error: string | null;
  loading: boolean;
  returnDesc?: string;
}) {
  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground animate-pulse">
        Đang thực thi...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
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
    <div className="space-y-3">
      {/* Iteration stats */}
      {result.stats.iterations > 1 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Badge variant="secondary" className="font-mono gap-1 font-normal">
            {result.stats.iterations} lần chạy
          </Badge>
          <Badge variant="secondary" className="font-mono gap-1">
            TB: {result.stats.avg.toFixed(2)} ms
          </Badge>
          <Badge variant="secondary" className="font-mono gap-1">
            Min: {result.stats.min.toFixed(2)} ms
          </Badge>
          <Badge variant="secondary" className="font-mono gap-1">
            Max: {result.stats.max.toFixed(2)} ms
          </Badge>
        </div>
      )}

      <details className="group">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          Xem câu lệnh SQL
        </summary>
        <pre className="mt-2 p-4 rounded-lg bg-muted/50 text-xs font-mono whitespace-pre-wrap">
          {result.sql}
        </pre>
      </details>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary">
          TB {result.stats.avg.toFixed(2)} ms
        </Badge>
        <Badge variant="secondary">{result.rowCount ?? 0} dòng</Badge>
        {returnDesc && (
          <span className="text-xs text-muted-foreground">
            Kết quả: {returnDesc}
          </span>
        )}
      </div>

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
