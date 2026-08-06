CREATE OR REPLACE FUNCTION public.confirm_assignment_with_version(
  p_assignment_id uuid,
  p_order_id uuid,
  p_employee_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_expected_order_version text
) RETURNS TABLE (
  id uuid,
  order_id uuid,
  employee_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  is_override boolean,
  override_reason text,
  order_version text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE created public.assignments; persisted_version text;
BEGIN
  PERFORM 1 FROM public.orders WHERE public.orders.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA04', CONSTRAINT = 'dispatch_order_not_found'; END IF;
  IF (SELECT to_char(public.orders.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM public.orders WHERE public.orders.id = p_order_id) IS DISTINCT FROM p_expected_order_version THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA09', CONSTRAINT = 'dispatch_stale_version';
  END IF;
  SELECT * INTO created FROM public.confirm_assignment(p_assignment_id, p_order_id, p_employee_id, p_starts_at, p_ends_at);
  UPDATE public.orders SET updated_at = clock_timestamp() WHERE public.orders.id = p_order_id
    RETURNING to_char(public.orders.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') INTO persisted_version;
  RETURN QUERY SELECT created.id, created.order_id, created.employee_id, created.starts_at, created.ends_at, created.status, created.is_override, created.override_reason, persisted_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.override_assignment_with_version(
  p_assignment_id uuid,
  p_order_id uuid,
  p_employee_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text,
  p_expected_order_version text
) RETURNS TABLE (
  id uuid,
  order_id uuid,
  employee_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  is_override boolean,
  override_reason text,
  order_version text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE created public.assignments; persisted_version text;
BEGIN
  PERFORM 1 FROM public.orders WHERE public.orders.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA04', CONSTRAINT = 'dispatch_order_not_found'; END IF;
  IF (SELECT to_char(public.orders.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM public.orders WHERE public.orders.id = p_order_id) IS DISTINCT FROM p_expected_order_version THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA09', CONSTRAINT = 'dispatch_stale_version';
  END IF;
  SELECT * INTO created FROM public.override_assignment(p_assignment_id, p_order_id, p_employee_id, p_starts_at, p_ends_at, p_reason);
  UPDATE public.orders SET updated_at = clock_timestamp() WHERE public.orders.id = p_order_id
    RETURNING to_char(public.orders.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') INTO persisted_version;
  RETURN QUERY SELECT created.id, created.order_id, created.employee_id, created.starts_at, created.ends_at, created.status, created.is_override, created.override_reason, persisted_version;
END;
$$;

ALTER FUNCTION public.confirm_assignment_with_version(uuid, uuid, uuid, timestamptz, timestamptz, text) OWNER TO CURRENT_USER;
ALTER FUNCTION public.override_assignment_with_version(uuid, uuid, uuid, timestamptz, timestamptz, text, text) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.confirm_assignment_with_version(uuid, uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.override_assignment_with_version(uuid, uuid, uuid, timestamptz, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_assignment_with_version(uuid, uuid, uuid, timestamptz, timestamptz, text) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION public.override_assignment_with_version(uuid, uuid, uuid, timestamptz, timestamptz, text, text) TO dispatch_runtime;
