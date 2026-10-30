-- Append-only audit trail of who did what, per tenant.
--
-- Append-only is enforced in the database, not by convention:
--   * the app role has INSERT and SELECT only, and
--   * a trigger rejects UPDATE/DELETE for everyone, including the table owner.

CREATE TABLE audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES organizations(id),
  actor_id    uuid REFERENCES users(id),
  action      text NOT NULL,
  entity_type text,
  entity_id   text,
  ip          text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_created_idx ON audit_log (org_id, created_at DESC);

CREATE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END
$$;
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_log
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM ergocheck_app;
GRANT SELECT, INSERT ON audit_log TO ergocheck_app;
