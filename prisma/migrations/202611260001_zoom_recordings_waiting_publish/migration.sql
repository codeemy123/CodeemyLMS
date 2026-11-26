-- Align zoom_recordings.status default and CHECK constraint with Prisma schema
-- Non-destructive and idempotent: drops the legacy status CHECK constraint
-- first so existing 'WAITING' rows can be updated to 'WAITING_PUBLISH' without
-- violating the old constraint.
-- Must be executed as the table owner (postgres).

-- 1. Drop any existing CHECK constraint(s) on zoom_recordings.status first.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.zoom_recordings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~* '\mstatus\M'
  LOOP
    EXECUTE format('ALTER TABLE public.zoom_recordings DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

-- 2. Migrate any legacy 'WAITING' rows (safe if 0 rows exist).
UPDATE public.zoom_recordings
SET status = 'WAITING_PUBLISH'
WHERE status = 'WAITING';

-- 3. Set default to 'WAITING_PUBLISH' and add the expected CHECK constraint.
ALTER TABLE public.zoom_recordings
  ALTER COLUMN status SET DEFAULT 'WAITING_PUBLISH';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.zoom_recordings'::regclass
      AND conname = 'zoom_recordings_status_check'
  ) THEN
    ALTER TABLE public.zoom_recordings
      ADD CONSTRAINT zoom_recordings_status_check
      CHECK (status IN ('WAITING_PUBLISH', 'QUEUED', 'PROCESSING', 'READY', 'FAILED'));
  END IF;
END
$$;

-- 4. Ensure runtime application role has DML privileges (no-op if role differs).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'codeemy_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE public.class_sessions, public.zoom_class_links, public.zoom_recordings
      TO codeemy_app;
  END IF;
END
$$;
