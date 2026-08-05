CREATE TABLE public.employee_routing_origins (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  label text NULL CHECK (char_length(label) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_routing_origins OWNER TO CURRENT_USER;
REVOKE ALL ON public.employee_routing_origins FROM PUBLIC, dispatch_runtime;

CREATE FUNCTION public.upsert_employee_routing_origin(
  p_employee_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_label text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  employee_active boolean;
  clean_label text;
BEGIN
  SELECT is_active INTO employee_active
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA05', CONSTRAINT = 'dispatch_employee_not_found';
  END IF;

  IF NOT employee_active THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA11', CONSTRAINT = 'dispatch_employee_inactive';
  END IF;

  IF p_latitude < -90 OR p_latitude > 90 OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA14', CONSTRAINT = 'dispatch_invalid_coordinates';
  END IF;

  clean_label := NULLIF(BTRIM(p_label), '');

  INSERT INTO public.employee_routing_origins (employee_id, latitude, longitude, label)
  VALUES (p_employee_id, p_latitude, p_longitude, clean_label)
  ON CONFLICT (employee_id) DO UPDATE
  SET latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      label = EXCLUDED.label,
      updated_at = now();
END;
$$;

ALTER FUNCTION public.upsert_employee_routing_origin(uuid, double precision, double precision, text) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.upsert_employee_routing_origin(uuid, double precision, double precision, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_employee_routing_origin(uuid, double precision, double precision, text) TO dispatch_runtime, tour_dispatch_test;

CREATE FUNCTION public.remove_employee_routing_origin(p_employee_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- We allow removal even if employee is inactive.
  DELETE FROM public.employee_routing_origins WHERE employee_id = p_employee_id;
END;
$$;

ALTER FUNCTION public.remove_employee_routing_origin(uuid) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.remove_employee_routing_origin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_employee_routing_origin(uuid) TO dispatch_runtime, tour_dispatch_test;

CREATE FUNCTION public.list_employee_routing_origins()
RETURNS TABLE (
  employee_id uuid,
  employee_name text,
  is_active boolean,
  latitude double precision,
  longitude double precision,
  label text,
  updated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id, 
    e.name, 
    e.is_active, 
    o.latitude, 
    o.longitude, 
    o.label, 
    o.updated_at
  FROM public.employees e
  LEFT JOIN public.employee_routing_origins o ON o.employee_id = e.id
  ORDER BY e.name ASC, e.id ASC;
END;
$$;

ALTER FUNCTION public.list_employee_routing_origins() OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.list_employee_routing_origins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_employee_routing_origins() TO dispatch_runtime, tour_dispatch_test;
