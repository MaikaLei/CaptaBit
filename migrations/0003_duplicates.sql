ALTER TABLE leads ADD COLUMN city_key TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN street_key TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN number_key TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN complement_key TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN state_key TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN key_version INTEGER NOT NULL DEFAULT 0;
CREATE INDEX leads_address_lookup ON leads(city_key,street_key);
CREATE INDEX leads_key_version ON leads(key_version);
DROP TRIGGER lead_updated;
CREATE TRIGGER lead_updated AFTER UPDATE ON leads WHEN new.version <> old.version BEGIN
  INSERT INTO lead_events (lead_id,actor_id,event,before_json,after_json,created_at)
  VALUES (new.id,new.actor_id,'Captação atualizada',
    json_object('status',old.status,'owner_id',old.owner_id,'type',old.type,'purpose',old.purpose,'street',old.street,'number',old.number,'complement',old.complement,'district',old.district,'city',old.city,'state',old.state,'postal_code',old.postal_code,'source',old.source,'source_url',old.source_url,'notes',old.notes),
    json_object('status',new.status,'owner_id',new.owner_id,'type',new.type,'purpose',new.purpose,'street',new.street,'number',new.number,'complement',new.complement,'district',new.district,'city',new.city,'state',new.state,'postal_code',new.postal_code,'source',new.source,'source_url',new.source_url,'notes',new.notes),new.updated_at);
END;
