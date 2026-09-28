import { contactOutcomes,outcomeFromStatus } from '../domain/contact-outcomes.js';
import { addressKeys,keyFields } from '../domain/duplicates.js';
import { duplicates } from './duplicates.js';
import { whatsappUrl,whatsappMessage } from '../domain/whatsapp.js';
import { leadStatuses, contactStatuses, propertyTypes, terminalStatuses, leadFields, leadInput, phone, text, invalid } from '../domain/leads.js';
export async function leadRoutes(request, db, user, { json, fail, bodyOf }) {
  const url = new URL(request.url); const path = url.pathname; const method = request.method;
  if (path === '/api/lead-options' && method === 'GET') return json({ leadStatuses, contactStatuses, propertyTypes,contactOutcomes });
  if (!path.startsWith('/api/leads')) return null;
  const scope = user.role === 'ADMIN' ? '1=1' : 'owner_id = ?';
  const scopeArgs = user.role === 'ADMIN' ? [] : [user.id];
  const getLead = async id => {
    const lead = await db.prepare(`SELECT * FROM leads WHERE id = ? AND ${scope}`).bind(id, ...scopeArgs).first();
    if (!lead) fail('Captação não encontrada.', 404);
    return lead;
  };
  const conflict = () => fail('Este registro foi atualizado. Reabra a captação antes de salvar novamente.', 409);
  if (path === '/api/leads/duplicates' && method === 'POST') {
    const body=await bodyOf(request); const fields=leadInput(body);
    if(!Array.isArray(body.phones ?? []) || (body.phones ?? []).length>10) invalid('Inclua no máximo dez telefones.');
    const now=Date.now();
    const limit=await db.prepare('INSERT INTO login_limits (key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts').bind('duplicates:'+user.id,now+900000,now,now).first();
    if(limit.attempts>60) fail('Limite de verificações atingido. Aguarde 15 minutos.',429);
    return json({duplicates:await duplicates(db,fields,(body.phones ?? []).map(phone))});
  }
  if (path === '/api/leads' && method === 'GET') {
    const q = text(url.searchParams.get('q') || '', 100); const status = url.searchParams.get('status') || '';
    if (status && !leadStatuses.includes(status)) invalid('Status inválido.');
    const rawPage = Number(url.searchParams.get('page') || 0);
    if (!Number.isSafeInteger(rawPage) || rawPage < 0 || rawPage > 10000) invalid('Página inválida.');
    const term = `%${q.replace(/[\\%_]/g, x => '\\' + x)}%`;
    const query = `SELECT l.*, u.name AS owner_name, (SELECT COUNT(*) FROM contacts c WHERE c.lead_id=l.id AND c.deleted_at IS NULL) AS contacts_count FROM leads l JOIN users u ON u.id=l.owner_id WHERE ${scope} AND (?='' OR l.status=?) AND (?='' OR l.street LIKE ? ESCAPE '\\' OR l.city LIKE ? ESCAPE '\\' OR l.district LIKE ? ESCAPE '\\' OR l.proprietor_name LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM contacts c WHERE c.lead_id=l.id AND c.deleted_at IS NULL AND c.phone LIKE ? ESCAPE '\\')) ORDER BY l.updated_at DESC,l.id LIMIT 21 OFFSET ?`;
    const { results } = await db.prepare(query).bind(...scopeArgs, status, status, q, term, term, term, term, term, rawPage * 20).all();
    return json({ leads: results.slice(0,20), hasMore: results.length > 20, page: rawPage });
  }
  if (path === '/api/leads' && method === 'POST') {
    const body = await bodyOf(request); const fields = leadInput(body);
    if (body.owner_id !== undefined || body.status !== undefined) invalid('Responsável e status inicial são definidos pelo sistema.');
    const phones = body.phones ?? [];
    if (!Array.isArray(phones) || phones.length > 10) invalid('Inclua no máximo dez telefones por cadastro.');
    const numbers = [...new Set(phones.map(phone))]; const id = crypto.randomUUID(); const now = Date.now();
    const keys=addressKeys(fields);
    await db.batch([
      db.prepare(`INSERT INTO leads (id,owner_id,${leadFields.join(',')},${keyFields.join(',')},key_version,actor_id,created_at,updated_at) VALUES (${Array(leadFields.length + keyFields.length + 6).fill('?').join(',')})`).bind(id,user.id,...leadFields.map(key => fields[key]),...keyFields.map(key=>keys[key]),1,user.id,now,now),
      ...numbers.map(number => db.prepare('INSERT INTO contacts (id,lead_id,phone,actor_id,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),id,number,user.id,now,now))
    ]);
    return json({ lead: await getLead(id), duplicates: await duplicates(db,fields,numbers,id) }, 201);
  }
  const match = path.match(/^\/api\/leads\/([^/]+)(?:\/(contacts|history|whatsapp)(?:\/([^/]+))?)?$/);
  if (!match) return json({ error: 'Não encontrado.' },404);
  const [,id,resource,childId] = match; const lead = await getLead(id);
  if (!resource && method === 'GET') {
    const { results: contacts } = await db.prepare('SELECT * FROM contacts WHERE lead_id=? AND deleted_at IS NULL ORDER BY created_at,id LIMIT 200').bind(id).all();
    return json({ lead, contacts, duplicates: await duplicates(db,lead,contacts.map(contact=>contact.phone),id), messageTemplate:whatsappMessage(lead,user) });
  }
  if (resource === 'whatsapp' && childId && method === 'POST') {
    const body=await bodyOf(request); if(body.templateId && body.templateId!=='initial') invalid('Modelo de mensagem inválido.'); const message=whatsappMessage(lead,user);

    const contact=await db.prepare('SELECT * FROM contacts WHERE id=? AND lead_id=? AND deleted_at IS NULL').bind(childId,id).first();
    if(!contact) fail('Contato não encontrado.',404);
    if(contact.version!==body.version) conflict();
    if(['INCORRECT','NO_WHATSAPP'].includes(contact.outcome)) fail('Atualize a classificação do contato antes de abrir o WhatsApp.',409);
    const alerts=await duplicates(db,lead,[contact.phone],id);
    if((alerts.items.length || alerts.truncated) && body.acknowledge!==true) return json({reviewRequired:true,duplicates:alerts});
    const event=await db.prepare(`INSERT INTO lead_events (lead_id,contact_id,actor_id,event,after_json,created_at) SELECT ?,?,?,'Abertura do WhatsApp solicitada','{}',? WHERE EXISTS(SELECT 1 FROM leads WHERE id=? AND ${scope}) AND EXISTS(SELECT 1 FROM contacts WHERE id=? AND lead_id=? AND deleted_at IS NULL AND version=?) RETURNING id`).bind(id,childId,user.id,Date.now(),id,...scopeArgs,childId,id,body.version).first();
    if(!event) conflict();
    return json({url:whatsappUrl(contact.phone,message),duplicates:alerts});
  }
  if (resource === 'history' && !childId && method === 'GET') {
    const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(before) || before < 1) invalid('Cursor inválido.');
    const { results } = await db.prepare('SELECT e.*, u.name AS actor_name FROM lead_events e JOIN users u ON u.id=e.actor_id WHERE e.lead_id=? AND e.id<? ORDER BY e.id DESC LIMIT 51').bind(id,before).all();
    const events = results.slice(0,50).map(event => ({ ...event, before: event.before_json ? JSON.parse(event.before_json) : null, after: JSON.parse(event.after_json), before_json: undefined, after_json: undefined }));
    return json({ events, next: results.length > 50 ? events.at(-1).id : null });
  }
  if (!resource && method === 'PATCH') {
    const body = await bodyOf(request);
    if (!Number.isSafeInteger(body.version)) invalid('Versão inválida.');
    const allowed = [...leadFields,'status','version','owner_id'];
    if (Object.keys(body).some(key => !allowed.includes(key))) invalid('Campo não permitido.');
    const fields = leadFields.some(key => Object.hasOwn(body,key)) ? leadInput({ ...lead, ...body }) : Object.fromEntries(leadFields.map(key=>[key,lead[key]])); const status = body.status ?? lead.status;
    if (!leadStatuses.includes(status)) invalid('Status inválido.');
    if (user.role !== 'ADMIN' && (body.owner_id !== undefined || (terminalStatuses.includes(lead.status) && status !== lead.status) || status === 'Encerrado')) fail('Transferência, encerramento e reabertura exigem ADMIN.',403);
    const owner = body.owner_id ?? lead.owner_id;
    if (owner !== lead.owner_id && !await db.prepare('SELECT id FROM users WHERE id=? AND active=1').bind(owner).first()) invalid('Escolha um responsável ativo.');
    const keys=addressKeys(fields);
    const result = await db.prepare(`UPDATE leads SET ${leadFields.map(key => `${key}=?`).join(',')}, ${keyFields.map(key=>`${key}=?`).join(',')},key_version=1,status=?,owner_id=?,actor_id=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND ${scope} RETURNING id`).bind(...leadFields.map(key => fields[key]),...keyFields.map(key=>keys[key]),status,owner,user.id,Date.now(),id,body.version,...scopeArgs).first();
    if (!result) conflict();
    return json({ ok: true });
  }
  if(resource==='contacts' && childId && method==='DELETE') {
    const body=await bodyOf(request);
    if(!Number.isSafeInteger(body.version)) invalid('Versão inválida.');
    const current=await db.prepare('SELECT id FROM contacts WHERE id=? AND lead_id=? AND deleted_at IS NULL').bind(childId,id).first();
    if(!current) fail('Contato não encontrado.',404);
    const now=Date.now();
    const result=await db.prepare(`UPDATE contacts SET deleted_at=?,actor_id=?,updated_at=?,version=version+1 WHERE id=? AND lead_id=? AND version=? AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM leads WHERE id=? AND ${scope}) RETURNING id`).bind(now,user.id,now,childId,id,body.version,id,...scopeArgs).first();
    if(!result) conflict();
    return json({ok:true});
  }
  if (resource === 'contacts' && !childId && method === 'POST') {
    const body = await bodyOf(request); const number = phone(body.phone); const name = text(body.name); const notes = text(body.notes,2000);
    const contactId = crypto.randomUUID(); const now = Date.now();
    const archived=await db.prepare('SELECT id FROM contacts WHERE lead_id=? AND phone=? AND deleted_at IS NOT NULL').bind(id,number).first();
    if(archived) {
      const restored=await db.prepare(`UPDATE contacts SET deleted_at=NULL,name=?,notes=?,outcome='UNKNOWN',status='Não contatado',actor_id=?,updated_at=?,version=version+1 WHERE id=? AND deleted_at IS NOT NULL AND EXISTS(SELECT 1 FROM leads WHERE id=? AND ${scope}) AND (SELECT COUNT(*) FROM contacts WHERE lead_id=? AND deleted_at IS NULL)<200 RETURNING id`).bind(name,notes,user.id,now,archived.id,id,...scopeArgs,id).first();
      if(!restored) conflict();
      return json({id:restored.id},201);
    }
    try {
      const result = await db.prepare(`INSERT INTO contacts (id,lead_id,name,phone,notes,actor_id,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM leads WHERE id=? AND ${scope}) AND (SELECT COUNT(*) FROM contacts WHERE lead_id=? AND deleted_at IS NULL)<200 RETURNING id`).bind(contactId,id,name,number,notes,user.id,now,now,id,...scopeArgs,id).first();
      if (!result) fail('Acesso alterado ou limite de 200 contatos atingido.',409);
    } catch (error) { if (String(error).includes('UNIQUE')) fail('Esse telefone já está nesta captação.',409); throw error; }
    return json({ id: contactId },201);
  }
  if (resource === 'contacts' && childId && method === 'PATCH') {
    const body = await bodyOf(request);
    if (Object.keys(body).some(key => !['name','phone','notes','status','version','outcome'].includes(key))) invalid('Campo não permitido.');
    if (!Number.isSafeInteger(body.version)) invalid('Versão inválida.');
    const contact = await db.prepare('SELECT * FROM contacts WHERE id=? AND lead_id=? AND deleted_at IS NULL').bind(childId,id).first();
    if (!contact) fail('Contato não encontrado.',404);
    const status = body.status ?? contact.status;
    const outcome=body.outcome ?? (body.status ? outcomeFromStatus(body.status) : undefined) ?? contact.outcome;
    if(!contactOutcomes.some(item=>item.id===outcome)) invalid('Classificação inválida.');
    if (!contactStatuses.includes(status)) invalid('Status inválido.');
    try {
      const result = await db.prepare(`UPDATE contacts SET name=?,phone=?,notes=?,status=?,outcome=?,actor_id=?,updated_at=?,version=version+1 WHERE id=? AND lead_id=? AND deleted_at IS NULL AND version=? AND EXISTS(SELECT 1 FROM leads WHERE id=? AND ${scope}) RETURNING id`).bind(text(body.name ?? contact.name),phone(body.phone ?? contact.phone),text(body.notes ?? contact.notes,2000),status,outcome,user.id,Date.now(),childId,id,body.version,id,...scopeArgs).first();
      if (!result) conflict();
    } catch (error) { if (String(error).includes('UNIQUE')) fail('Esse telefone já está nesta captação.',409); throw error; }
    return json({ ok: true });
  }
  return json({ error: 'Não encontrado.' },404);
}


