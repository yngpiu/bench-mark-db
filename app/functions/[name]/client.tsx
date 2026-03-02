"use client";

import { Badge } from "@/components/ui/badge";
import { BenchmarkPanel } from "@/components/benchmark-panel";
import { functionDescriptions } from "@/lib/vi-labels";
import type { FunctionParam } from "@/lib/sql-parser";

interface FunctionPageClientProps {
  name: string;
  params: FunctionParam[];
  returnType: string;
  defaults: Record<string, string>;
}

export function FunctionPageClient({
  name,
  params,
  defaults,
}: FunctionPageClientProps) {
  const desc = functionDescriptions[name];
  const title = desc?.title ?? name;
  const description = desc?.description;
  const returnDesc = desc?.returnDesc;

  return (
    <div className="h-screen flex flex-col">
      <header className="px-6 py-4 shrink-0 bg-muted/20">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{title}</h1>
          <Badge>Hàm</Badge>
          <code className="text-xs text-muted-foreground font-mono">
            {name}
          </code>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </header>

      <div className="flex-1 overflow-auto p-6">
        <BenchmarkPanel
          type="function"
          name={name}
          params={params}
          defaults={defaults}
          returnDesc={returnDesc}
          tab1Label="Gọi hàm từ DB"
          tab2Label="Truy vấn từ Backend"
        />
      </div>
    </div>
  );
}
