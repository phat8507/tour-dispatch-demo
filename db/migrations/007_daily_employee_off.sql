CREATE TABLE public.employee_daily_off (
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  off_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, off_date)
);

CREATE INDEX employee_daily_off_date_idx ON public.employee_daily_off(off_date);

CREATE FUNCTION public.dispatch_check_daily_off_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE employee_active boolean;
BEGIN
  SELECT is_active INTO employee_active
  FROM public.employees
  WHERE id = NEW.employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA05', CONSTRAINT = 'dispatch_employee_not_found';
  END IF;
  IF NOT employee_active THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA11', CONSTRAINT = 'dispatch_employee_inactive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('employee_daily_off:' || NEW.off_date::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.employee_daily_off
    WHERE employee_id = NEW.employee_id AND off_date = NEW.off_date
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.assignments assignment
    WHERE assignment.employee_id = NEW.employee_id
      AND assignment.status IN ('SCHEDULED', 'IN_PROGRESS', 'DELAYED')
      AND tstzrange(assignment.starts_at, assignment.ends_at, '[)') &&
          tstzrange(
            NEW.off_date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',
            (NEW.off_date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',
            '[)'
          )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA12', CONSTRAINT = 'dispatch_employee_has_active_assignments';
  END IF;

  IF (SELECT count(*) FROM public.employee_daily_off WHERE off_date = NEW.off_date) >= 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA13', CONSTRAINT = 'dispatch_daily_off_limit_reached';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER dispatch_daily_off_insert_trigger
BEFORE INSERT ON public.employee_daily_off
FOR EACH ROW EXECUTE FUNCTION public.dispatch_check_daily_off_insert();

CREATE FUNCTION public.dispatch_check_assignment_employee_off()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('SCHEDULED', 'IN_PROGRESS', 'DELAYED') THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.employees WHERE id = NEW.employee_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.employee_daily_off daily_off
    WHERE daily_off.employee_id = NEW.employee_id
      AND tstzrange(
            daily_off.off_date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',
            (daily_off.off_date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',
            '[)'
          ) && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA10', CONSTRAINT = 'dispatch_employee_off';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER dispatch_assignments_employee_off_trigger
BEFORE INSERT OR UPDATE OF employee_id, starts_at, ends_at, status ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.dispatch_check_assignment_employee_off();

CREATE FUNCTION public.mark_employee_off(p_employee_id uuid, p_off_date date)
RETURNS public.employee_daily_off
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE persisted public.employee_daily_off;
BEGIN
  INSERT INTO public.employee_daily_off (employee_id, off_date)
  VALUES (p_employee_id, p_off_date)
  ON CONFLICT (employee_id, off_date) DO UPDATE
    SET updated_at = public.employee_daily_off.updated_at
  RETURNING * INTO persisted;
  RETURN persisted;
END;
$$;

CREATE FUNCTION public.unmark_employee_off(p_employee_id uuid, p_off_date date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM 1 FROM public.employees WHERE id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA05', CONSTRAINT = 'dispatch_employee_not_found';
  END IF;
  DELETE FROM public.employee_daily_off
  WHERE employee_id = p_employee_id AND off_date = p_off_date;
END;
$$;

ALTER TABLE public.employee_daily_off OWNER TO CURRENT_USER;
ALTER FUNCTION public.dispatch_check_daily_off_insert() OWNER TO CURRENT_USER;
ALTER FUNCTION public.dispatch_check_assignment_employee_off() OWNER TO CURRENT_USER;
ALTER FUNCTION public.mark_employee_off(uuid, date) OWNER TO CURRENT_USER;
ALTER FUNCTION public.unmark_employee_off(uuid, date) OWNER TO CURRENT_USER;

REVOKE ALL ON public.employee_daily_off FROM PUBLIC, dispatch_runtime;
GRANT SELECT ON public.employee_daily_off TO dispatch_runtime;

REVOKE ALL ON FUNCTION public.dispatch_check_daily_off_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_check_assignment_employee_off() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_employee_off(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unmark_employee_off(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_employee_off(uuid, date) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION public.unmark_employee_off(uuid, date) TO dispatch_runtime;
