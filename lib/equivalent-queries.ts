export interface EquivalentQuery {
  sql: string;
  description: string;
}

export const functionQueries: Record<string, EquivalentQuery> = {
  fn_account_summary: {
    description: "Aggregate credit/debit/net from fin_trans with date range filter",
    sql: `
SELECT
    COALESCE(SUM(CASE WHEN t.trans_type='C' THEN t.amount ELSE 0 END),0) AS total_credit,
    COALESCE(SUM(CASE WHEN t.trans_type='D' THEN t.amount ELSE 0 END),0) AS total_debit,
    COALESCE(SUM(
        CASE
            WHEN t.trans_type='C' THEN t.amount
            WHEN t.trans_type='D' THEN -t.amount
        END),0) AS net_amount,
    COUNT(*) AS num_transactions
FROM fin_trans t
WHERE t.account_id = $1
  AND t.trans_date BETWEEN $2 AND $3`,
  },

  fn_balance_as_of: {
    description: "Get latest balance from fin_trans up to a given date",
    sql: `
SELECT COALESCE(
    (SELECT balance
     FROM fin_trans
     WHERE account_id = $1
       AND trans_date <= $2
     ORDER BY trans_date DESC, trans_id DESC
     LIMIT 1),
    0
) AS balance`,
  },

  fn_cashflow_report: {
    description: "Cashflow aggregation grouped by period (month/quarter/year)",
    sql: `
SELECT
    CASE $1
        WHEN 'month' THEN to_char(trans_date,'YYYY-MM')
        WHEN 'quarter' THEN to_char(trans_date,'YYYY-"Q"Q')
        WHEN 'year' THEN to_char(trans_date,'YYYY')
        ELSE to_char(trans_date,'YYYY-MM')
    END AS period,
    SUM(CASE WHEN trans_type='C' THEN amount ELSE 0 END) AS total_credit,
    SUM(CASE WHEN trans_type='D' THEN amount ELSE 0 END) AS total_debit,
    SUM(CASE WHEN trans_type='C' THEN amount ELSE -amount END) AS net_flow,
    COUNT(*) AS trans_count
FROM fin_trans
GROUP BY 1
ORDER BY 1`,
  },

  fn_loan_stats_by_region: {
    description: "Loan stats joined with district, grouped by region, top N",
    sql: `
SELECT
    d.region,
    d.district_name,
    COUNT(*) AS loan_count,
    SUM(l.amount) AS total_amount,
    ROUND(AVG(l.amount),2) AS avg_amount
FROM fin_loan l
JOIN fin_account a USING(account_id)
JOIN fin_district d USING(district_id)
GROUP BY d.region, d.district_name
ORDER BY loan_count DESC
LIMIT $1`,
  },

  fn_loan_stats_by_status: {
    description: "Loan statistics grouped by status",
    sql: `
SELECT
    status,
    COUNT(*) AS loan_count,
    SUM(amount) AS total_amount,
    ROUND(AVG(amount),2) AS avg_amount,
    ROUND(AVG(payments),2) AS avg_payments,
    ROUND(AVG(duration::numeric),2) AS avg_duration
FROM fin_loan
GROUP BY status
ORDER BY status`,
  },

  fn_order_stats_by_category: {
    description: "Order statistics grouped by category",
    sql: `
SELECT
    COALESCE(category,'NA') AS category,
    COUNT(*) AS order_count,
    SUM(amount) AS total_amount,
    ROUND(AVG(amount),2) AS avg_amount
FROM fin_order
GROUP BY COALESCE(category,'NA')
ORDER BY total_amount DESC`,
  },

  fn_trans_stats_by_type_operation: {
    description: "Transaction stats by type and operation with optional date filter",
    sql: `
SELECT
    t.trans_type,
    COALESCE(t.operation,'N/A') AS operation,
    COUNT(*) AS trans_count,
    SUM(t.amount) AS total_amount
FROM fin_trans t
WHERE t.account_id = $1
  AND ($2::date IS NULL OR t.trans_date >= $2)
  AND ($3::date IS NULL OR t.trans_date <= $3)
GROUP BY t.trans_type, COALESCE(t.operation,'N/A')
ORDER BY t.trans_type, total_amount DESC`,
  },
};

export const procedureQueries: Record<string, EquivalentQuery> = {
  sp_add_transaction: {
    description:
      "Get last balance, compute new balance, then INSERT into fin_trans",
    sql: `
WITH last_bal AS (
    SELECT COALESCE(
        (SELECT balance FROM fin_trans
         WHERE account_id = $2
         ORDER BY trans_date DESC, trans_id DESC
         LIMIT 1),
        0
    ) AS bal
)
INSERT INTO fin_trans(
    trans_id, account_id, trans_date,
    amount, balance,
    trans_type, operation,
    category, other_bank_id, other_account_id
)
SELECT
    $1, $2, $3,
    $4,
    CASE
        WHEN $5 = 'C' THEN lb.bal + $4
        WHEN $5 = 'D' THEN lb.bal - $4
    END,
    $5, $6,
    $7, $8, $9
FROM last_bal lb
WHERE ($5 = 'C')
   OR ($5 = 'D' AND lb.bal >= $4)`,
  },

  sp_transfer_money: {
    description:
      "Two-step: debit from source account, credit to destination account",
    sql: `
WITH from_bal AS (
    SELECT COALESCE(
        (SELECT balance FROM fin_trans
         WHERE account_id = $3
         ORDER BY trans_date DESC, trans_id DESC
         LIMIT 1),
        0
    ) AS bal
),
debit_insert AS (
    INSERT INTO fin_trans(
        trans_id, account_id, trans_date,
        amount, balance,
        trans_type, operation,
        category, other_bank_id, other_account_id
    )
    SELECT
        $1, $3, $6,
        $5, fb.bal - $5,
        'D', 'CIB',
        NULL, NULL, $4
    FROM from_bal fb
    WHERE fb.bal >= $5
    RETURNING balance
),
to_bal AS (
    SELECT COALESCE(
        (SELECT balance FROM fin_trans
         WHERE account_id = $4
         ORDER BY trans_date DESC, trans_id DESC
         LIMIT 1),
        0
    ) AS bal
)
INSERT INTO fin_trans(
    trans_id, account_id, trans_date,
    amount, balance,
    trans_type, operation,
    category, other_bank_id, other_account_id
)
SELECT
    $2, $4, $6,
    $5, tb.bal + $5,
    'C', 'CIB',
    NULL, NULL, $3
FROM to_bal tb
WHERE EXISTS (SELECT 1 FROM debit_insert)`,
  },
};
