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

const FUNCTIONS = [
  { name: "fn_loan_stats_by_region", label: "Thống kê vay theo vùng", description: "Thay đổi số lượng vùng trả về (p_top_n)" },
  { name: "fn_cashflow_report", label: "Báo cáo dòng tiền", description: "Thay đổi kỳ báo cáo (tháng / quý / năm)" },
  { name: "fn_account_summary", label: "Tổng hợp tài khoản", description: "Thay đổi khoảng ngày (1 năm / 3 năm / 5 năm / toàn bộ)" },
];

interface ScalePoint {
  label: string;
  params: unknown[];
  db: { avg: number; min: number; max: number };
  backend: { avg: number; min: number; max: number };
}

interface ScaleResult {
  functionName: string;
  description: string;
  iterations: number;
  results: ScalePoint[];
}

export default function ScaleTestPage() {
  const [selectedFn, setSelectedFn] = useState(FUNCTIONS[0].name);
  const [iterations, setIterations] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/scale-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ functionName: selectedFn, iterations }),
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

  const maxAvg = result
    ? Math.max(...result.results.flatMap((r) => [r.db.avg, r.backend.avg]))
    : 1;

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Kiểm tra theo quy mô dữ liệu</h1>
          <Badge variant="outline">Data Volume Scaling</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          So sánh hiệu năng khi dữ liệu đầu vào thay đổi — DB Function vs Backend Query
        </p>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Controls */}
        <div className="flex items-end gap-4 flex-wrap">
          <div className="grid gap-1.5">
            <Label>Chọn hàm</Label>
            <Select value={selectedFn} onValueChange={setSelectedFn}>
              <SelectTrigger className="w-[320px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUNCTIONS.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Số lần lặp mỗi mức</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={iterations}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n) && n >= 1 && n <= 20) setIterations(n);
              }}
              className="w-20 font-mono"
            />
          </div>

          <Button onClick={runTest} disabled={loading} size="lg">
            {loading ? "Đang chạy..." : "Chạy kiểm tra"}
          </Button>
        </div>

        {loading && (
          <div className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground animate-pulse">
            Đang chạy kiểm tra qua các mức quy mô...
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="text-sm text-muted-foreground">
              {result.description} — mỗi mức chạy <strong>{result.iterations}</strong> lần, lấy trung bình
            </div>

            {/* Chart */}
            <div className="rounded-xl border p-5 space-y-4">
              <h2 className="font-semibold text-sm">Biểu đồ hiệu năng theo quy mô</h2>
              <div className="space-y-5">
                {result.results.map((point) => (
                  <div key={point.label} className="space-y-2">
                    <div className="text-xs font-medium">{point.label}</div>
                    <div className="space-y-1.5">
                      <BarRow
                        label="Gọi hàm từ DB"
                        avg={point.db.avg}
                        maxMs={maxAvg}
                        color="bg-blue-500"
                      />
                      <BarRow
                        label="Truy vấn từ Backend"
                        avg={point.backend.avg}
                        maxMs={maxAvg}
                        color="bg-amber-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data table */}
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Quy mô</th>
                    <th className="text-right px-4 py-2.5 font-medium text-blue-600">DB Function (ms)</th>
                    <th className="text-right px-4 py-2.5 font-medium text-amber-600">Backend Query (ms)</th>
                    <th className="text-right px-4 py-2.5 font-medium">Hiệu suất</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.results.map((point) => {
                    const diff = point.backend.avg - point.db.avg;
                    const faster = diff > 0;
                    return (
                      <tr key={point.label} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{point.label}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-blue-600">
                          {point.db.avg.toFixed(2)}
                          <span className="text-muted-foreground text-xs ml-1">
                            ({point.db.min.toFixed(1)}–{point.db.max.toFixed(1)})
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-600">
                          {point.backend.avg.toFixed(2)}
                          <span className="text-muted-foreground text-xs ml-1">
                            ({point.backend.min.toFixed(1)}–{point.backend.max.toFixed(1)})
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge variant={faster ? "default" : "secondary"} className="font-mono text-xs">
                            DB {faster ? "nhanh" : "chậm"} hơn {Math.abs(diff).toFixed(2)} ms
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Chọn hàm và nhấn &quot;Chạy kiểm tra&quot; để bắt đầu
          </div>
        )}
      </div>
    </div>
  );
}

function BarRow({ label, avg, maxMs, color }: { label: string; avg: number; maxMs: number; color: string }) {
  const pct = maxMs > 0 ? (avg / maxMs) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-32 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
        <div className={`h-full ${color} rounded flex items-center`} style={{ width: `${Math.max(pct, 2)}%` }}>
          <span className="text-white font-mono text-[10px] px-1.5 whitespace-nowrap">{avg.toFixed(2)} ms</span>
        </div>
      </div>
    </div>
  );
}
