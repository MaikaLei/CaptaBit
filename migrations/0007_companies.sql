CREATE TABLE companies (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 captador_limit INTEGER NOT NULL DEFAULT 3 CHECK(captador_limit BETWEEN 1 AND 1000),
 created_at INTEGER NOT NULL
);
ALTER TABLE users ADD COLUMN company_id TEXT REFERENCES companies(id);
ALTER TABLE users ADD COLUMN access_role TEXT NOT NULL DEFAULT 'LEGACY' CHECK(access_role IN ('MASTER','BROKER','CAPTADOR','LEGACY'));
UPDATE users SET access_role='MASTER' WHERE id=(SELECT id FROM users WHERE role='ADMIN' AND active=1 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1);
UPDATE users SET active=0 WHERE access_role='LEGACY';
DELETE FROM sessions;
CREATE UNIQUE INDEX users_one_master ON users(access_role) WHERE access_role='MASTER';
CREATE UNIQUE INDEX users_one_broker ON users(company_id) WHERE access_role='BROKER' AND deleted_at IS NULL;
CREATE INDEX users_company_active ON users(company_id,access_role,active,deleted_at);
ALTER TABLE leads ADD COLUMN company_id TEXT REFERENCES companies(id);
CREATE INDEX leads_company_owner ON leads(company_id,owner_id,updated_at,id);
CREATE INDEX leads_company_address ON leads(company_id,city_key,street_key);
CREATE INDEX leads_company_created ON leads(company_id,created_at,id);
CREATE TABLE company_events (id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),actor_id TEXT NOT NULL REFERENCES users(id),event TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TRIGGER user_company_insert BEFORE INSERT ON users BEGIN
 SELECT CASE WHEN (new.access_role IN ('BROKER','CAPTADOR') AND new.company_id IS NULL) OR (new.access_role IN ('MASTER','LEGACY') AND new.company_id IS NOT NULL) OR (new.access_role='LEGACY' AND new.active=1) THEN RAISE(ABORT,'INVALID_COMPANY_ROLE') END;
 SELECT CASE WHEN new.access_role='CAPTADOR' AND new.active=1 AND new.deleted_at IS NULL AND (SELECT COUNT(*) FROM users WHERE company_id=new.company_id AND access_role='CAPTADOR' AND active=1 AND deleted_at IS NULL)>=(SELECT captador_limit FROM companies WHERE id=new.company_id) THEN RAISE(ABORT,'CAPTADOR_LIMIT') END;
END;
CREATE TRIGGER user_company_update BEFORE UPDATE ON users BEGIN
 SELECT CASE WHEN new.company_id IS NOT old.company_id OR new.access_role<>old.access_role OR (new.access_role='LEGACY' AND new.active=1) THEN RAISE(ABORT,'IMMUTABLE_COMPANY_ROLE') END;
 SELECT CASE WHEN new.access_role='CAPTADOR' AND new.active=1 AND new.deleted_at IS NULL AND (SELECT COUNT(*) FROM users WHERE company_id=new.company_id AND id<>new.id AND access_role='CAPTADOR' AND active=1 AND deleted_at IS NULL)>=(SELECT captador_limit FROM companies WHERE id=new.company_id) THEN RAISE(ABORT,'CAPTADOR_LIMIT') END;
END;
CREATE TRIGGER lead_company_insert BEFORE INSERT ON leads BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=new.owner_id AND company_id IS new.company_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=new.actor_id AND company_id IS new.company_id) THEN RAISE(ABORT,'INVALID_COMPANY_OWNER') END;
 SELECT CASE WHEN new.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies WHERE id=new.company_id AND active=1) THEN RAISE(ABORT,'COMPANY_BLOCKED') END;
END;
CREATE TRIGGER lead_company_update BEFORE UPDATE ON leads BEGIN
 SELECT CASE WHEN new.company_id IS NOT old.company_id OR NOT EXISTS(SELECT 1 FROM users WHERE id=new.owner_id AND company_id IS new.company_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=new.actor_id AND company_id IS new.company_id) THEN RAISE(ABORT,'INVALID_COMPANY_OWNER') END;
 SELECT CASE WHEN new.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies WHERE id=new.company_id AND active=1) THEN RAISE(ABORT,'COMPANY_BLOCKED') END;
END;
