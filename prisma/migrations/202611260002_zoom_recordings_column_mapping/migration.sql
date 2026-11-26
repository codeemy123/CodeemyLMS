-- Align legacy recording columns with the names mapped by Prisma.
-- Renaming preserves every existing value; ambiguous schemas fail closed.
DO $$
DECLARE
  has_size_bytes boolean;
  has_file_size_bytes boolean;
  has_lease_until boolean;
  has_lease_expires_at boolean;
BEGIN
  IF to_regclass('public.zoom_recordings') IS NULL THEN
    RAISE EXCEPTION 'Required table public.zoom_recordings is missing';
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'zoom_recordings' AND column_name = 'size_bytes'
    ),
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'zoom_recordings' AND column_name = 'file_size_bytes'
    ),
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'zoom_recordings' AND column_name = 'lease_until'
    ),
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'zoom_recordings' AND column_name = 'lease_expires_at'
    )
  INTO has_size_bytes, has_file_size_bytes, has_lease_until, has_lease_expires_at;

  IF has_size_bytes AND has_file_size_bytes THEN
    RAISE EXCEPTION 'Both size_bytes and file_size_bytes exist; manual data reconciliation is required';
  ELSIF has_size_bytes THEN
    ALTER TABLE public.zoom_recordings RENAME COLUMN size_bytes TO file_size_bytes;
  ELSIF NOT has_file_size_bytes THEN
    RAISE EXCEPTION 'Neither size_bytes nor file_size_bytes exists on zoom_recordings';
  END IF;

  IF has_lease_until AND has_lease_expires_at THEN
    RAISE EXCEPTION 'Both lease_until and lease_expires_at exist; manual data reconciliation is required';
  ELSIF has_lease_until THEN
    ALTER TABLE public.zoom_recordings RENAME COLUMN lease_until TO lease_expires_at;
  ELSIF NOT has_lease_expires_at THEN
    RAISE EXCEPTION 'Neither lease_until nor lease_expires_at exists on zoom_recordings';
  END IF;
END
$$;
