CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE locations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  address text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location_type text NOT NULL CHECK (location_type IN ('BRANCH', 'CUSTOMER')),
  branch_id text NULL CHECK (branch_id IN ('CS1', 'CS2')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT locations_branch_requires_branch_id CHECK (
    (location_type = 'BRANCH' AND branch_id IN ('CS1', 'CS2')) OR location_type = 'CUSTOMER'
  )
);

CREATE TABLE employees (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  home_branch_id text NOT NULL CHECK (home_branch_id IN ('CS1', 'CS2')),
  closing_level text NOT NULL CHECK (closing_level IN ('STRONG', 'NORMAL', 'WEAK')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE services (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  default_duration_minutes integer NOT NULL CHECK (default_duration_minutes > 0),
  refill_duration_minutes integer NOT NULL CHECK (refill_duration_minutes > 0),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE employee_service_skills (
  employee_id uuid NOT NULL REFERENCES employees(id),
  service_id uuid NOT NULL REFERENCES services(id),
  technical_level text NOT NULL CHECK (technical_level IN ('STRONG', 'NORMAL', 'WEAK')),
  PRIMARY KEY (employee_id, service_id)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  customer_name text NOT NULL,
  customer_phone text NULL,
  location_id uuid NOT NULL REFERENCES locations(id),
  requested_at timestamptz NOT NULL,
  order_type text NOT NULL CHECK (order_type IN ('NEW_TOUR', 'REFILL', 'MILEAGE')),
  urgency text NOT NULL CHECK (urgency IN ('PREBOOKED', 'IMMEDIATE')),
  status text NOT NULL CHECK (status IN ('PENDING', 'ASSIGNED', 'COMPLETED', 'CANCELLED')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_services (
  order_id uuid NOT NULL REFERENCES orders(id),
  service_id uuid NOT NULL REFERENCES services(id),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  PRIMARY KEY (order_id, service_id)
);

CREATE TABLE assignments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED')),
  is_override boolean NOT NULL DEFAULT false,
  override_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignments_valid_interval CHECK (starts_at < ends_at),
  CONSTRAINT assignments_order_employee_unique UNIQUE (order_id, employee_id),
  CONSTRAINT assignments_override_reason_policy CHECK (
    (NOT is_override AND override_reason IS NULL) OR
    (is_override AND btrim(override_reason) <> '')
  )
);

CREATE INDEX assignments_order_id_idx ON assignments(order_id);
CREATE INDEX assignments_employee_id_idx ON assignments(employee_id);

ALTER TABLE assignments ADD CONSTRAINT assignments_active_normal_exclusion
  EXCLUDE USING gist (
    employee_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('SCHEDULED', 'IN_PROGRESS', 'DELAYED') AND NOT is_override);
