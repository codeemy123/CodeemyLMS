ALTER TABLE public.student_profiles ADD COLUMN college_name varchar(255);
CREATE TABLE public.career_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status varchar(30) NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED','REVIEWING','ACCEPTED','REJECTED','WITHDRAWN')),
  cover_note text,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_applications_resource_id_student_id_key UNIQUE(resource_id, student_id)
);
CREATE INDEX career_applications_student_idx ON public.career_applications(student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_applications TO codeemy_app;
