-- Core tenancy schema: organizations, users, sessions, assessments.
--
-- Tenant isolation is enforced twice:
--   1. Every tenant-scoped query in the API filters by org_id explicitly.
--   2. Row-level security on tenant data tables, evaluated against the
--      per-transaction setting app.org_id, so a missing WHERE clause in
--      application code still cannot leak another org's rows.
--
-- The API runs tenant queries under the restricted role ergocheck_app
-- (SET LOCAL ROLE), so RLS applies even when the connection user owns the
-- tables or is a superuser (as in local Docker / CI).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ergocheck_app') THEN
    CREATE ROLE ergocheck_app NOLOGIN;
  END IF;
END
$$;
GRANT ergocheck_app TO CURRENT_USER;

CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE user_role AS ENUM ('member', 'org_admin');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  email         text NOT NULL,
  display_name  text NOT NULL,
  password_hash text NOT NULL,
  role          user_role NOT NULL DEFAULT 'member',
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Target for composite FKs so child rows can't point at a user in another org.
  UNIQUE (id, org_id)
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TABLE sessions (
  -- SHA-256 of the opaque cookie token; the raw token is never stored.
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE assessments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  user_id     uuid NOT NULL,
  answers     jsonb NOT NULL,
  area_scores jsonb NOT NULL,
  total_score integer NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  risk_level  text NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, org_id) REFERENCES users(id, org_id)
);
CREATE INDEX assessments_org_created_idx ON assessments (org_id, created_at DESC);
CREATE INDEX assessments_user_created_idx ON assessments (user_id, created_at DESC);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON assessments
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

GRANT USAGE ON SCHEMA public TO ergocheck_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ergocheck_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ergocheck_app;
