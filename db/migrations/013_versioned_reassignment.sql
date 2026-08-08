CREATE OR REPLACE FUNCTION public.replace_order_assignment_with_version(p_old_assignment_id uuid, p_new_assignment_id uuid, p_employee_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_expected_order_version text)
RETURNS TABLE (id uuid, order_id uuid, employee_id uuid, starts_at timestamptz, ends_at timestamptz, status text, is_override boolean, override_reason text, order_version text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE created public.assignments; persisted_version text; old_order_id uuid;
BEGIN
  SELECT a.order_id INTO old_order_id FROM public.assignments a WHERE a.id = p_old_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA06', CONSTRAINT = 'dispatch_assignment_not_found'; END IF;
  PERFORM 1 FROM public.orders o WHERE o.id = old_order_id FOR UPDATE;
  IF (SELECT to_char(o.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM public.orders o WHERE o.id = old_order_id) IS DISTINCT FROM p_expected_order_version THEN RAISE EXCEPTION USING ERRCODE = 'PDA09', CONSTRAINT = 'dispatch_stale_version'; END IF;
  SELECT * INTO created FROM public.replace_order_assignment(p_old_assignment_id, p_new_assignment_id, p_employee_id, p_starts_at, p_ends_at);
  UPDATE public.orders o SET updated_at = clock_timestamp() WHERE o.id = old_order_id RETURNING to_char(o.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') INTO persisted_version;
  RETURN QUERY SELECT created.id, created.order_id, created.employee_id, created.starts_at, created.ends_at, created.status, created.is_override, created.override_reason, persisted_version;
END; $$;

CREATE OR REPLACE FUNCTION public.replace_order_assignment_with_override_and_version(p_old_assignment_id uuid, p_new_assignment_id uuid, p_employee_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_reason text, p_expected_order_version text)
RETURNS TABLE (id uuid, order_id uuid, employee_id uuid, starts_at timestamptz, ends_at timestamptz, status text, is_override boolean, override_reason text, order_version text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE created public.assignments; persisted_version text; old_order_id uuid;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION USING ERRCODE = 'PDA02', CONSTRAINT = 'dispatch_override_reason_required'; END IF;
  SELECT a.order_id INTO old_order_id FROM public.assignments a WHERE a.id = p_old_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA06', CONSTRAINT = 'dispatch_assignment_not_found'; END IF;
  PERFORM 1 FROM public.orders o WHERE o.id = old_order_id FOR UPDATE;
  IF (SELECT to_char(o.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM public.orders o WHERE o.id = old_order_id) IS DISTINCT FROM p_expected_order_version THEN RAISE EXCEPTION USING ERRCODE = 'PDA09', CONSTRAINT = 'dispatch_stale_version'; END IF;
  SELECT * INTO created FROM public.replace_order_assignment(p_old_assignment_id, p_new_assignment_id, p_employee_id, p_starts_at, p_ends_at);
  UPDATE public.assignments a SET is_override = true, override_reason = btrim(p_reason) WHERE a.id = created.id RETURNING a.* INTO created;
  UPDATE public.orders o SET updated_at = clock_timestamp() WHERE o.id = old_order_id RETURNING to_char(o.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') INTO persisted_version;
  RETURN QUERY SELECT created.id, created.order_id, created.employee_id, created.starts_at, created.ends_at, created.status, created.is_override, created.override_reason, persisted_version;
END; $$;
ALTER FUNCTION public.replace_order_assignment_with_version(uuid, uuid, uuid, timestamptz, timestamptz, text) OWNER TO CURRENT_USER;
ALTER FUNCTION public.replace_order_assignment_with_override_and_version(uuid, uuid, uuid, timestamptz, timestamptz, text, text) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.replace_order_assignment_with_version(uuid, uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_order_assignment_with_override_and_version(uuid, uuid, uuid, timestamptz, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_order_assignment_with_version(uuid, uuid, uuid, timestamptz, timestamptz, text) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION public.replace_order_assignment_with_override_and_version(uuid, uuid, uuid, timestamptz, timestamptz, text, text) TO dispatch_runtime;
