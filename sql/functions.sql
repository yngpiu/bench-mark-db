-- FUNCTION: public.fn_account_summary(integer, date, date)

-- DROP FUNCTION IF EXISTS public.fn_account_summary(integer, date, date);

CREATE OR REPLACE FUNCTION public.fn_account_summary(
	p_account_id integer,
	p_date_from date,
	p_date_to date)
    RETURNS TABLE(total_credit numeric, total_debit numeric, net_amount numeric, num_transactions bigint) 
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN t.trans_type='C' THEN t.amount ELSE 0 END),0),
        COALESCE(SUM(CASE WHEN t.trans_type='D' THEN t.amount ELSE 0 END),0),
        COALESCE(SUM(
            CASE
                WHEN t.trans_type='C' THEN t.amount
                WHEN t.trans_type='D' THEN -t.amount
            END),0),
        COUNT(*)
    FROM fin_trans t
    WHERE t.account_id=p_account_id
      AND t.trans_date BETWEEN p_date_from AND p_date_to;
END;
$BODY$;

ALTER FUNCTION public.fn_account_summary(integer, date, date)
    OWNER TO postgres;

-- FUNCTION: public.fn_balance_as_of(integer, date)

-- DROP FUNCTION IF EXISTS public.fn_balance_as_of(integer, date);

CREATE OR REPLACE FUNCTION public.fn_balance_as_of(
	p_account_id integer,
	p_as_of_date date)
    RETURNS numeric
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
DECLARE
    v_balance numeric(12,2);
BEGIN
    SELECT balance
    INTO v_balance
    FROM fin_trans
    WHERE account_id=p_account_id
      AND trans_date<=p_as_of_date
    ORDER BY trans_date DESC, trans_id DESC
    LIMIT 1;

    RETURN COALESCE(v_balance,0);
END;
$BODY$;

ALTER FUNCTION public.fn_balance_as_of(integer, date)
    OWNER TO postgres;

-- FUNCTION: public.fn_cashflow_report(text)

-- DROP FUNCTION IF EXISTS public.fn_cashflow_report(text);

CREATE OR REPLACE FUNCTION public.fn_cashflow_report(
	p_period text DEFAULT 'month'::text)
    RETURNS TABLE(period text, total_credit numeric, total_debit numeric, net_flow numeric, trans_count bigint) 
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        CASE p_period
            WHEN 'month' THEN to_char(trans_date,'YYYY-MM')
            WHEN 'quarter' THEN to_char(trans_date,'YYYY-"Q"Q')
            WHEN 'year' THEN to_char(trans_date,'YYYY')
            ELSE to_char(trans_date,'YYYY-MM')
        END,
        SUM(CASE WHEN trans_type='C' THEN amount ELSE 0 END),
        SUM(CASE WHEN trans_type='D' THEN amount ELSE 0 END),
        SUM(CASE WHEN trans_type='C' THEN amount ELSE -amount END),
        COUNT(*)
    FROM fin_trans
    GROUP BY 1
    ORDER BY 1;
END;
$BODY$;

ALTER FUNCTION public.fn_cashflow_report(text)
    OWNER TO postgres;

-- FUNCTION: public.fn_loan_stats_by_region(integer)

-- DROP FUNCTION IF EXISTS public.fn_loan_stats_by_region(integer);

CREATE OR REPLACE FUNCTION public.fn_loan_stats_by_region(
	p_top_n integer DEFAULT 10)
    RETURNS TABLE(region character varying, district_name character varying, loan_count bigint, total_amount numeric, avg_amount numeric) 
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        d.region,
        d.district_name,
        COUNT(*),
        SUM(l.amount),
        ROUND(AVG(l.amount),2)
    FROM fin_loan l
    JOIN fin_account a USING(account_id)
    JOIN fin_district d USING(district_id)
    GROUP BY d.region,d.district_name
    ORDER BY loan_count DESC
    LIMIT p_top_n;
END;
$BODY$;

ALTER FUNCTION public.fn_loan_stats_by_region(integer)
    OWNER TO postgres;

-- FUNCTION: public.fn_loan_stats_by_status()

-- DROP FUNCTION IF EXISTS public.fn_loan_stats_by_status();

CREATE OR REPLACE FUNCTION public.fn_loan_stats_by_status(
	)
    RETURNS TABLE(status character, loan_count bigint, total_amount numeric, avg_amount numeric, avg_payments numeric, avg_duration numeric) 
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        l.status,
        COUNT(*),
        SUM(l.amount),
        ROUND(AVG(l.amount),2),
        ROUND(AVG(l.payments),2),
        ROUND(AVG(l.duration::numeric),2)
    FROM fin_loan l
    GROUP BY l.status
    ORDER BY l.status;
END;
$BODY$;

ALTER FUNCTION public.fn_loan_stats_by_status()
    OWNER TO postgres;

-- FUNCTION: public.fn_order_stats_by_category()

-- DROP FUNCTION IF EXISTS public.fn_order_stats_by_category();

CREATE OR REPLACE FUNCTION public.fn_order_stats_by_category(
	)
    RETURNS TABLE(category character varying, order_count bigint, total_amount numeric, avg_amount numeric) 
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(o.category,'NA')::character varying,
        COUNT(*),
        SUM(o.amount),
        ROUND(AVG(o.amount),2)
    FROM fin_order o
    GROUP BY COALESCE(o.category,'NA')
    ORDER BY SUM(o.amount) DESC;
END;
$BODY$;

ALTER FUNCTION public.fn_order_stats_by_category()
    OWNER TO postgres;

-- FUNCTION: public.fn_trans_stats_by_type_operation(integer, date, date)

-- DROP FUNCTION IF EXISTS public.fn_trans_stats_by_type_operation(integer, date, date);

CREATE OR REPLACE FUNCTION public.fn_trans_stats_by_type_operation(
	p_account_id integer,
	p_date_from date DEFAULT NULL::date,
	p_date_to date DEFAULT NULL::date)
    RETURNS TABLE(trans_type character, operation character varying, trans_count bigint, total_amount numeric) 
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        t.trans_type,
        COALESCE(t.operation,'N/A'),
        COUNT(*),
        SUM(t.amount)
    FROM fin_trans t
    WHERE t.account_id=p_account_id
      AND (p_date_from IS NULL OR t.trans_date>=p_date_from)
      AND (p_date_to IS NULL OR t.trans_date<=p_date_to)
    GROUP BY t.trans_type, COALESCE(t.operation,'N/A')
    ORDER BY t.trans_type, total_amount DESC;
END;
$BODY$;

ALTER FUNCTION public.fn_trans_stats_by_type_operation(integer, date, date)
    OWNER TO postgres;

