import { hashPassword, verifyPassword, validPassword, dummyHash } from '../domain/password.js';
const cookieName = 'captabit_session';
const lifetime = 8 * 60 * 60 * 1000;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role, active: Boolean(user.active) });
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
  const user = await db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1').bind(await digest(token), Date.now()).first();
  if (!user) fail('Entre para continuar.', 401);
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
  if (path === '/api/login' && request.method === 'POST') {
    const body = await bodyOf(request); const email = emailOf(body.email);
    if (!email || email.length > 254 || typeof body.password !== 'string' || body.password.length > 128) fail('E-mail ou senha inválidos.', 401);
    await rateLimit(db, email, request.headers.get('CF-Connecting-IP') || 'local');
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    const correct = await verifyPassword(body.password, user?.password_hash || dummyHash);
    if (!correct || !user?.active) fail('E-mail ou senha inválidos.', 401);
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()),
      db.prepare('DELETE FROM login_limits WHERE reset_at <= ?').bind(Date.now()),
      db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(token), user.id, Date.now() + lifetime)
    ]);
    return json({ user: publicUser(user) }, 200, { 'Set-Cookie': cookie(request, token, lifetime / 1000) });
  }
  if (path === '/api/logout' && request.method === 'POST') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(tokenFrom(request))).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
  }
  const user = await userOf(request, db);
  if (path === '/api/me' && request.method === 'GET') return json({ user: publicUser(user) });
  if (path === '/api/users' || path.startsWith('/api/users/')) {
    if (user.role !== 'ADMIN') fail('Acesso não permitido.', 403);
    if (path === '/api/users' && request.method === 'GET') {
      const { results } = await db.prepare('SELECT id, name, email, role, active FROM users ORDER BY created_at, id LIMIT 200').all();
      return json({ users: results.map(publicUser) });
    }
    if (path === '/api/users' && request.method === 'POST') {
      const body = await bodyOf(request); const email = emailOf(body.email);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !['ADMIN', 'CAPTADOR'].includes(body.role) || !validPassword(body.password)) fail('Confira nome, e-mail, perfil e senha (12 a 128 caracteres).', 400);
      const id = crypto.randomUUID(); const now = Date.now(); const hash = await hashPassword(body.password);
      try {
        await db.batch([
          db.prepare('INSERT INTO users (id, name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)').bind(id, name, email, hash, body.role, now),
          db.prepare('INSERT INTO audit VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), user.id, id, 'USER_CREATED', now)
        ]);
      } catch (error) { if (String(error).includes('UNIQUE')) fail('E-mail já cadastrado.', 409); throw error; }
      return json({ user: { id, name, email, role: body.role, active: true } }, 201);
    }
    if (request.method === 'PATCH' && /^\/api\/users\/[^/]+$/.test(path)) {
      const id = path.split('/').pop(); const body = await bodyOf(request);
      if (typeof body.active !== 'boolean' || Object.keys(body).some(key => key !== 'active')) fail('Alteração inválida.', 400);
      if (id === user.id) fail('Não é possível desativar a própria conta.', 400);
      if (!await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()) fail('Usuário não encontrado.', 404);
      await db.batch([
        db.prepare('UPDATE users SET active = ? WHERE id = ?').bind(Number(body.active), id),
        db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
        db.prepare('INSERT INTO audit VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), user.id, id, body.active ? 'USER_ENABLED' : 'USER_DISABLED', Date.now())
      ]);
      return json({ ok: true });
    }
  }
  return json({ error: 'Não encontrado.' }, 404);
}
export default {
  async fetch(request, env) {
    let response;
    try { response = await route(request, env); }
    catch (error) { response = json({ error: error.status ? error.message : 'Serviço temporariamente indisponível. Tente novamente.' }, error.status || 503); }
    response = new Response(response.body, response);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    return response;
  }
};
