CREATE TABLE public.employee_master_data (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  home_area text NOT NULL,
  dispatch_note text NOT NULL,
  closing_level_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_master_data OWNER TO CURRENT_USER;
REVOKE ALL ON public.employee_master_data FROM PUBLIC, dispatch_runtime;
