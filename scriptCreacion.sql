CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id_user UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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


CREATE TABLE auth_sessions (
  id_session UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  id_user UUID NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  user_agent TEXT NULL,
  expires_at TIMESTAMP NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP NULL,

  CONSTRAINT fk_auth_session_user
    FOREIGN KEY (id_user)
    REFERENCES users(id_user)
    ON DELETE CASCADE
);

CREATE INDEX idx_auth_sessions_user ON auth_sessions(id_user);
CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);


CREATE TABLE audit_logs (
  id_log UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  id_user UUID NULL,
  id_session UUID NULL,

  action VARCHAR(50) NOT NULL,
  result VARCHAR(20) NOT NULL,

  email_attempted VARCHAR(255) NULL,
  failure_reason TEXT NULL,

  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,

  metadata JSONB NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_audit_user
    FOREIGN KEY (id_user)
    REFERENCES users(id_user)
    ON DELETE SET NULL,

  CONSTRAINT fk_audit_session
    FOREIGN KEY (id_session)
    REFERENCES auth_sessions(id_session)
    ON DELETE SET NULL
);

CREATE INDEX idx_audit_user ON audit_logs(id_user);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

CREATE INDEX idx_audit_failed_logins
  ON audit_logs(action, ip_address, created_at)
  WHERE action = 'LOGIN_FAILED';


CREATE TABLE email_verification_tokens (
  id_token UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  id_user UUID NOT NULL,
  token_hash VARCHAR(255) NOT NULL,

  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMP NULL,

  CONSTRAINT fk_email_verify_user
    FOREIGN KEY (id_user)
    REFERENCES users(id_user)
    ON DELETE CASCADE
);

CREATE INDEX idx_email_verify_expires
  ON email_verification_tokens(expires_at);


CREATE TABLE password_reset_tokens (
  id_token UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  id_user UUID NOT NULL,
  token_hash VARCHAR(255) NOT NULL,

  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  used_at TIMESTAMP NULL,

  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (id_user)
    REFERENCES users(id_user)
    ON DELETE CASCADE
);

CREATE INDEX idx_password_reset_expires
  ON password_reset_tokens(expires_at);


CREATE TABLE tutors (
  id_user UUID PRIMARY KEY,

  phone VARCHAR(20) NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  limit_disponibility SMALLINT NULL,
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  url_image TEXT NULL,

  CONSTRAINT fk_tutor_user
    FOREIGN KEY (id_user)
    REFERENCES users(id_user)
    ON DELETE CASCADE
);


CREATE TABLE subject (
  id_subject UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE
);


CREATE TABLE tutor_impart_subject (
  id_tutor UUID NOT NULL,
  id_subject UUID NOT NULL,

  PRIMARY KEY (id_tutor, id_subject),

  CONSTRAINT fk_tutor_subject_tutor
    FOREIGN KEY (id_tutor)
    REFERENCES tutors(id_user)
    ON DELETE CASCADE,

  CONSTRAINT fk_tutor_subject_subject
    FOREIGN KEY (id_subject)
    REFERENCES subject(id_subject)
    ON DELETE CASCADE
);

