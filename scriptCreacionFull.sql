CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla users
CREATE TABLE users (
  id_user UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT','TUTOR','ADMIN')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE','PENDING','BLOCKED')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  email_verified_at TIMESTAMP NULL,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP NULL,
  password_changed_at TIMESTAMP NULL
);

-- Tabla students
CREATE TYPE students_preferred_modality_enum AS ENUM ('PRES', 'VIRT');
CREATE TABLE students (
  id_user UUID PRIMARY KEY,
  career VARCHAR(100),
  preferred_modality students_preferred_modality_enum,
  CONSTRAINT fk_student_user FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE NO ACTION
);

-- Tabla tutors
CREATE TABLE tutors (
  id_user UUID PRIMARY KEY,
  phone VARCHAR(20) NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  limit_disponibility SMALLINT NULL,
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  url_image TEXT NULL,
  CONSTRAINT fk_tutor_user FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE CASCADE
);

-- Tabla subject
CREATE TABLE subject (
  id_subject UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Tabla tutor_impart_subject
CREATE TABLE tutor_impart_subject (
  id_tutor UUID NOT NULL,
  id_subject UUID NOT NULL,
  PRIMARY KEY (id_tutor, id_subject),
  CONSTRAINT fk_tutor_subject_tutor FOREIGN KEY (id_tutor) REFERENCES tutors(id_user) ON DELETE CASCADE,
  CONSTRAINT fk_tutor_subject_subject FOREIGN KEY (id_subject) REFERENCES subject(id_subject) ON DELETE CASCADE
);

-- Tabla student_interested_subject
CREATE TABLE student_interested_subject (
  id_student UUID NOT NULL,
  id_subject UUID NOT NULL,
  PRIMARY KEY (id_student, id_subject),
  CONSTRAINT fk_student_subject_student FOREIGN KEY (id_student) REFERENCES students(id_user) ON DELETE NO ACTION,
  CONSTRAINT fk_student_subject_subject FOREIGN KEY (id_subject) REFERENCES subject(id_subject) ON DELETE NO ACTION
);

-- Tabla auth_sessions
CREATE TABLE auth_sessions (
  id_session UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  refresh_token_hash VARCHAR(255) NOT NULL,
  user_agent TEXT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP NULL,
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
  id_user UUID,
  CONSTRAINT fk_auth_session_user FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE CASCADE
);

-- Tabla password_reset_tokens
CREATE TABLE password_reset_tokens (
  id_token UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_user UUID NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  used_at TIMESTAMP NULL,
  CONSTRAINT fk_password_reset_user FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE CASCADE
);

-- Tabla email_verification_tokens
CREATE TABLE email_verification_tokens (
  id_token UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_user UUID NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMP NULL,
  CONSTRAINT fk_email_verify_user FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE CASCADE
);

-- Tabla audit_logs
CREATE TYPE audit_logs_action_enum AS ENUM ('LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'ACCOUNT_CREATED', 'EMAIL_VERIFIED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'SESSION_CREATED', 'SESSION_REFRESHED', 'SESSION_REVOKED', 'SESSION_EXPIRED');
CREATE TYPE audit_logs_result_enum AS ENUM ('SUCCESS', 'FAILED');
CREATE TABLE audit_logs (
  id_log UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_user UUID NULL,
  id_session UUID NULL,
  action audit_logs_action_enum NOT NULL,
  result audit_logs_result_enum NOT NULL,
  email_attempted VARCHAR(255) NULL,
  failure_reason TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_audit_user FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE SET NULL,
  CONSTRAINT fk_audit_session FOREIGN KEY (id_session) REFERENCES auth_sessions(id_session) ON DELETE SET NULL
);

-- Tabla sessions
CREATE TYPE sessions_type_enum AS ENUM ('INDIVIDUAL', 'GROUP');
CREATE TYPE sessions_modality_enum AS ENUM ('PRES', 'VIRT');
CREATE TYPE sessions_status_enum AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TABLE sessions (
  id_session UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_tutor UUID NOT NULL,
  id_subject UUID NOT NULL,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type sessions_type_enum,
  modality sessions_modality_enum,
  status sessions_status_enum,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sessions_tutor FOREIGN KEY (id_tutor) REFERENCES tutors(id_user) ON DELETE NO ACTION,
  CONSTRAINT fk_sessions_subject FOREIGN KEY (id_subject) REFERENCES subject(id_subject) ON DELETE NO ACTION
);

-- Tabla scheduled_sessions
CREATE TABLE scheduled_sessions (
  id_tutor UUID NOT NULL,
  id_availability UUID NOT NULL,
  id_session UUID,
  PRIMARY KEY (id_tutor, id_availability),
  CONSTRAINT fk_scheduled_sessions_tutor FOREIGN KEY (id_tutor) REFERENCES tutors(id_user) ON DELETE NO ACTION,
  CONSTRAINT fk_scheduled_sessions_availability FOREIGN KEY (id_availability) REFERENCES availability(id_availability) ON DELETE NO ACTION,
  CONSTRAINT fk_scheduled_sessions_session FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE NO ACTION
);

-- Tabla availability
CREATE TABLE availability (
  id_availability UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week SMALLINT NOT NULL,
  start_time TIME NOT NULL
);

-- Tabla tutor_have_availability
CREATE TYPE tutor_have_availability_modality_enum AS ENUM ('PRES', 'VIRT');
CREATE TABLE tutor_have_availability (
  id_tutor UUID NOT NULL,
  id_availability UUID NOT NULL,
  modality tutor_have_availability_modality_enum,
  PRIMARY KEY (id_tutor, id_availability),
  CONSTRAINT fk_tutor_have_availability_tutor FOREIGN KEY (id_tutor) REFERENCES tutors(id_user) ON DELETE NO ACTION,
  CONSTRAINT fk_tutor_have_availability_availability FOREIGN KEY (id_availability) REFERENCES availability(id_availability) ON DELETE NO ACTION
);

-- Tabla questions
CREATE TABLE questions (
  id_question UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL
);

-- Tabla answers
CREATE TABLE answers (
  id_question UUID NOT NULL,
  id_student UUID NOT NULL,
  id_session UUID NOT NULL,
  score SMALLINT,
  PRIMARY KEY (id_question, id_student, id_session),
  CONSTRAINT fk_answers_question FOREIGN KEY (id_question) REFERENCES questions(id_question) ON DELETE NO ACTION,
  CONSTRAINT fk_answers_student_session FOREIGN KEY (id_student, id_session) REFERENCES student_participate_session(id_student, id_session) ON DELETE NO ACTION
);

-- Tabla student_participate_session
CREATE TYPE student_participate_session_status_enum AS ENUM ('REGISTERED', 'ATTENDED', 'ABSENT', 'CANCELLED');
CREATE TABLE student_participate_session (
  id_student UUID NOT NULL,
  id_session UUID NOT NULL,
  status student_participate_session_status_enum,
  comment TEXT,
  PRIMARY KEY (id_student, id_session),
  CONSTRAINT fk_student_participate_session_student FOREIGN KEY (id_student) REFERENCES students(id_user) ON DELETE NO ACTION,
  CONSTRAINT fk_student_participate_session_session FOREIGN KEY (id_session) REFERENCES sessions(id_session) ON DELETE NO ACTION
);
