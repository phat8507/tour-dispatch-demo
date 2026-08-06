ALTER TABLE locations OWNER TO CURRENT_USER;
ALTER TABLE employees OWNER TO CURRENT_USER;
ALTER TABLE services OWNER TO CURRENT_USER;
ALTER TABLE employee_service_skills OWNER TO CURRENT_USER;
ALTER TABLE orders OWNER TO CURRENT_USER;
ALTER TABLE order_services OWNER TO CURRENT_USER;
ALTER TABLE assignments OWNER TO CURRENT_USER;

ALTER FUNCTION dispatch_check_normal_assignment_overlap() OWNER TO CURRENT_USER;
ALTER FUNCTION dispatch_confirm_assignment(uuid, uuid, uuid, timestamptz, timestamptz) OWNER TO CURRENT_USER;
ALTER FUNCTION dispatch_override_assignment(uuid, uuid, uuid, timestamptz, timestamptz, text) OWNER TO CURRENT_USER;
ALTER FUNCTION dispatch_replace_order_assignment(uuid, uuid, uuid, timestamptz, timestamptz) OWNER TO CURRENT_USER;
ALTER FUNCTION dispatch_cancel_order(uuid) OWNER TO CURRENT_USER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'tour_dispatch_test'
  ) THEN
    EXECUTE 'REVOKE ALL ON TABLE public.assignments FROM tour_dispatch_test';
  END IF;
END
$$;
