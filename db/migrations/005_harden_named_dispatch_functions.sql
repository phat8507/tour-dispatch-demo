ALTER FUNCTION public.dispatch_confirm_assignment(uuid, uuid, uuid, timestamptz, timestamptz) RENAME TO confirm_assignment;
ALTER FUNCTION public.dispatch_override_assignment(uuid, uuid, uuid, timestamptz, timestamptz, text) RENAME TO override_assignment;
ALTER FUNCTION public.dispatch_replace_order_assignment(uuid, uuid, uuid, timestamptz, timestamptz) RENAME TO replace_order_assignment;
ALTER FUNCTION public.dispatch_cancel_order(uuid) RENAME TO cancel_order;

CREATE OR REPLACE FUNCTION public.dispatch_check_normal_assignment_overlap()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.is_override OR NEW.status NOT IN ('SCHEDULED', 'IN_PROGRESS', 'DELAYED') THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.employees WHERE id = NEW.employee_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.assignments existing
    WHERE existing.employee_id = NEW.employee_id AND existing.id IS DISTINCT FROM NEW.id
      AND existing.status IN ('SCHEDULED', 'IN_PROGRESS', 'DELAYED')
      AND tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN RAISE EXCEPTION USING ERRCODE = '23P01', CONSTRAINT = 'dispatch_assignments_normal_overlap', MESSAGE = 'normal assignment overlaps an active assignment'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_assignment(p_assignment_id uuid, p_order_id uuid, p_employee_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
RETURNS public.assignments LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE created public.assignments;
BEGIN
  IF p_starts_at >= p_ends_at THEN RAISE EXCEPTION USING ERRCODE = 'PDA03', CONSTRAINT = 'dispatch_invalid_interval'; END IF;
  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA04', CONSTRAINT = 'dispatch_order_not_found'; END IF;
  PERFORM 1 FROM public.employees WHERE id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA05', CONSTRAINT = 'dispatch_employee_not_found'; END IF;
  INSERT INTO public.assignments (id, order_id, employee_id, starts_at, ends_at, status) VALUES (p_assignment_id, p_order_id, p_employee_id, p_starts_at, p_ends_at, 'SCHEDULED') RETURNING * INTO created;
  UPDATE public.orders SET status = 'ASSIGNED', updated_at = now() WHERE id = p_order_id AND status = 'PENDING';
  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.override_assignment(p_assignment_id uuid, p_order_id uuid, p_employee_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_reason text)
RETURNS public.assignments LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE created public.assignments;
BEGIN
  IF p_starts_at >= p_ends_at THEN RAISE EXCEPTION USING ERRCODE = 'PDA03', CONSTRAINT = 'dispatch_invalid_interval'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION USING ERRCODE = 'PDA02', CONSTRAINT = 'dispatch_override_reason_required'; END IF;
  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA04', CONSTRAINT = 'dispatch_order_not_found'; END IF;
  PERFORM 1 FROM public.employees WHERE id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA05', CONSTRAINT = 'dispatch_employee_not_found'; END IF;
  INSERT INTO public.assignments (id, order_id, employee_id, starts_at, ends_at, status, is_override, override_reason) VALUES (p_assignment_id, p_order_id, p_employee_id, p_starts_at, p_ends_at, 'SCHEDULED', true, btrim(p_reason)) RETURNING * INTO created;
  UPDATE public.orders SET status = 'ASSIGNED', updated_at = now() WHERE id = p_order_id AND status = 'PENDING';
  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_order_assignment(p_old_assignment_id uuid, p_new_assignment_id uuid, p_employee_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
RETURNS public.assignments LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE old_assignment public.assignments; created public.assignments;
BEGIN
  SELECT * INTO old_assignment FROM public.assignments WHERE id = p_old_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA06', CONSTRAINT = 'dispatch_assignment_not_found'; END IF;
  IF old_assignment.status = 'IN_PROGRESS' THEN RAISE EXCEPTION USING ERRCODE = 'PDA07', CONSTRAINT = 'dispatch_assignment_already_started'; END IF;
  IF old_assignment.status NOT IN ('SCHEDULED', 'DELAYED') THEN RAISE EXCEPTION USING ERRCODE = 'PDA08', CONSTRAINT = 'dispatch_assignment_invalid_state'; END IF;
  IF p_starts_at >= p_ends_at THEN RAISE EXCEPTION USING ERRCODE = 'PDA03', CONSTRAINT = 'dispatch_invalid_interval'; END IF;
  PERFORM 1 FROM public.employees WHERE id IN (old_assignment.employee_id, p_employee_id) ORDER BY id FOR UPDATE;
  UPDATE public.assignments SET status = 'CANCELLED', updated_at = now() WHERE id = p_old_assignment_id;
  INSERT INTO public.assignments (id, order_id, employee_id, starts_at, ends_at, status) VALUES (p_new_assignment_id, old_assignment.order_id, p_employee_id, p_starts_at, p_ends_at, 'SCHEDULED') RETURNING * INTO created;
  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA04', CONSTRAINT = 'dispatch_order_not_found'; END IF;
  UPDATE public.orders SET status = 'CANCELLED', updated_at = now() WHERE id = p_order_id;
  UPDATE public.assignments SET status = 'CANCELLED', updated_at = now() WHERE order_id = p_order_id AND status IN ('SCHEDULED', 'IN_PROGRESS', 'DELAYED');
END;
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM dispatch_runtime;
GRANT USAGE ON SCHEMA public TO dispatch_runtime;
REVOKE ALL ON FUNCTION public.dispatch_check_normal_assignment_overlap() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_assignment(uuid, uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.override_assignment(uuid, uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_order_assignment(uuid, uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_assignment(uuid, uuid, uuid, timestamptz, timestamptz) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION public.override_assignment(uuid, uuid, uuid, timestamptz, timestamptz, text) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION public.replace_order_assignment(uuid, uuid, uuid, timestamptz, timestamptz) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO dispatch_runtime;
