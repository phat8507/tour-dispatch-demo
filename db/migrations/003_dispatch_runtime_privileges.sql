DO $$ BEGIN
  CREATE ROLE dispatch_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT dispatch_runtime TO tour_dispatch_test;
REVOKE ALL ON assignments FROM dispatch_runtime;
GRANT SELECT ON locations, employees, services, employee_service_skills, orders, order_services, assignments TO dispatch_runtime;
REVOKE ALL ON FUNCTION dispatch_confirm_assignment(uuid, uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispatch_override_assignment(uuid, uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispatch_replace_order_assignment(uuid, uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispatch_cancel_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispatch_confirm_assignment(uuid, uuid, uuid, timestamptz, timestamptz) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION dispatch_override_assignment(uuid, uuid, uuid, timestamptz, timestamptz, text) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION dispatch_replace_order_assignment(uuid, uuid, uuid, timestamptz, timestamptz) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION dispatch_cancel_order(uuid) TO dispatch_runtime;
