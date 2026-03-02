"use client";

import { Badge } from "@/components/ui/badge";
import { BenchmarkPanel } from "@/components/benchmark-panel";
import { procedureDescriptions } from "@/lib/vi-labels";
import type { FunctionParam } from "@/lib/sql-parser";

interface ProcedurePageClientProps {
  name: string;
  params: FunctionParam[];
  defaults: Record<string, string>;
}

export function ProcedurePageClient({
  name,
  params,
  defaults,
}: ProcedurePageClientProps) {
  const desc = procedureDescriptions[name];
  const title = desc?.title ?? name;
  const description = desc?.description;

  return (
    <div className="h-screen flex flex-col">
      <header className="px-6 py-4 shrink-0 bg-muted/20">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{title}</h1>
          <Badge variant="secondary">Thủ tục</Badge>
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
          type="procedure"
          name={name}
          params={params}
          defaults={defaults}
          tab1Label="Gọi thủ tục DB"
          tab2Label="Truy vấn Backend"
        />
      </div>
    </div>
  );
}
