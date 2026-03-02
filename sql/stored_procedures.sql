-- PROCEDURE: public.sp_add_transaction(integer, integer, date, numeric, character, character varying, character varying, character varying, integer)

-- DROP PROCEDURE IF EXISTS public.sp_add_transaction(integer, integer, date, numeric, character, character varying, character varying, character varying, integer);

CREATE OR REPLACE PROCEDURE public.sp_add_transaction(
	IN p_trans_id integer,
	IN p_account_id integer,
	IN p_trans_date date,
	IN p_amount numeric,
	IN p_trans_type character,
	IN p_operation character varying DEFAULT NULL::character varying,
	IN p_category character varying DEFAULT NULL::character varying,
	IN p_other_bank_id character varying DEFAULT NULL::character varying,
	IN p_other_account_id integer DEFAULT NULL::integer)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    v_last_balance numeric(12,2);
    v_new_balance numeric(12,2);
BEGIN
    SELECT balance
    INTO v_last_balance
    FROM fin_trans
    WHERE account_id=p_account_id
    ORDER BY trans_date DESC,trans_id DESC
    LIMIT 1;

    v_last_balance:=COALESCE(v_last_balance,0);

    IF p_trans_type='C' THEN
        v_new_balance:=v_last_balance+p_amount;

    ELSIF p_trans_type='D' THEN
        IF v_last_balance<p_amount THEN
            RAISE EXCEPTION
            'Insufficient balance. Current=%, Required=%',
            v_last_balance,p_amount;
        END IF;

        v_new_balance:=v_last_balance-p_amount;
    ELSE
        RAISE EXCEPTION 'Invalid trans_type';
    END IF;

    INSERT INTO fin_trans(
        trans_id,account_id,trans_date,
        amount,balance,
        trans_type,operation,
        category,other_bank_id,other_account_id
    )
    VALUES(
        p_trans_id,p_account_id,p_trans_date,
        p_amount,v_new_balance,
        p_trans_type,p_operation,
        p_category,p_other_bank_id,p_other_account_id
    );
END;
$BODY$;
ALTER PROCEDURE public.sp_add_transaction(integer, integer, date, numeric, character, character varying, character varying, character varying, integer)
    OWNER TO postgres;



-- PROCEDURE: public.sp_transfer_money(integer, integer, integer, integer, numeric, date)

-- DROP PROCEDURE IF EXISTS public.sp_transfer_money(integer, integer, integer, integer, numeric, date);

CREATE OR REPLACE PROCEDURE public.sp_transfer_money(
	IN p_debit_trans_id integer,
	IN p_credit_trans_id integer,
	IN p_from_account_id integer,
	IN p_to_account_id integer,
	IN p_amount numeric,
	IN p_trans_date date DEFAULT CURRENT_DATE)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    CALL sp_add_transaction(
        p_debit_trans_id,
        p_from_account_id,
        p_trans_date,
        p_amount,
        'D',
        'CIB',
        NULL,
        NULL,
        p_to_account_id
    );

    CALL sp_add_transaction(
        p_credit_trans_id,
        p_to_account_id,
        p_trans_date,
        p_amount,
        'C',
        'CIB',
        NULL,
        NULL,
        p_from_account_id
    );
END;
$BODY$;
ALTER PROCEDURE public.sp_transfer_money(integer, integer, integer, integer, numeric, date)
    OWNER TO postgres;

