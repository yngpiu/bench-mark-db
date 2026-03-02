"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Handle,
  Position,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Table } from "@/lib/sql-parser";
import { tableLabels } from "@/lib/vi-labels";

interface TableNodeData {
  label: string;
  viLabel: string;
  columns: {
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
  }[];
}

function TableNode({ data }: { data: TableNodeData }) {
  return (
    <div className="bg-card rounded-xl shadow-sm min-w-[250px] overflow-hidden ring-1 ring-border/50">
      <div className="bg-primary text-primary-foreground px-3 py-2">
        <div className="font-semibold text-sm">{data.viLabel}</div>
        <div className="text-[10px] opacity-75 font-mono">{data.label}</div>
      </div>
      <div className="divide-y">
        {data.columns.map((col) => (
          <div
            key={col.name}
            className="px-3 py-1.5 text-xs flex items-center gap-2 relative"
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`${col.name}-target`}
              className="!w-2 !h-2 !bg-blue-500 !border-0"
            />
            <span className="flex items-center gap-1.5 flex-1">
              {col.isPrimaryKey && (
                <span className="text-amber-500 font-bold" title="Khóa chính">
                  PK
                </span>
              )}
              {col.isForeignKey && (
                <span className="text-blue-500 font-bold" title="Khóa ngoại">
                  FK
                </span>
              )}
              <span
                className={
                  col.isPrimaryKey
                    ? "font-semibold text-foreground"
                    : "text-foreground"
                }
              >
                {col.name}
              </span>
            </span>
            <span className="text-muted-foreground font-mono">{col.type}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={`${col.name}-source`}
              className="!w-2 !h-2 !bg-green-500 !border-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

function layoutTables(tables: Table[]) {
  const positions: Record<string, { x: number; y: number }> = {
    fin_district: { x: 0, y: 0 },
    fin_client: { x: 380, y: 0 },
    fin_account: { x: 380, y: 280 },
    fin_disp: { x: 760, y: 120 },
    fin_card: { x: 1140, y: 0 },
    fin_loan: { x: 0, y: 420 },
    fin_order: { x: 380, y: 580 },
    fin_trans: { x: 760, y: 420 },
  };

  const nodes: Node[] = tables.map((table) => {
    const fkColumns = new Set(table.foreignKeys.map((fk) => fk.column));
    return {
      id: table.name,
      type: "tableNode",
      position: positions[table.name] || { x: 0, y: 0 },
      data: {
        label: table.name,
        viLabel: tableLabels[table.name] ?? table.name,
        columns: table.columns.map((col) => ({
          name: col.name,
          type: col.type
            .replace(/character varying\((\d+)\)/i, "varchar($1)")
            .replace(/character\((\d+)\)/i, "char($1)")
            .replace(/numeric\((\d+),\s*(\d+)\)/i, "numeric($1,$2)"),
          isPrimaryKey: col.isPrimaryKey,
          isForeignKey: fkColumns.has(col.name),
        })),
      },
    };
  });

  const edges: Edge[] = [];
  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      edges.push({
        id: `${table.name}.${fk.column}->${fk.refTable}.${fk.refColumn}`,
        source: table.name,
        sourceHandle: `${fk.column}-source`,
        target: fk.refTable,
        targetHandle: `${fk.refColumn}-target`,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 2 },
        label: fk.column,
        labelStyle: { fontSize: 10, fill: "#6366f1" },
        labelBgStyle: { fill: "white", fillOpacity: 0.8 },
      });
    }
  }

  return { nodes, edges };
}

interface ErDiagramProps {
  tables: Table[];
}

export function ErDiagram({ tables }: ErDiagramProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => layoutTables(tables),
    [tables]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-card/95 !ring-1 !ring-border/40 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
