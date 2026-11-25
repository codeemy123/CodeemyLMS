-- CodeEmy LMS Live Classes VPS schema check (READ ONLY)
-- Safe to run in PostgreSQL. It does not change schema or data.

SELECT current_database() AS database_name, current_user AS connected_as;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'class_sessions',
    'zoom_class_links',
    'zoom_recordings',
    'batch_members',
    'notifications'
  )
ORDER BY table_name;

SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (
      table_name = 'class_sessions'
      AND column_name IN (
        'id', 'batch_id', 'mentor_id', 'title', 'description',
        'thumbnail_url', 'tags', 'start_at', 'end_at', 'meeting_url', 'created_at'
      )
    )
    OR table_name IN ('zoom_class_links', 'zoom_recordings')
  )
ORDER BY table_name, ordinal_position;

SELECT to_regclass('public._prisma_migrations') AS prisma_migration_history_table;

-- If the previous query returns public._prisma_migrations, run this query separately:
-- SELECT migration_name, finished_at, rolled_back_at
-- FROM public._prisma_migrations
-- ORDER BY finished_at NULLS LAST, migration_name;
