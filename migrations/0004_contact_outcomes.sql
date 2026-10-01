DROP TRIGGER contact_updated;
ALTER TABLE contacts ADD COLUMN outcome TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(outcome IN ('UNKNOWN','CORRECT','INCORRECT','NO_RESPONSE','NO_WHATSAPP'));
ALTER TABLE contacts ADD COLUMN deleted_at INTEGER;
UPDATE contacts SET outcome=CASE status WHEN 'Contato incorreto' THEN 'INCORRECT' WHEN 'Proprietário/Responsável localizado' THEN 'CORRECT' WHEN 'Sem resposta' THEN 'NO_RESPONSE' WHEN 'Não possui WhatsApp' THEN 'NO_WHATSAPP' ELSE 'UNKNOWN' END;
CREATE INDEX contacts_active_lead ON contacts(lead_id,deleted_at);
CREATE TRIGGER contact_updated AFTER UPDATE ON contacts WHEN new.version <> old.version BEGIN
  INSERT INTO lead_events (lead_id,contact_id,actor_id,event,before_json,after_json,created_at)
  VALUES (new.lead_id,new.id,new.actor_id,
    CASE WHEN old.deleted_at IS NULL AND new.deleted_at IS NOT NULL THEN 'Contato excluído' WHEN old.deleted_at IS NOT NULL AND new.deleted_at IS NULL THEN 'Contato restaurado' ELSE 'Contato atualizado' END,
    json_object('name',old.name,'phone',old.phone,'status',old.status,'notes',old.notes,'outcome',old.outcome,'deleted_at',old.deleted_at),
    json_object('name',new.name,'phone',new.phone,'status',new.status,'notes',new.notes,'outcome',new.outcome,'deleted_at',new.deleted_at),new.updated_at);
END;
