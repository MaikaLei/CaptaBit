PRAGMA defer_foreign_keys=ON;

CREATE TABLE leads_new (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('Locação','Venda','Locação e venda')),
  street TEXT NOT NULL,
  number TEXT NOT NULL DEFAULT '',
  complement TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Nova' CHECK(status IN ('Nova','Em pesquisa','Em contato','Proprietário localizado','Em negociação','Captado','Recusado','Já alugado','Encerrado')),
  version INTEGER NOT NULL DEFAULT 1,
  actor_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, city_key TEXT NOT NULL DEFAULT '', street_key TEXT NOT NULL DEFAULT '', number_key TEXT NOT NULL DEFAULT '', complement_key TEXT NOT NULL DEFAULT '', state_key TEXT NOT NULL DEFAULT '', key_version INTEGER NOT NULL DEFAULT 0, proprietor_name TEXT NOT NULL DEFAULT '', company_id TEXT REFERENCES companies(id));

INSERT INTO leads_new ("id","owner_id","type","purpose","street","number","complement","district","city","state","postal_code","source","source_url","notes","status","version","actor_id","created_at","updated_at","city_key","street_key","number_key","complement_key","state_key","key_version","proprietor_name","company_id") SELECT "id","owner_id","type","purpose","street","number","complement","district","city","state","postal_code","source","source_url","notes","status","version","actor_id","created_at","updated_at","city_key","street_key","number_key","complement_key","state_key","key_version","proprietor_name","company_id" FROM leads;

DROP TABLE leads;

ALTER TABLE leads_new RENAME TO leads;

CREATE INDEX leads_address_lookup ON leads(city_key,street_key);

CREATE INDEX leads_company_address ON leads(company_id,city_key,street_key);

CREATE INDEX leads_company_created ON leads(company_id,created_at,id);

CREATE INDEX leads_company_owner ON leads(company_id,owner_id,updated_at,id);

CREATE INDEX leads_key_version ON leads(key_version);

CREATE INDEX leads_owner_status ON leads(owner_id,status);

CREATE INDEX leads_owner_updated ON leads(owner_id,updated_at,id);

CREATE TRIGGER lead_company_insert BEFORE INSERT ON leads BEGIN
 SELECT RAISE(ABORT,'INVALID_COMPANY_OWNER') WHERE NOT EXISTS(SELECT 1 FROM users WHERE id=new.owner_id AND company_id IS new.company_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=new.actor_id AND company_id IS new.company_id);
 SELECT RAISE(ABORT,'COMPANY_BLOCKED') WHERE new.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies WHERE id=new.company_id AND active=1);
END;

CREATE TRIGGER lead_company_update BEFORE UPDATE ON leads BEGIN
 SELECT RAISE(ABORT,'INVALID_COMPANY_OWNER') WHERE new.company_id IS NOT old.company_id OR NOT EXISTS(SELECT 1 FROM users WHERE id=new.owner_id AND company_id IS new.company_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=new.actor_id AND company_id IS new.company_id);
 SELECT RAISE(ABORT,'COMPANY_BLOCKED') WHERE new.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies WHERE id=new.company_id AND active=1);
END;

CREATE TRIGGER lead_created AFTER INSERT ON leads BEGIN
 INSERT INTO lead_events (lead_id,actor_id,event,after_json,created_at) VALUES (new.id,new.actor_id,'Captação cadastrada',json_object('proprietor_name',new.proprietor_name,'status',new.status,'owner_id',new.owner_id),new.created_at);
END;

CREATE TRIGGER lead_updated AFTER UPDATE ON leads WHEN new.version <> old.version BEGIN
  INSERT INTO lead_events (lead_id,actor_id,event,before_json,after_json,created_at)
  VALUES (new.id,new.actor_id,'Captação atualizada',
    json_object('proprietor_name',old.proprietor_name,'status',old.status,'owner_id',old.owner_id,'type',old.type,'purpose',old.purpose,'street',old.street,'number',old.number,'complement',old.complement,'district',old.district,'city',old.city,'state',old.state,'postal_code',old.postal_code,'source',old.source,'source_url',old.source_url,'notes',old.notes),
    json_object('proprietor_name',new.proprietor_name,'status',new.status,'owner_id',new.owner_id,'type',new.type,'purpose',new.purpose,'street',new.street,'number',new.number,'complement',new.complement,'district',new.district,'city',new.city,'state',new.state,'postal_code',new.postal_code,'source',new.source,'source_url',new.source_url,'notes',new.notes),new.updated_at);
END;

PRAGMA defer_foreign_keys=OFF;
