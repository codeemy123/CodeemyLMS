-- CodeEmy LMS canonical PostgreSQL schema
-- Generated from prisma/schema.prisma and tracked Prisma migrations.
-- This is a schema-only handoff file. It does not contain production data.
-- PostgreSQL 14+ recommended. Run with a database owner/migration account.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid varchar(255) NOT NULL UNIQUE,
  email varchar(255) NOT NULL UNIQUE,
  full_name varchar(150) NOT NULL,
  phone varchar(20),
  role varchar(20) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  profile_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('ADMIN','MENTOR','STUDENT')),
  CONSTRAINT users_status_check CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED'))
);
CREATE INDEX users_role_idx ON users(role);
CREATE INDEX users_status_idx ON users(status);

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  slug varchar(255) NOT NULL UNIQUE,
  description text,
  thumbnail_url text,
  category varchar(150),
  level varchar(50),
  duration_hours integer NOT NULL DEFAULT 0,
  price numeric(12,2) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  mentor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_status_check CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED'))
);
CREATE INDEX courses_status_idx ON courses(status);

CREATE TABLE batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  description text,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  mentor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT batches_status_check CHECK (status IN ('ACTIVE','COMPLETED','UPCOMING','CANCELLED'))
);
CREATE INDEX batches_mentor_id_idx ON batches(mentor_id);

CREATE TABLE course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_modules_course_id_idx ON course_modules(course_id);

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  content text,
  video_url text,
  resource_url text,
  duration_minutes integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lessons_module_id_idx ON lessons(module_id);

CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT enrollments_student_course_key UNIQUE(student_id, course_id),
  CONSTRAINT enrollments_status_check CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED'))
);
CREATE INDEX enrollments_student_id_idx ON enrollments(student_id);
CREATE INDEX enrollments_course_id_idx ON enrollments(course_id);

CREATE TABLE batch_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT batch_members_batch_student_key UNIQUE(batch_id, student_id)
);

CREATE TABLE mentor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  qualification text,
  specialization text,
  years_of_experience integer NOT NULL DEFAULT 0,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  registration_number varchar(100) UNIQUE,
  qualification text,
  college_name varchar(255),
  department varchar(150),
  admission_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title varchar(255) NOT NULL,
  description text,
  thumbnail_url text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  meeting_url text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_session_student_key UNIQUE(session_id, student_id)
);

CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  title varchar(255) NOT NULL,
  description text,
  total_marks numeric(8,2) NOT NULL DEFAULT 100,
  due_date timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_text text,
  file_url text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  marks numeric(8,2),
  feedback text,
  evaluated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  evaluated_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'SUBMITTED',
  CONSTRAINT assignment_submissions_assignment_student_key UNIQUE(assignment_id, student_id),
  CONSTRAINT assignment_submissions_status_check CHECK (status IN ('SUBMITTED','EVALUATED','LATE'))
);
CREATE INDEX assignment_submissions_student_id_idx ON assignment_submissions(student_id);

CREATE TABLE assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  title varchar(255) NOT NULL,
  description text,
  total_marks numeric(8,2) NOT NULL DEFAULT 0,
  passing_marks numeric(8,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 60,
  start_time timestamptz,
  end_time timestamptz,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessments_status_check CHECK (status IN ('DRAFT','PUBLISHED','CLOSED'))
);
CREATE INDEX assessments_course_id_idx ON assessments(course_id);

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type varchar(30) NOT NULL,
  marks numeric(8,2) NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT questions_type_check CHECK (question_type IN ('MCQ','MULTIPLE_SELECT','TRUE_FALSE','SHORT_ANSWER','LONG_ANSWER'))
);

CREATE TABLE question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  score numeric(8,2),
  status varchar(20) NOT NULL DEFAULT 'IN_PROGRESS',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_attempts_status_check CHECK (status IN ('IN_PROGRESS','SUBMITTED','EVALUATED'))
);
CREATE INDEX assessment_attempts_student_id_idx ON assessment_attempts(student_id);

CREATE TABLE answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text,
  selected_option_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  marks_awarded numeric(8,2),
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT answers_attempt_question_key UNIQUE(attempt_id, question_id)
);

CREATE TABLE lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  last_position_seconds integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_progress_student_lesson_key UNIQUE(student_id, lesson_id)
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  title varchar(255) NOT NULL,
  description text,
  instructions text,
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_url text,
  live_url text,
  description text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  marks numeric(8,2),
  feedback text,
  CONSTRAINT project_submissions_project_student_key UNIQUE(project_id, student_id)
);

CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  file_url text NOT NULL,
  resource_type varchar(50),
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  certificate_number varchar(100) NOT NULL UNIQUE,
  certificate_url text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT certificates_student_course_key UNIQUE(student_id, course_id)
);

CREATE TABLE student_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject varchar(255) NOT NULL,
  message text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_queries_status_check CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED'))
);
CREATE INDEX student_queries_student_id_idx ON student_queries(student_id);

CREATE TABLE query_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES student_queries(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  message text NOT NULL,
  type varchar(50),
  reference_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_id_idx ON notifications(user_id);

CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  message text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  entity_type varchar(100),
  entity_id uuid,
  details jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);

CREATE TABLE career_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status varchar(30) NOT NULL DEFAULT 'APPLIED',
  cover_note text,
  feedback text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_applications_resource_student_key UNIQUE(resource_id, student_id),
  CONSTRAINT career_applications_status_check CHECK (status IN ('APPLIED','REVIEWING','ACCEPTED','REJECTED','WITHDRAWN'))
);
CREATE INDEX career_applications_student_id_idx ON career_applications(student_id);

CREATE TABLE zoom_class_links (
  meeting_uuid varchar(255) PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX zoom_class_links_class_id_idx ON zoom_class_links(class_id);

CREATE TABLE zoom_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_uuid varchar(255) NOT NULL REFERENCES zoom_class_links(meeting_uuid) ON DELETE RESTRICT,
  file_id varchar(255) NOT NULL UNIQUE,
  status varchar(30) NOT NULL DEFAULT 'WAITING',
  object_key text,
  file_size_bytes bigint,
  attempts integer NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zoom_recordings_status_check CHECK (status IN ('WAITING','QUEUED','PROCESSING','READY','FAILED'))
);
CREATE INDEX zoom_recordings_status_created_at_idx ON zoom_recordings(status, created_at);

COMMIT;
