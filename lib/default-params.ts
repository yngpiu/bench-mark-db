/**
 * Default parameter values based on actual database data.
 * These provide sensible starting values so users can immediately run benchmarks.
 */
export const defaultParamValues: Record<string, Record<string, string>> = {
  fn_account_summary: {
    p_account_id: "8261",
    p_date_from: "2020-01-01",
    p_date_to: "2025-12-31",
  },
  fn_balance_as_of: {
    p_account_id: "8261",
    p_as_of_date: "2025-06-30",
  },
  fn_cashflow_report: {
    p_period: "month",
  },
  fn_loan_stats_by_region: {
    p_top_n: "10",
  },
  fn_loan_stats_by_status: {},
  fn_order_stats_by_category: {},
  fn_trans_stats_by_type_operation: {
    p_account_id: "8261",
    p_date_from: "2020-01-01",
    p_date_to: "2025-12-31",
  },
  sp_add_transaction: {
    p_account_id: "8261",
    p_trans_date: "2026-03-01",
    p_amount: "100.00",
    p_trans_type: "C",
    p_operation: "CIB",
    p_category: "HH",
  },
  sp_transfer_money: {
    p_from_account_id: "8261",
    p_to_account_id: "3834",
    p_amount: "50.00",
    p_trans_date: "2026-03-01",
  },
};

export function getDefaults(name: string): Record<string, string> {
  return defaultParamValues[name] ?? {};
}
