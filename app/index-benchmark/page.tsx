"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SparkLine } from "@/components/spark-line";

const INDEXES = [
  { name: "idx_trans_account_id", label: "Giao dịch theo tài khoản", table: "fin_trans", column: "account_id" },
  { name: "idx_loan_account_id", label: "Khoản vay theo tài khoản", table: "fin_loan", column: "account_id" },
  { name: "idx_order_account_id", label: "Lệnh chi theo tài khoản", table: "fin_order", column: "account_id" },
  { name: "idx_account_district", label: "Tài khoản theo quận/huyện", table: "fin_account", column: "district_id" },
];

interface BenchmarkResult {
  indexName: string;
  table: string;
  column: string;
  query: string;
  iterations: number;
  withIndex: { timings: number[]; avg: number; min: number; max: number };
  withoutIndex: { timings: number[]; avg: number; min: number; max: number };
}

export default function IndexBenchmarkPage() {
  const [selectedIndex, setSelectedIndex] = useState(INDEXES[0].name);
  const [iterations, setIterations] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runBenchmark() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/index-benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexName: selectedIndex, iterations }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  const speedup = result
    ? ((result.withoutIndex.avg - result.withIndex.avg) / result.withoutIndex.avg) * 100
    : null;
  const faster = speedup !== null && speedup > 0;
  const maxAvg = result ? Math.max(result.withIndex.avg, result.withoutIndex.avg) : 1;

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Benchmark Index</h1>
          <Badge variant="outline">So sánh có / không có index</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tạm thời DROP index, đo hiệu năng truy vấn, rồi tự động tạo lại index
        </p>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Controls */}
        <div className="flex items-end gap-4 flex-wrap">
          <div className="grid gap-1.5">
            <Label>Chọn Index</Label>
            <Select value={selectedIndex} onValueChange={setSelectedIndex}>
              <SelectTrigger className="w-[320px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDEXES.map((idx) => (
                  <SelectItem key={idx.name} value={idx.name}>
                    <span className="font-medium">{idx.label}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      {idx.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Số lần chạy mỗi mode</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={iterations}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n) && n >= 1 && n <= 50) setIterations(n);
              }}
              className="w-24 font-mono"
            />
          </div>

          <Button onClick={runBenchmark} disabled={loading} size="lg">
            {loading ? "Đang chạy... (vui lòng chờ)" : `Chạy Benchmark ×${iterations}`}
          </Button>
        </div>

        {loading && (
          <div className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground animate-pulse">
            Đang chạy benchmark — sẽ tạm DROP index và tạo lại sau khi hoàn thành...
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Verdict */}
            <div className="rounded-xl border p-5 bg-muted/20 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Kết quả so sánh</h2>
                {speedup !== null && (
                  <Badge variant={faster ? "default" : "destructive"}>
                    {faster
                      ? `Index nhanh hơn ${speedup.toFixed(1)}%`
                      : `Index chậm hơn ${Math.abs(speedup).toFixed(1)}%`}
                  </Badge>
                )}
              </div>

              <div className="grid gap-1.5 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Truy vấn: </span>
                  <code className="font-mono">{result.query}</code>
                </div>
                <div>
                  <span className="font-medium text-foreground">Index: </span>
                  <code className="font-mono">{result.indexName}</code>
                  {" → "}
                  <code className="font-mono">{result.table}.{result.column}</code>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <StatBar
                  label="Có Index"
                  stats={result.withIndex}
                  maxMs={maxAvg}
                  variant="with"
                />
                <StatBar
                  label="Không có Index"
                  stats={result.withoutIndex}
                  maxMs={maxAvg}
                  variant="without"
                />
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-4 space-y-2">
                <div className="text-sm font-medium">Có Index — biểu đồ từng lần chạy</div>
                <SparkLine
                  data={result.withIndex.timings}
                  color="rgb(59,130,246)"
                  height={60}
                />
              </div>
              <div className="rounded-xl border p-4 space-y-2">
                <div className="text-sm font-medium">Không có Index — biểu đồ từng lần chạy</div>
                <SparkLine
                  data={result.withoutIndex.timings}
                  color="rgb(239,68,68)"
                  height={60}
                />
              </div>
            </div>

            {/* Raw timings table */}
            <div className="rounded-xl border p-4 space-y-3">
              <div className="text-sm font-semibold">Chi tiết từng lần chạy (ms)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 pr-4 text-muted-foreground font-medium">Lần</th>
                      <th className="text-right py-1.5 pr-4 text-blue-500 font-medium">Có Index</th>
                      <th className="text-right py-1.5 text-red-500 font-medium">Không có Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.withIndex.timings.map((t, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1 pr-4 text-muted-foreground">{i + 1}</td>
                        <td className="py-1 pr-4 text-right text-blue-600">{t.toFixed(2)}</td>
                        <td className="py-1 text-right text-red-600">
                          {result.withoutIndex.timings[i]?.toFixed(2) ?? "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="pt-2 pr-4 text-muted-foreground">TB</td>
                      <td className="pt-2 pr-4 text-right text-blue-600">{result.withIndex.avg.toFixed(2)}</td>
                      <td className="pt-2 text-right text-red-600">{result.withoutIndex.avg.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Chọn index và nhấn &quot;Chạy Benchmark&quot; để bắt đầu
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({
  label,
  stats,
  maxMs,
  variant,
}: {
  label: string;
  stats: { avg: number; min: number; max: number };
  maxMs: number;
  variant: "with" | "without";
}) {
  const pct = maxMs > 0 ? (stats.avg / maxMs) * 100 : 0;
  const color = variant === "with" ? "bg-blue-500" : "bg-red-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono font-semibold">{stats.avg.toFixed(2)} ms</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>Min: {stats.min.toFixed(2)} ms</span>
        <span>Max: {stats.max.toFixed(2)} ms</span>
      </div>
    </div>
  );
}
