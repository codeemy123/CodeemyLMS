-- Leave Management System Migration
-- Creates employees and leave_applications tables

CREATE TABLE IF NOT EXISTS "employees" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "firebase_uid" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "full_name" VARCHAR(150) NOT NULL,
  "phone" VARCHAR(20),
  "emp_role" VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE',
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "team_leader_id" UUID,
  "department" VARCHAR(100),
  "profile_image" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employees_firebase_uid_key" ON "employees"("firebase_uid");
CREATE UNIQUE INDEX IF NOT EXISTS "employees_email_key" ON "employees"("email");
CREATE INDEX IF NOT EXISTS "idx_employees_role" ON "employees"("emp_role");
CREATE INDEX IF NOT EXISTS "idx_employees_tl" ON "employees"("team_leader_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employees'::regclass
      AND conname = 'employees_team_leader_id_fkey'
  ) THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_team_leader_id_fkey
      FOREIGN KEY (team_leader_id) REFERENCES public.employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "leave_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" UUID NOT NULL,
  "leave_type" VARCHAR(30) NOT NULL,
  "from_date" DATE NOT NULL,
  "to_date" DATE NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "reason" TEXT NOT NULL,
  "document_url" TEXT,
  "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_TL',
  "tl_action" VARCHAR(10),
  "tl_note" TEXT,
  "tl_reviewed_at" TIMESTAMPTZ(6),
  "tl_reviewed_by" UUID,
  "hr_action" VARCHAR(10),
  "hr_note" TEXT,
  "hr_reviewed_at" TIMESTAMPTZ(6),
  "hr_reviewed_by" UUID,
  "admin_action" VARCHAR(10),
  "admin_note" TEXT,
  "admin_reviewed_at" TIMESTAMPTZ(6),
  "admin_reviewed_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_leave_employee" ON "leave_applications"("employee_id");
CREATE INDEX IF NOT EXISTS "idx_leave_status" ON "leave_applications"("status");
CREATE INDEX IF NOT EXISTS "idx_leave_tl" ON "leave_applications"("tl_reviewed_by");
CREATE INDEX IF NOT EXISTS "idx_leave_hr" ON "leave_applications"("hr_reviewed_by");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.leave_applications'::regclass
      AND conname = 'leave_applications_employee_id_fkey'
  ) THEN
    ALTER TABLE public.leave_applications ADD CONSTRAINT leave_applications_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.leave_applications'::regclass
      AND conname = 'leave_applications_tl_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.leave_applications ADD CONSTRAINT leave_applications_tl_reviewed_by_fkey
      FOREIGN KEY (tl_reviewed_by) REFERENCES public.employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.leave_applications'::regclass
      AND conname = 'leave_applications_hr_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.leave_applications ADD CONSTRAINT leave_applications_hr_reviewed_by_fkey
      FOREIGN KEY (hr_reviewed_by) REFERENCES public.employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.leave_applications'::regclass
      AND conname = 'leave_applications_admin_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.leave_applications ADD CONSTRAINT leave_applications_admin_reviewed_by_fkey
      FOREIGN KEY (admin_reviewed_by) REFERENCES public.employees(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
