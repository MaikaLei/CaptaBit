import { leadStatuses, text, invalid } from '../domain/leads.js';
import { contactOutcomes } from '../domain/contact-outcomes.js';

function dateBoundary(value, end = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('Data inválida.');
  const utc = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0,10) !== value) invalid('Data inválida.');
  // Report dates use the business timezone, America/Sao_Paulo (UTC-03).
  return utc + 3 * 3600000 + (end ? 86400000 : 0);
}
export function csvCell(value) {
  let cell = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = "'" + cell;
  return '"' + cell.replaceAll('"','""') + '"';
}
const localDate = value => new Date(value - 3 * 3600000).toISOString().slice(0,19).replace('T',' ');
export async function reportRoutes(request, db, user, { json, fail }) {
  const url = new URL(request.url);
  if (!['/api/reports/captacoes','/api/reports/captacoes.csv'].includes(url.pathname)) return null;
  if (request.method !== 'GET') return json({error:'Método não permitido.'},405);
  const p = url.searchParams;
  const where = []; const args = [];
  if (user.role !== 'ADMIN') { where.push('l.owner_id=?'); args.push(user.id); }
  const owner = text(p.get('owner_id') || '',200);
  if (owner) {
    if (user.role !== 'ADMIN' && owner !== user.id) fail('Acesso não permitido.',403);
    where.push('l.owner_id=?'); args.push(owner);
  }
  for (const [key,columns] of [['proprietor',['l.proprietor_name']],['property',['l.street','l.number','l.complement','l.district','l.city','l.type']]]) {
    const value = text(p.get(key) || '',200);
    if (!value) continue;
    const term = '%' + value.replace(/[\\%_]/g, c => '\\'+c) + '%';
    where.push('(' + columns.map(c => `${c} LIKE ? ESCAPE '\\'`).join(' OR ') + ')');
    args.push(...columns.map(() => term));
  }
  const status = p.get('status') || '';
  if (status) { if (!leadStatuses.includes(status)) invalid('Andamento inválido.'); where.push('l.status=?'); args.push(status); }
  const outcome = p.get('outcome') || '';
  if (outcome) {
    if (!contactOutcomes.some(c => c.id === outcome)) invalid('Resultado do contato inválido.');
    where.push('EXISTS(SELECT 1 FROM contacts x WHERE x.lead_id=l.id AND x.deleted_at IS NULL AND x.outcome=?)'); args.push(outcome);
  }
  const from = dateBoundary(p.get('from')); const to = dateBoundary(p.get('to'),true);
  if (from !== null && to !== null && from >= to) invalid('A data final deve ser igual ou posterior à inicial.');
  if (from !== null) { where.push('l.created_at>=?'); args.push(from); }
  if (to !== null) { where.push('l.created_at<?'); args.push(to); }
  const clause = where.length ? where.join(' AND ') : '1=1';
  const outcomes = contactOutcomes.map(c => c.id);
  const counts = outcomes.map(id => `COALESCE(SUM(c.outcome='${id}'),0) AS ${id}`).join(',');
  const rowsQuery = `SELECT l.id,l.proprietor_name,l.type,l.purpose,l.street,l.number,l.complement,l.district,l.city,l.state,l.status,l.version,l.created_at,l.updated_at,u.name AS captador,COUNT(c.id) AS contacts_count,${counts} FROM leads l JOIN users u ON u.id=l.owner_id LEFT JOIN contacts c ON c.lead_id=l.id AND c.deleted_at IS NULL WHERE ${clause} GROUP BY l.id ORDER BY l.created_at DESC,l.id`;
  if (url.pathname.endsWith('.csv')) {
    const {results} = await db.prepare(rowsQuery + ' LIMIT 10001').bind(...args).all();
    if (results.length > 10000) fail('A exportação aceita até 10.000 captações. Reduza o período ou refine os filtros.',413);
    const headers = ['Proprietário','Tipo','Finalidade','Logradouro','Número','Complemento','Bairro','Cidade','UF','Captador','Andamento','Cadastro (Brasília)','Atualização (Brasília)','Telefones ativos',...contactOutcomes.map(c=>c.name)];
    const lines = [headers,...results.map(r => [r.proprietor_name,r.type,r.purpose,r.street,r.number,r.complement,r.district,r.city,r.state,r.captador,r.status,localDate(r.created_at),localDate(r.updated_at),r.contacts_count,...outcomes.map(id=>r[id])])];
    return new Response('\uFEFF'+lines.map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="captabit-captacoes.csv"','Cache-Control':'no-store'}});
  }
  const page = Number(p.get('page') || 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) invalid('Página inválida.');
  const [total,summary,stages,rows] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total FROM leads l WHERE ${clause}`).bind(...args),
    db.prepare(`SELECT COUNT(c.id) AS contacts_count,${counts} FROM leads l LEFT JOIN contacts c ON c.lead_id=l.id AND c.deleted_at IS NULL WHERE ${clause}`).bind(...args),
    db.prepare(`SELECT l.status,COUNT(*) AS total FROM leads l WHERE ${clause} GROUP BY l.status`).bind(...args),
    db.prepare(rowsQuery+' LIMIT 20 OFFSET ?').bind(...args,page*20)
  ]);
  return json({total:total.results[0].total,summary:summary.results[0],stages:stages.results,rows:rows.results,page,pageSize:20});
}
