export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface ForeignKey {
  column: string;
  refTable: string;
  refColumn: string;
}

export interface Table {
  name: string;
  columns: Column[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
}

export interface FunctionParam {
  name: string;
  type: string;
  defaultValue?: string;
  mode?: string; // IN, OUT, INOUT
}

export interface ParsedFunction {
  name: string;
  params: FunctionParam[];
  returnType: string;
  body: string;
  fullSql: string;
}

export interface ParsedProcedure {
  name: string;
  params: FunctionParam[];
  body: string;
  fullSql: string;
}

export function parseBankSql(sql: string): Table[] {
  const tables: Table[] = [];
  const pkMap = new Map<string, string[]>();

  const tableRegex =
    /CREATE TABLE IF NOT EXISTS public\.(\w+)\s*\(([\s\S]*?)\);/g;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns: Column[] = [];
    const primaryKey: string[] = [];

    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      const constraintMatch = line.match(
        /CONSTRAINT\s+\w+\s+PRIMARY KEY\s*\(([^)]+)\)/i
      );
      if (constraintMatch) {
        const cols = constraintMatch[1].split(",").map((c) => c.trim());
        primaryKey.push(...cols);
        continue;
      }

      if (/^CONSTRAINT/i.test(line)) continue;

      const colMatch = line
        .replace(/,\s*$/, "")
        .match(/^(\w+)\s+(.+?)(?:\s+NOT NULL)?(?:\s+COLLATE\s+[^\s,]+)?$/i);
      if (colMatch) {
        const colName = colMatch[1];
        if (colName.toUpperCase() === "CONSTRAINT") continue;

        const rawType = colMatch[2]
          .replace(/COLLATE\s+\S+/gi, "")
          .replace(/NOT NULL/gi, "")
          .trim()
          .replace(/,\s*$/, "");

        columns.push({
          name: colName,
          type: rawType,
          nullable: !line.includes("NOT NULL"),
          isPrimaryKey: false,
        });
      }
    }

    for (const col of columns) {
      if (primaryKey.includes(col.name)) {
        col.isPrimaryKey = true;
      }
    }

    pkMap.set(tableName, primaryKey);
    tables.push({ name: tableName, columns, primaryKey, foreignKeys: [] });
  }

  const fkRegex =
    /ALTER TABLE IF EXISTS public\.(\w+)\s+ADD CONSTRAINT\s+\w+\s+FOREIGN KEY\s*\((\w+)\)\s*REFERENCES public\.(\w+)\s*\((\w+)\)/g;
  while ((match = fkRegex.exec(sql)) !== null) {
    const m = match;
    const table = tables.find((t) => t.name === m[1]);
    if (table) {
      table.foreignKeys.push({
        column: m[2],
        refTable: m[3],
        refColumn: m[4],
      });
    }
  }

  return tables;
}

export function parseFunctionsSql(sql: string): ParsedFunction[] {
  const functions: ParsedFunction[] = [];

  const blocks = sql.split(
    /-- FUNCTION:/
  );

  for (const block of blocks) {
    if (!block.trim()) continue;

    const createMatch = block.match(
      /CREATE OR REPLACE FUNCTION public\.(\w+)\s*\(([\s\S]*?)\)\s*RETURNS\s+([\s\S]*?)\s+LANGUAGE/i
    );
    if (!createMatch) continue;

    const name = createMatch[1];
    const paramsRaw = createMatch[2].trim();
    const returnType = createMatch[3].trim();

    const params = parseParams(paramsRaw);

    const bodyMatch = block.match(/AS \$BODY\$([\s\S]*?)\$BODY\$/);
    const body = bodyMatch ? bodyMatch[1].trim() : "";

    const fullSqlMatch = block.match(
      /(CREATE OR REPLACE FUNCTION[\s\S]*?\$BODY\$;)/
    );
    const fullSql = fullSqlMatch ? fullSqlMatch[1] : "";

    functions.push({ name, params, returnType, body, fullSql });
  }

  return functions;
}

export function parseProceduresSql(sql: string): ParsedProcedure[] {
  const procedures: ParsedProcedure[] = [];

  const blocks = sql.split(/-- PROCEDURE:/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    const createMatch = block.match(
      /CREATE OR REPLACE PROCEDURE public\.(\w+)\s*\(([\s\S]*?)\)\s*LANGUAGE/i
    );
    if (!createMatch) continue;

    const name = createMatch[1];
    const paramsRaw = createMatch[2].trim();
    const params = parseParams(paramsRaw);

    const bodyMatch = block.match(/AS \$BODY\$([\s\S]*?)\$BODY\$/);
    const body = bodyMatch ? bodyMatch[1].trim() : "";

    const fullSqlMatch = block.match(
      /(CREATE OR REPLACE PROCEDURE[\s\S]*?\$BODY\$;)/
    );
    const fullSql = fullSqlMatch ? fullSqlMatch[1] : "";

    procedures.push({ name, params, body, fullSql });
  }

  return procedures;
}

function parseParams(raw: string): FunctionParam[] {
  if (!raw.trim()) return [];

  const params: FunctionParam[] = [];
  const lines = raw.split(",").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const cleaned = line.replace(/\n/g, " ").replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    let mode = "";
    let rest = cleaned;

    if (/^(IN|OUT|INOUT)\s+/i.test(rest)) {
      const m = rest.match(/^(IN|OUT|INOUT)\s+/i);
      if (m) {
        mode = m[1].toUpperCase();
        rest = rest.slice(m[0].length);
      }
    }

    const defaultMatch = rest.match(/\s+DEFAULT\s+(.+)$/i);
    let defaultValue: string | undefined;
    if (defaultMatch) {
      defaultValue = defaultMatch[1].trim();
      rest = rest.slice(0, defaultMatch.index).trim();
    }

    const parts = rest.split(/\s+/);
    const name = parts[0];
    const type = parts.slice(1).join(" ");

    params.push({ name, type, defaultValue, mode });
  }

  return params;
}
