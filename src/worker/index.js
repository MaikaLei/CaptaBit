import { companyRoutes } from './companies.js';
import { reportRoutes } from './reports.js';
import { leadRoutes } from './leads.js';
import { hashPassword, verifyPassword, validPassword, passwordOptions, dummyPasswordHash } from '../domain/password.js';
const cookieName = 'captabit_session';
const lifetime = 8 * 60 * 60 * 1000;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.access_role || user.role, company_id:user.company_id, company_name:user.company_name, company_slug:user.company_slug, active: Boolean(user.active), deleted: Boolean(user.deleted_at) });
function tokenFrom(request) {
  return (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
}
function cookie(request, value, maxAge) {
  return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
async function bodyOf(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail('Formato inválido.', 415);
  const reader = request.body?.getReader();
  if (!reader) fail('Dados inválidos.', 400);
  let size = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); fail('Dados muito grandes.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const result = JSON.parse(new TextDecoder().decode(bytes)); if (!result || Array.isArray(result) || typeof result !== 'object') throw new Error(); return result; }
  catch { fail('Dados inválidos.', 400); }
}
async function userOf(request, db) {
  const token = tokenFrom(request);
  if (!/^[a-f0-9]{64}$/.test(token)) fail('Entre para continuar.', 401);
  const user = await db.prepare(`SELECT u.*,c.name AS company_name,c.slug AS company_slug FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN companies c ON c.id=u.company_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND u.deleted_at IS NULL AND (u.access_role='MASTER' OR (u.access_role IN ('BROKER','CAPTADOR') AND c.active=1))`).bind(await digest(token), Date.now()).first();
  if (!user) fail('Entre para continuar.', 401);
  user.role=user.access_role;
  return user;
}
async function rateLimit(db, email, ip) {
  const now = Date.now(); const windowMs = 15 * 60 * 1000;
  const keys = [await digest(`email:${email}`), await digest(`ip:${ip}`)];
  const results = await db.batch(keys.map(key => db.prepare('INSERT INTO login_limits (key, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN reset_at <= ? THEN 1 ELSE attempts + 1 END, reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END RETURNING attempts').bind(key, now + windowMs, now, now)));
  if (results[0].results[0].attempts > 8 || results[1].results[0].attempts > 40) fail('Muitas tentativas. Aguarde 15 minutos.', 429);
}
async function route(request, env) {
  const url = new URL(request.url); const path = url.pathname; const db = env.DB;
  if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== url.origin) fail('Origem não permitida.', 403);
  if(path==='/api/account' && request.method==='GET'){
    const slug=url.searchParams.get('company')||'';
    if(!slug)return json({name:'Acesso Master',manager:null});
    const company=await db.prepare("SELECT c.name,u.name AS manager FROM companies c JOIN users u ON u.company_id=c.id AND u.access_role='BROKER' AND u.deleted_at IS NULL WHERE c.slug=? AND c.active=1").bind(slug).first();
    if(!company)fail('Conta indisponível. Confira o link com seu gerente.',404);
    return json(company);
  }
  if (path === '/api/login' && request.method === 'POST') {
    const passwords = passwordOptions(env);
    const body = await bodyOf(request); const email = emailOf(body.email);
    if (!email || email.length > 254 || typeof body.password !== 'string' || body.password.length > 128) fail('E-mail ou senha inválidos.', 401);
    const slug=typeof body.company==='string'?body.company.trim().toLowerCase():'';
    await rateLimit(db, slug+':'+email, request.headers.get('CF-Connecting-IP') || 'local');
    const user = await db.prepare(`SELECT u.*,c.name AS company_name,c.slug AS company_slug FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.email=? AND u.deleted_at IS NULL AND ((?='' AND u.access_role='MASTER') OR (c.slug=? AND c.active=1 AND u.access_role IN ('BROKER','CAPTADOR')))`).bind(email,slug,slug).first();
    const correct = await verifyPassword(body.password, user?.password_hash || dummyPasswordHash(passwords), passwords);
    if (!correct || !user?.active) fail('E-mail ou senha inválidos.', 401);
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
    const sessionResults=await db.batch([
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()),
      db.prepare('DELETE FROM login_limits WHERE reset_at <= ?').bind(Date.now()),
      db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) SELECT ?,id,? FROM users WHERE id=? AND password_hash=? AND active=1 AND deleted_at IS NULL AND (access_role='MASTER' OR EXISTS(SELECT 1 FROM companies c WHERE c.id=users.company_id AND c.active=1))`).bind(await digest(token),Date.now()+lifetime,user.id,user.password_hash)
    ]);
    if(!sessionResults[2].meta.changes) fail('E-mail ou senha inválidos.',401);
    return json({ user: publicUser(user) }, 200, { 'Set-Cookie': cookie(request, token, lifetime / 1000) });
  }
  if (path === '/api/logout' && request.method === 'POST') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(tokenFrom(request))).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
  }
  const user = await userOf(request, db);
  if(request.headers.has('X-Account') && request.headers.get('X-Account')!==(user.company_slug||''))fail('Sua sessão mudou de conta. Entre novamente neste link.',401);
  const companyResponse=await companyRoutes(request,db,user,{json,fail,bodyOf,passwords:passwordOptions(env)});
  if(companyResponse)return companyResponse;
  const reportResponse = await reportRoutes(request, db, user, { json, fail });
  if (reportResponse) return reportResponse;
  const leadResponse = await leadRoutes(request, db, user, { json, fail, bodyOf });
  if (leadResponse) return leadResponse;
  if (path === '/api/me' && request.method === 'GET') return json({ user: publicUser(user) });
  if (path === '/api/users' || path.startsWith('/api/users/')) {
    if (!['MASTER','BROKER'].includes(user.role)) fail('Acesso não permitido.',403);
    if(path==='/api/users' && request.method==='GET'){
      const {results}=await db.prepare('SELECT * FROM users WHERE company_id IS ? AND (?=1 OR deleted_at IS NULL) ORDER BY created_at,id LIMIT 200').bind(user.company_id,Number(url.searchParams.get('include_deleted')==='1')).all();
      return json({users:results.map(publicUser)});
    }
    if(path==='/api/users' && request.method==='POST'){
      if(user.role!=='BROKER')fail('Cadastre o Broker pelo painel Imobiliárias. Captadores são cadastrados pelo Broker.',403);
      const body=await bodyOf(request);const email=emailOf(body.email);const name=typeof body.name==='string'?body.name.trim():'';
      if(Object.keys(body).some(k=>!['name','email','password','role'].includes(k)) || body.role!=='CAPTADOR' || !name || name.length>100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !validPassword(body.password))fail('Confira nome, e-mail, perfil Captador e senha (12 a 128 caracteres).',400);
      const id=crypto.randomUUID(),now=Date.now();const hash=await hashPassword(body.password, passwordOptions(env));
      try{const result=await db.batch([
        db.prepare("INSERT INTO users (id,name,email,password_hash,role,access_role,company_id,created_at) SELECT ?,?,?,?,'CAPTADOR','CAPTADOR',?,? WHERE EXISTS(SELECT 1 FROM users a JOIN companies c ON c.id=a.company_id WHERE a.id=? AND a.active=1 AND a.deleted_at IS NULL AND a.access_role='BROKER' AND c.active=1)").bind(id,name,email,hash,user.company_id,now,user.id),
        db.prepare("INSERT INTO audit SELECT ?,?,?, 'USER_CREATED',? WHERE changes()=1").bind(crypto.randomUUID(),user.id,id,now)
      ]);if(!result[0].meta.changes)fail('Acesso alterado. Entre novamente.',403);
      }catch(error){if(String(error).includes('CAPTADOR_LIMIT'))fail('Limite de captadores ativos atingido. Desative um captador para liberar uma vaga.',409);if(String(error).includes('UNIQUE'))fail('E-mail já cadastrado.',409);throw error;}
      return json({user:{id,name,email,role:'CAPTADOR',active:true}},201);
    }
    const match=path.match(/^\/api\/users\/([^/]+)(\/password)?$/);
    if(match && ((match[2] && request.method==='POST') || (!match[2] && ['DELETE','PATCH'].includes(request.method)))){
      const id=match[1];const resetting=Boolean(match[2]);const removing=request.method==='DELETE';
      const target=await db.prepare('SELECT * FROM users WHERE id=? AND deleted_at IS NULL').bind(id).first();
      const permitted=target && (user.role==='MASTER' ? (target.access_role==='BROKER' || target.id===user.id) : (target.company_id===user.company_id && (target.access_role==='CAPTADOR' || target.id===user.id)));
      if(!permitted)fail('Usuário não encontrado.',404);
      if(!resetting && id===user.id)fail('Não é possível desativar ou excluir a própria conta.',400);
      if(!resetting && target.access_role!=='CAPTADOR')fail('Use o bloqueio da imobiliária para suspender o Broker.',400);
      let hash,active;
      if(!removing){const body=await bodyOf(request);
        if(resetting){if(Object.keys(body).some(k=>k!=='password') || !validPassword(body.password))fail('A senha deve ter de 12 a 128 caracteres.',400);hash=await hashPassword(body.password, passwordOptions(env));}
        else{if(Object.keys(body).some(k=>k!=='active') || typeof body.active!=='boolean')fail('Alteração inválida.',400);active=body.active;}
      }
      const actor="EXISTS(SELECT 1 FROM users a LEFT JOIN companies c ON c.id=a.company_id WHERE a.id=? AND a.active=1 AND a.deleted_at IS NULL AND (a.access_role='MASTER' OR (a.access_role='BROKER' AND c.active=1)))";
      const now=Date.now();let update;
      if(resetting)update=db.prepare(`UPDATE users SET password_hash=? WHERE id=? AND deleted_at IS NULL AND ${actor}`).bind(hash,id,user.id);
      else if(removing)update=db.prepare(`UPDATE users SET active=0,deleted_at=? WHERE id=? AND deleted_at IS NULL AND ${actor}`).bind(now,id,user.id);
      else update=db.prepare(`UPDATE users SET active=? WHERE id=? AND deleted_at IS NULL AND ${actor}`).bind(Number(active),id,user.id);
      const event=resetting?'USER_PASSWORD_RESET':removing?'USER_DELETED':active?'USER_ENABLED':'USER_DISABLED';
      try{const results=await db.batch([update,
        db.prepare('INSERT INTO audit SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),user.id,id,event,now),
        db.prepare(`DELETE FROM sessions WHERE user_id=? AND ${actor}`).bind(id,user.id)
      ]);if(!results[0].meta.changes)fail('Usuário ou permissão alterados. Atualize a página.',409);
      }catch(error){if(String(error).includes('CAPTADOR_LIMIT'))fail('Limite de captadores ativos atingido.',409);throw error;}
      return json({ok:true,reauthenticate:id===user.id},200,id===user.id?{'Set-Cookie':cookie(request,'',0)}:{});
    }
  }
  return json({ error: 'Não encontrado.' }, 404);
}
export default {
  async fetch(request, env) {
    let response;
    try { response = await route(request, env); }
    catch (error) { if (!error.status) console.error('Request failed', { name: error.name, message: error.message }); response = json({ error: error.status ? error.message : 'Serviço temporariamente indisponível. Tente novamente.' }, error.status || 503); }
    response = new Response(response.body, response);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    return response;
  }
};
