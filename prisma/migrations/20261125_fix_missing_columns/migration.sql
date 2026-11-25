-- Idempotent fix for missing live-class columns and leave tables.
-- Uses IF NOT EXISTS throughout so it is safe to run on any VPS state.
-- This migration supersedes 202611140001_live_class_details on deployments
-- where that migration was recorded as applied but never executed.

-- ── Live class columns ───────────────────────────────────────────────────────
ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS description    text,
  ADD COLUMN IF NOT EXISTS thumbnail_url  text,
  ADD COLUMN IF NOT EXISTS tags           text[] NOT NULL DEFAULT ARRAY[]::text[];

-- ── Leave management tables ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
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

CREATE UNIQUE INDEX IF NOT EXISTS employees_firebase_uid_key ON employees(firebase_uid);
CREATE UNIQUE INDEX IF NOT EXISTS employees_email_key        ON employees(email);
CREATE INDEX        IF NOT EXISTS idx_employees_role         ON employees(emp_role);
CREATE INDEX        IF NOT EXISTS idx_employees_tl           ON employees(team_leader_id);

-- FK: self-referencing TL (safe to run repeatedly via DO block)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_team_leader_id_fkey'
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_team_leader_id_fkey
      FOREIGN KEY (team_leader_id) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leave_applications (
  id               UUID         NOT NULL DEFAULT gen_random_uuid(),
  employee_id      UUID         NOT NULL,
  leave_type       VARCHAR(30)  NOT NULL,
  from_date        DATE         NOT NULL,
  to_date          DATE         NOT NULL,
  subject          VARCHAR(255) NOT NULL,
  reason           TEXT         NOT NULL,
  document_url     TEXT,
  status           VARCHAR(30)  NOT NULL DEFAULT 'PENDING_TL',
  tl_action        VARCHAR(10),
  tl_note          TEXT,
  tl_reviewed_at   TIMESTAMPTZ(6),
  tl_reviewed_by   UUID,
  hr_action        VARCHAR(10),
  hr_note          TEXT,
  hr_reviewed_at   TIMESTAMPTZ(6),
  hr_reviewed_by   UUID,
  admin_action     VARCHAR(10),
  admin_note       TEXT,
  admin_reviewed_at TIMESTAMPTZ(6),
  admin_reviewed_by UUID,
  created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_applications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status   ON leave_applications(status);
CREATE INDEX IF NOT EXISTS idx_leave_tl       ON leave_applications(tl_reviewed_by);
CREATE INDEX IF NOT EXISTS idx_leave_hr       ON leave_applications(hr_reviewed_by);

-- FK: leave → employee
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_applications_employee_id_fkey') THEN
    ALTER TABLE leave_applications ADD CONSTRAINT leave_applications_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_applications_tl_reviewed_by_fkey') THEN
    ALTER TABLE leave_applications ADD CONSTRAINT leave_applications_tl_reviewed_by_fkey
      FOREIGN KEY (tl_reviewed_by) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_applications_hr_reviewed_by_fkey') THEN
    ALTER TABLE leave_applications ADD CONSTRAINT leave_applications_hr_reviewed_by_fkey
      FOREIGN KEY (hr_reviewed_by) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_applications_admin_reviewed_by_fkey') THEN
    ALTER TABLE leave_applications ADD CONSTRAINT leave_applications_admin_reviewed_by_fkey
      FOREIGN KEY (admin_reviewed_by) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.class_sessions    TO codeemy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.employees          TO codeemy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leave_applications TO codeemy_app;
