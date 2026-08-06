CREATE TABLE public.owner_login_rate_limits (
  ip inet PRIMARY KEY,
  failed_attempts integer NOT NULL CHECK (failed_attempts BETWEEN 1 AND 5),
  window_started_at timestamptz NOT NULL,
  locked_until timestamptz NULL
);

ALTER TABLE public.owner_login_rate_limits OWNER TO CURRENT_USER;
REVOKE ALL ON TABLE public.owner_login_rate_limits FROM PUBLIC, dispatch_runtime;

CREATE FUNCTION public.owner_login_is_locked(p_ip inet, p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE((SELECT locked_until > p_now FROM public.owner_login_rate_limits WHERE ip = p_ip), false)
$$;

CREATE FUNCTION public.record_owner_login_failure(p_ip inet, p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE current_attempt public.owner_login_rate_limits;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_ip::text));
  SELECT * INTO current_attempt FROM public.owner_login_rate_limits WHERE ip = p_ip FOR UPDATE;

  IF NOT FOUND OR current_attempt.window_started_at <= p_now - interval '15 minutes' THEN
    INSERT INTO public.owner_login_rate_limits (ip, failed_attempts, window_started_at, locked_until)
    VALUES (p_ip, 1, p_now, NULL)
    ON CONFLICT (ip) DO UPDATE SET failed_attempts = 1, window_started_at = EXCLUDED.window_started_at, locked_until = NULL;
    RETURN false;
  END IF;

  IF current_attempt.locked_until > p_now THEN
    RETURN true;
  END IF;

  IF current_attempt.failed_attempts >= 5 THEN
    UPDATE public.owner_login_rate_limits SET locked_until = p_now + interval '15 minutes' WHERE ip = p_ip;
    RETURN true;
  END IF;

  UPDATE public.owner_login_rate_limits SET failed_attempts = failed_attempts + 1 WHERE ip = p_ip;
  RETURN false;
END;
$$;

CREATE FUNCTION public.reset_owner_login_failures(p_ip inet)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
  DELETE FROM public.owner_login_rate_limits WHERE ip = p_ip
$$;

ALTER FUNCTION public.owner_login_is_locked(inet, timestamptz) OWNER TO CURRENT_USER;
ALTER FUNCTION public.record_owner_login_failure(inet, timestamptz) OWNER TO CURRENT_USER;
ALTER FUNCTION public.reset_owner_login_failures(inet) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.owner_login_is_locked(inet, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_owner_login_failure(inet, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_owner_login_failures(inet) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_login_is_locked(inet, timestamptz) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION public.record_owner_login_failure(inet, timestamptz) TO dispatch_runtime;
GRANT EXECUTE ON FUNCTION public.reset_owner_login_failures(inet) TO dispatch_runtime;
