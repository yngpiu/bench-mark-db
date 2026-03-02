export interface IndexInfo {
  table: string;
  column: string;
  ddl: string;
  label: string;
}

// All known indexes from bank.sql
export const AVAILABLE_INDEXES: Record<string, IndexInfo> = {
  idx_trans_account_id: {
    table: "fin_trans",
    column: "account_id",
    ddl: "CREATE INDEX IF NOT EXISTS idx_trans_account_id ON public.fin_trans(account_id)",
    label: "Giao dịch theo tài khoản",
  },
  idx_loan_account_id: {
    table: "fin_loan",
    column: "account_id",
    ddl: "CREATE INDEX IF NOT EXISTS idx_loan_account_id ON public.fin_loan(account_id)",
    label: "Khoản vay theo tài khoản",
  },
  idx_order_account_id: {
    table: "fin_order",
    column: "account_id",
    ddl: "CREATE INDEX IF NOT EXISTS idx_order_account_id ON public.fin_order(account_id)",
    label: "Lệnh chi theo tài khoản",
  },
  idx_account_district: {
    table: "fin_account",
    column: "district_id",
    ddl: "CREATE INDEX IF NOT EXISTS idx_account_district ON public.fin_account(district_id)",
    label: "Tài khoản theo quận/huyện",
  },
};

// Maps each function/procedure to the indexes it benefits from
export const FUNCTION_INDEXES: Record<string, string[]> = {
  fn_account_summary: ["idx_trans_account_id"],
  fn_balance_as_of: ["idx_trans_account_id"],
  fn_cashflow_report: ["idx_trans_account_id"],
  fn_loan_stats_by_region: ["idx_loan_account_id", "idx_account_district"],
  fn_loan_stats_by_status: ["idx_loan_account_id"],
  fn_order_stats_by_category: ["idx_order_account_id"],
  fn_trans_stats_by_type_operation: ["idx_trans_account_id"],
  sp_add_transaction: ["idx_trans_account_id"],
  sp_transfer_money: ["idx_trans_account_id"],
};
