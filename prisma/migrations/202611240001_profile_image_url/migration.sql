-- Production stores profile image URLs in profile_image_url.  Rename only
-- legacy installations that still use the previous column name; this is
-- metadata-only and preserves every existing value.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_image'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_image_url'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN profile_image TO profile_image_url;
  END IF;
END $$;
