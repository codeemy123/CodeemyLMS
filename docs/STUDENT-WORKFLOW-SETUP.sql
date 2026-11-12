-- Run once in Cloud SQL Studio, database codeemy_lms, as postgres/table owner.
-- Adds missing workflow tables only. Existing users/courses are preserved.
BEGIN;
CREATE TABLE IF NOT EXISTS public.career_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status varchar(30) NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED','REVIEWING','ACCEPTED','REJECTED','WITHDRAWN')),
  cover_note text,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_applications_resource_id_student_id_key UNIQUE(resource_id,student_id)
);
CREATE INDEX IF NOT EXISTS career_applications_student_idx ON public.career_applications(student_id);
CREATE TABLE IF NOT EXISTS public.zoom_class_links (
  meeting_uuid varchar(255) PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.zoom_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_uuid varchar(255) NOT NULL REFERENCES public.zoom_class_links(meeting_uuid) ON DELETE RESTRICT,
  file_id varchar(255) NOT NULL UNIQUE,
  status varchar(30) NOT NULL DEFAULT 'WAITING_PUBLISH' CHECK (status IN ('WAITING_PUBLISH','QUEUED','PROCESSING','READY','FAILED')),
  object_key text,
  size_bytes bigint,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zoom_class_links_class_idx ON public.zoom_class_links(class_id);
CREATE INDEX IF NOT EXISTS zoom_recordings_queue_idx ON public.zoom_recordings(status,created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_applications, public.zoom_class_links, public.zoom_recordings TO codeemy_app;
COMMIT;
SELECT 'Workflow tables ready' AS result;
