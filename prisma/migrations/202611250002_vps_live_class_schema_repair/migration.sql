-- Live Classes VPS schema repair.
-- This migration is additive and idempotent: it does not delete or alter
-- existing class, batch, student, mentor, or recording data.

ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE TABLE IF NOT EXISTS public.zoom_class_links (
  meeting_uuid varchar(255) PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zoom_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_uuid varchar(255) NOT NULL REFERENCES public.zoom_class_links(meeting_uuid) ON DELETE RESTRICT,
  file_id varchar(255) NOT NULL UNIQUE,
  status varchar(30) NOT NULL DEFAULT 'WAITING_PUBLISH'
    CHECK (status IN ('WAITING_PUBLISH', 'QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  object_key text,
  size_bytes bigint,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zoom_class_links_class_idx
  ON public.zoom_class_links(class_id);

CREATE INDEX IF NOT EXISTS zoom_recordings_queue_idx
  ON public.zoom_recordings(status, created_at);

-- Application runtime user permissions.
-- The usual runtime role is `codeemy_app`. Keep this migration portable for
-- a VPS that may use a differently named application role; the deployment
-- team must grant the actual runtime role equivalent access.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'codeemy_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE public.class_sessions, public.zoom_class_links, public.zoom_recordings
      TO codeemy_app;
  END IF;
END
$$;
