-- Align legacy live-class timestamp columns with the names mapped by Prisma.
-- Renaming preserves values and refuses to choose between duplicate columns.
DO $$
DECLARE
  has_start_at boolean;
  has_start_time boolean;
  has_end_at boolean;
  has_end_time boolean;
BEGIN
  IF to_regclass('public.class_sessions') IS NULL THEN
    RAISE EXCEPTION 'Cannot map live-class timestamps: public.class_sessions is missing.';
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'class_sessions' AND column_name = 'start_at'
    ),
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'class_sessions' AND column_name = 'start_time'
    ),
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'class_sessions' AND column_name = 'end_at'
    ),
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'class_sessions' AND column_name = 'end_time'
    )
  INTO has_start_at, has_start_time, has_end_at, has_end_time;

  IF has_start_at = has_start_time THEN
    RAISE EXCEPTION 'Cannot map live-class start time: expected exactly one of start_at or start_time.';
  END IF;
  IF has_end_at = has_end_time THEN
    RAISE EXCEPTION 'Cannot map live-class end time: expected exactly one of end_at or end_time.';
  END IF;

  IF has_start_at THEN
    ALTER TABLE public.class_sessions RENAME COLUMN start_at TO start_time;
  END IF;
  IF has_end_at THEN
    ALTER TABLE public.class_sessions RENAME COLUMN end_at TO end_time;
  END IF;
END $$;
