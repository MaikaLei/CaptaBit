CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('Locação','Venda')),
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
);
CREATE INDEX leads_owner_updated ON leads(owner_id,updated_at,id);
CREATE INDEX leads_owner_status ON leads(owner_id,status);
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Não contatado' CHECK(status IN ('Não contatado','Mensagem enviada','Aguardando resposta','Contato incorreto','Proprietário/Responsável localizado','Sem resposta','Não possui WhatsApp')),
  notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  actor_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(lead_id,phone)
);
CREATE INDEX contacts_phone ON contacts(phone);
CREATE TABLE lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  contact_id TEXT REFERENCES contacts(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  event TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX events_lead_id ON lead_events(lead_id,id);
CREATE TRIGGER lead_created AFTER INSERT ON leads BEGIN
  INSERT INTO lead_events (lead_id,actor_id,event,after_json,created_at)
  VALUES (new.id,new.actor_id,'Captação cadastrada',json_object('status',new.status,'owner_id',new.owner_id),new.created_at);
END;
CREATE TRIGGER lead_updated AFTER UPDATE ON leads BEGIN
  INSERT INTO lead_events (lead_id,actor_id,event,before_json,after_json,created_at)
  VALUES (new.id,new.actor_id,'Captação atualizada',
    json_object('status',old.status,'owner_id',old.owner_id,'type',old.type,'purpose',old.purpose,'street',old.street,'number',old.number,'complement',old.complement,'district',old.district,'city',old.city,'state',old.state,'postal_code',old.postal_code,'source',old.source,'source_url',old.source_url,'notes',old.notes),
    json_object('status',new.status,'owner_id',new.owner_id,'type',new.type,'purpose',new.purpose,'street',new.street,'number',new.number,'complement',new.complement,'district',new.district,'city',new.city,'state',new.state,'postal_code',new.postal_code,'source',new.source,'source_url',new.source_url,'notes',new.notes),new.updated_at);
END;
CREATE TRIGGER contact_created AFTER INSERT ON contacts BEGIN
  INSERT INTO lead_events (lead_id,contact_id,actor_id,event,after_json,created_at)
  VALUES (new.lead_id,new.id,new.actor_id,'Contato adicionado',json_object('name',new.name,'phone',new.phone,'status',new.status),new.created_at);
END;
CREATE TRIGGER contact_updated AFTER UPDATE ON contacts BEGIN
  INSERT INTO lead_events (lead_id,contact_id,actor_id,event,before_json,after_json,created_at)
  VALUES (new.lead_id,new.id,new.actor_id,'Contato atualizado',json_object('name',old.name,'phone',old.phone,'status',old.status,'notes',old.notes),json_object('name',new.name,'phone',new.phone,'status',new.status,'notes',new.notes),new.updated_at);
END;
