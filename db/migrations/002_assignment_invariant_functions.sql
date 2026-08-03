CREATE FUNCTION dispatch_check_normal_assignment_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_override OR NEW.status NOT IN ('SCHEDULED', 'IN_PROGRESS', 'DELAYED') THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM employees WHERE id = NEW.employee_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM assignments existing
    WHERE existing.employee_id = NEW.employee_id
      AND existing.id IS DISTINCT FROM NEW.id
      AND existing.status IN ('SCHEDULED', 'IN_PROGRESS', 'DELAYED')
      AND tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      CONSTRAINT = 'dispatch_assignments_normal_overlap',
      MESSAGE = 'normal assignment overlaps an active assignment';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dispatch_assignments_normal_overlap_trigger
BEFORE INSERT OR UPDATE OF employee_id, starts_at, ends_at, status, is_override ON assignments
FOR EACH ROW EXECUTE FUNCTION dispatch_check_normal_assignment_overlap();

CREATE FUNCTION dispatch_confirm_assignment(
  p_assignment_id uuid, p_order_id uuid, p_employee_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
) RETURNS assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE created assignments;
BEGIN
  IF p_starts_at >= p_ends_at THEN RAISE EXCEPTION USING ERRCODE = 'PDA03', CONSTRAINT = 'dispatch_invalid_interval'; END IF;
  PERFORM 1 FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA04', CONSTRAINT = 'dispatch_order_not_found'; END IF;
  PERFORM 1 FROM employees WHERE id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA05', CONSTRAINT = 'dispatch_employee_not_found'; END IF;
  INSERT INTO assignments (id, order_id, employee_id, starts_at, ends_at, status)
  VALUES (p_assignment_id, p_order_id, p_employee_id, p_starts_at, p_ends_at, 'SCHEDULED') RETURNING * INTO created;
  UPDATE orders SET status = 'ASSIGNED', updated_at = now() WHERE id = p_order_id AND status = 'PENDING';
  RETURN created;
END;
$$;

CREATE FUNCTION dispatch_override_assignment(
  p_assignment_id uuid, p_order_id uuid, p_employee_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_reason text
) RETURNS assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE created assignments;
BEGIN
  IF p_starts_at >= p_ends_at THEN RAISE EXCEPTION USING ERRCODE = 'PDA03', CONSTRAINT = 'dispatch_invalid_interval'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION USING ERRCODE = 'PDA02', CONSTRAINT = 'dispatch_override_reason_required'; END IF;
  PERFORM 1 FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA04', CONSTRAINT = 'dispatch_order_not_found'; END IF;
  PERFORM 1 FROM employees WHERE id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA05', CONSTRAINT = 'dispatch_employee_not_found'; END IF;
  INSERT INTO assignments (id, order_id, employee_id, starts_at, ends_at, status, is_override, override_reason)
  VALUES (p_assignment_id, p_order_id, p_employee_id, p_starts_at, p_ends_at, 'SCHEDULED', true, btrim(p_reason)) RETURNING * INTO created;
  UPDATE orders SET status = 'ASSIGNED', updated_at = now() WHERE id = p_order_id AND status = 'PENDING';
  RETURN created;
END;
$$;

CREATE FUNCTION dispatch_replace_order_assignment(
  p_old_assignment_id uuid, p_new_assignment_id uuid, p_employee_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
) RETURNS assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE old_assignment assignments; created assignments;
BEGIN
  SELECT * INTO old_assignment FROM assignments WHERE id = p_old_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA06', CONSTRAINT = 'dispatch_assignment_not_found'; END IF;
  IF old_assignment.status = 'IN_PROGRESS' THEN RAISE EXCEPTION USING ERRCODE = 'PDA07', CONSTRAINT = 'dispatch_assignment_already_started'; END IF;
  IF old_assignment.status NOT IN ('SCHEDULED', 'DELAYED') THEN RAISE EXCEPTION USING ERRCODE = 'PDA08', CONSTRAINT = 'dispatch_assignment_invalid_state'; END IF;
  IF p_starts_at >= p_ends_at THEN RAISE EXCEPTION USING ERRCODE = 'PDA03', CONSTRAINT = 'dispatch_invalid_interval'; END IF;
  PERFORM 1 FROM employees WHERE id IN (old_assignment.employee_id, p_employee_id) ORDER BY id FOR UPDATE;
  UPDATE assignments SET status = 'CANCELLED', updated_at = now() WHERE id = p_old_assignment_id;
  INSERT INTO assignments (id, order_id, employee_id, starts_at, ends_at, status)
  VALUES (p_new_assignment_id, old_assignment.order_id, p_employee_id, p_starts_at, p_ends_at, 'SCHEDULED') RETURNING * INTO created;
  RETURN created;
END;
$$;

CREATE FUNCTION dispatch_cancel_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1 FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA04', CONSTRAINT = 'dispatch_order_not_found'; END IF;
  UPDATE orders SET status = 'CANCELLED', updated_at = now() WHERE id = p_order_id;
  UPDATE assignments SET status = 'CANCELLED', updated_at = now()
  WHERE order_id = p_order_id AND status IN ('SCHEDULED', 'IN_PROGRESS', 'DELAYED');
END;
$$;
