-- Adds presentation metadata for LMS live-class scheduling.
-- This migration is additive: no existing class, batch or recording data is removed.
ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.class_sessions TO codeemy_app;
