-- Create the employee identity table before the ESS migration adds its
-- employee foreign keys. Later Leave migrations add the indexes and relations.
CREATE TABLE IF NOT EXISTS public.employees (
  id             UUID         NOT NULL DEFAULT gen_random_uuid(),
  firebase_uid   VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  full_name      VARCHAR(150) NOT NULL,
  phone          VARCHAR(20),
  emp_role       VARCHAR(20)  NOT NULL DEFAULT 'EMPLOYEE',
  status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  team_leader_id UUID,
  department     VARCHAR(100),
  profile_image  TEXT,
  created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);
