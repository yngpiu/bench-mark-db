import fs from "fs";
import path from "path";
import {
  parseBankSql,
  parseFunctionsSql,
  parseProceduresSql,
  type Table,
  type ParsedFunction,
  type ParsedProcedure,
} from "./sql-parser";

const sqlDir = path.join(process.cwd(), "sql");

let _tables: Table[] | null = null;
let _functions: ParsedFunction[] | null = null;
let _procedures: ParsedProcedure[] | null = null;

export function getTables(): Table[] {
  if (!_tables) {
    const sql = fs.readFileSync(path.join(sqlDir, "bank.sql"), "utf-8");
    _tables = parseBankSql(sql);
  }
  return _tables;
}

export function getFunctions(): ParsedFunction[] {
  if (!_functions) {
    const sql = fs.readFileSync(path.join(sqlDir, "functions.sql"), "utf-8");
    _functions = parseFunctionsSql(sql);
  }
  return _functions;
}

export function getProcedures(): ParsedProcedure[] {
  if (!_procedures) {
    const sql = fs.readFileSync(
      path.join(sqlDir, "stored_procedures.sql"),
      "utf-8"
    );
    _procedures = parseProceduresSql(sql);
  }
  return _procedures;
}

export function getFunctionByName(name: string): ParsedFunction | undefined {
  return getFunctions().find((f) => f.name === name);
}

export function getProcedureByName(
  name: string
): ParsedProcedure | undefined {
  return getProcedures().find((p) => p.name === name);
}
