CREATE TABLE public.zoom_class_links (
  meeting_uuid varchar(255) PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.zoom_recordings (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoom_class_links, public.zoom_recordings TO codeemy_app;
CREATE INDEX zoom_class_links_class_idx ON public.zoom_class_links(class_id);
CREATE INDEX zoom_recordings_queue_idx ON public.zoom_recordings(status, created_at);
