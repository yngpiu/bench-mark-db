"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getColumnLabel } from "@/lib/vi-labels";

interface DataTableProps {
  fields: { name: string }[];
  rows: Record<string, unknown>[];
}

export function DataTable({ fields, rows }: DataTableProps) {
  if (!fields.length || !rows.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Không có kết quả trả về
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[500px] rounded-lg overflow-hidden bg-muted/10">
      <Table className="[&_tr]:border-border/50">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px] text-center">STT</TableHead>
            {fields.map((f) => (
              <TableHead key={f.name} className="font-semibold">
                {getColumnLabel(f.name)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="text-center text-muted-foreground text-xs">
                {i + 1}
              </TableCell>
              {fields.map((f) => (
                <TableCell key={f.name} className="font-mono text-sm">
                  {formatValue(row[f.name])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}
