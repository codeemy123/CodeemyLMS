-- ESS Permission / OD & Employee Daily Attendance Migration (Idempotent)

CREATE TABLE IF NOT EXISTS permission_od_requests (
  id                UUID         NOT NULL DEFAULT gen_random_uuid(),
  employee_id       UUID         NOT NULL,
  od_type           VARCHAR(30)  NOT NULL,
  day_type          VARCHAR(30)  NOT NULL DEFAULT 'HOURLY',
  session_type      VARCHAR(30),
  from_date         DATE         NOT NULL,
  to_date           DATE         NOT NULL,
  from_location     VARCHAR(150),
  to_location       VARCHAR(150),
  from_time         VARCHAR(20),
  to_time           VARCHAR(20),
  reason            TEXT         NOT NULL,
  status            VARCHAR(30)  NOT NULL DEFAULT 'PENDING_TL',
  tl_action         VARCHAR(10),
  tl_note           TEXT,
  tl_reviewed_at    TIMESTAMPTZ(6),
  tl_reviewed_by    UUID,
  hr_action         VARCHAR(10),
  hr_note           TEXT,
  hr_reviewed_at    TIMESTAMPTZ(6),
  hr_reviewed_by    UUID,
  admin_action      VARCHAR(10),
  admin_note        TEXT,
  admin_reviewed_at TIMESTAMPTZ(6),
  admin_reviewed_by UUID,
  created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT permission_od_requests_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_perm_employee ON permission_od_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_perm_status   ON permission_od_requests(status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_od_requests_employee_id_fkey') THEN
    ALTER TABLE permission_od_requests ADD CONSTRAINT permission_od_requests_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_od_requests_tl_reviewed_by_fkey') THEN
    ALTER TABLE permission_od_requests ADD CONSTRAINT permission_od_requests_tl_reviewed_by_fkey
      FOREIGN KEY (tl_reviewed_by) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_od_requests_hr_reviewed_by_fkey') THEN
    ALTER TABLE permission_od_requests ADD CONSTRAINT permission_od_requests_hr_reviewed_by_fkey
      FOREIGN KEY (hr_reviewed_by) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_od_requests_admin_reviewed_by_fkey') THEN
    ALTER TABLE permission_od_requests ADD CONSTRAINT permission_od_requests_admin_reviewed_by_fkey
      FOREIGN KEY (admin_reviewed_by) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employee_attendance (
  id                UUID         NOT NULL DEFAULT gen_random_uuid(),
  employee_id       UUID         NOT NULL,
  att_date          DATE         NOT NULL,
  week_off          BOOLEAN      NOT NULL DEFAULT false,
  shift             VARCHAR(50)  NOT NULL DEFAULT 'GENERAL',
  shift_in          VARCHAR(20),
  shift_out         VARCHAR(20),
  request_in        VARCHAR(20),
  request_out       VARCHAR(20),
  att_status        VARCHAR(30)  NOT NULL DEFAULT 'PRESENT',
  reason            TEXT,
  status            VARCHAR(30)  NOT NULL DEFAULT 'PENDING_TL',
  tl_action         VARCHAR(10),
  tl_note           TEXT,
  tl_reviewed_at    TIMESTAMPTZ(6),
  tl_reviewed_by    UUID,
  hr_action         VARCHAR(10),
  hr_note           TEXT,
  hr_reviewed_at    TIMESTAMPTZ(6),
  hr_reviewed_by    UUID,
  admin_action      VARCHAR(10),
  admin_note        TEXT,
  admin_reviewed_at TIMESTAMPTZ(6),
  admin_reviewed_by UUID,
  created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_attendance_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_emp_att_date  ON employee_attendance(employee_id, att_date);
CREATE INDEX        IF NOT EXISTS idx_att_employee ON employee_attendance(employee_id);
CREATE INDEX        IF NOT EXISTS idx_att_date     ON employee_attendance(att_date);
CREATE INDEX        IF NOT EXISTS idx_att_status   ON employee_attendance(status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_attendance_employee_id_fkey') THEN
    ALTER TABLE employee_attendance ADD CONSTRAINT employee_attendance_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_attendance_tl_reviewed_by_fkey') THEN
    ALTER TABLE employee_attendance ADD CONSTRAINT employee_attendance_tl_reviewed_by_fkey
      FOREIGN KEY (tl_reviewed_by) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_attendance_hr_reviewed_by_fkey') THEN
    ALTER TABLE employee_attendance ADD CONSTRAINT employee_attendance_hr_reviewed_by_fkey
      FOREIGN KEY (hr_reviewed_by) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_attendance_admin_reviewed_by_fkey') THEN
    ALTER TABLE employee_attendance ADD CONSTRAINT employee_attendance_admin_reviewed_by_fkey
      FOREIGN KEY (admin_reviewed_by) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.permission_od_requests TO codeemy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.employee_attendance    TO codeemy_app;
