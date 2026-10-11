CREATE TABLE company_profiles (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES companies(id),
 previous_id TEXT REFERENCES company_profiles(id),
 creci TEXT NOT NULL,
 fees_text TEXT NOT NULL,
 contact_email TEXT NOT NULL,
 logo TEXT NOT NULL DEFAULT '',
 fees_image TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX profile_successor ON company_profiles(company_id,COALESCE(previous_id,''));
CREATE INDEX profiles_company ON company_profiles(company_id,created_at);
CREATE TABLE owner_forms (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES companies(id),
 lead_id TEXT NOT NULL REFERENCES leads(id),
 profile_id TEXT NOT NULL REFERENCES company_profiles(id),
 token_hash TEXT NOT NULL UNIQUE,
 company_name TEXT NOT NULL,
 purpose TEXT NOT NULL,
 declaration TEXT NOT NULL,
 privacy_text TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER,
 submitted_at INTEGER,
 response_json TEXT,
 accepted INTEGER CHECK(accepted IN (0,1)),
 reviewed_at INTEGER,
 reviewed_by TEXT REFERENCES users(id),
 CHECK((submitted_at IS NULL AND response_json IS NULL AND accepted IS NULL) OR (submitted_at IS NOT NULL AND response_json IS NOT NULL AND accepted IS NOT NULL))
);
CREATE INDEX owner_forms_lead ON owner_forms(company_id,lead_id,created_at);
CREATE TRIGGER owner_form_immutable BEFORE UPDATE ON owner_forms BEGIN
 SELECT RAISE(ABORT,'IMMUTABLE_FORM') WHERE new.company_id<>old.company_id OR new.lead_id<>old.lead_id OR new.profile_id<>old.profile_id OR new.token_hash<>old.token_hash OR new.company_name<>old.company_name OR new.purpose<>old.purpose OR new.declaration<>old.declaration OR new.privacy_text<>old.privacy_text OR new.created_at<>old.created_at OR new.created_by<>old.created_by OR new.expires_at<>old.expires_at;
 SELECT RAISE(ABORT,'IMMUTABLE_RESPONSE') WHERE old.submitted_at IS NOT NULL AND (new.submitted_at IS NOT old.submitted_at OR new.response_json IS NOT old.response_json OR new.accepted IS NOT old.accepted);
END;
CREATE TRIGGER profile_immutable BEFORE UPDATE ON company_profiles BEGIN
 SELECT RAISE(ABORT,'IMMUTABLE_PROFILE');
END;
