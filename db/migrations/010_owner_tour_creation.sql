ALTER TABLE public.locations
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE public.locations
  ADD CONSTRAINT locations_coordinates_complete CHECK (
    (latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  );

CREATE FUNCTION public.create_owner_tour(
  p_order_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_requested_at timestamptz,
  p_order_type text,
  p_service_id uuid,
  p_notes text,
  p_fulfillment text,
  p_branch_id text DEFAULT NULL
) RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  persisted public.orders;
  location_id uuid;
  duration_minutes integer;
  clean_name text := BTRIM(p_customer_name);
  clean_address text := BTRIM(p_customer_address);
BEGIN
  IF clean_name = '' OR NOT (p_order_type IN ('NEW_TOUR', 'MILEAGE')) OR NOT (p_fulfillment IN ('HOME', 'BRANCH')) THEN
    RAISE EXCEPTION USING ERRCODE = 'PDA16', CONSTRAINT = 'owner_tour_invalid_input';
  END IF;

  SELECT default_duration_minutes INTO duration_minutes FROM public.services WHERE id = p_service_id AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA16', CONSTRAINT = 'owner_tour_service_not_found'; END IF;

  IF p_fulfillment = 'BRANCH' THEN
    SELECT id INTO location_id FROM public.locations WHERE location_type = 'BRANCH' AND branch_id = p_branch_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PDA16', CONSTRAINT = 'owner_tour_branch_not_found'; END IF;
  ELSE
    IF clean_address = '' THEN RAISE EXCEPTION USING ERRCODE = 'PDA16', CONSTRAINT = 'owner_tour_address_required'; END IF;
    location_id := gen_random_uuid();
    INSERT INTO public.locations (id, name, address, latitude, longitude, location_type)
    VALUES (location_id, clean_name, clean_address, NULL, NULL, 'CUSTOMER');
  END IF;

  INSERT INTO public.orders (id, customer_name, customer_phone, location_id, requested_at, order_type, urgency, status, notes)
  VALUES (p_order_id, clean_name, NULLIF(BTRIM(p_customer_phone), ''), location_id, p_requested_at, p_order_type, 'PREBOOKED', 'PENDING', COALESCE(p_notes, ''))
  RETURNING * INTO persisted;
  INSERT INTO public.order_services (order_id, service_id, duration_minutes) VALUES (p_order_id, p_service_id, duration_minutes);
  RETURN persisted;
END;
$$;

ALTER FUNCTION public.create_owner_tour(uuid, text, text, text, timestamptz, text, uuid, text, text, text) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.create_owner_tour(uuid, text, text, text, timestamptz, text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_owner_tour(uuid, text, text, text, timestamptz, text, uuid, text, text, text) TO dispatch_runtime;
