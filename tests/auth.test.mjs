import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { hashPassword } from '../src/domain/password.js';

test('Autenticação e permissões no runtime Cloudflare com D1', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: [{ type: 'ESModule', path: 'src/worker/index.js' }, { type: 'ESModule', path: 'src/domain/password.js' }, { type: 'ESModule', path: 'src/worker/leads.js' }, { type: 'ESModule', path: 'src/domain/leads.js' }, { type: 'ESModule', path: 'src/domain/duplicates.js' }, { type: 'ESModule', path: 'src/worker/duplicates.js' }, { type: 'ESModule', path: 'src/domain/whatsapp.js' }], modulesRoot: 'src', compatibilityDate: '2026-09-25', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'] }));
  try {
    const db = await mf.getD1Database('DB');
    const sql = await readFile('migrations/0001_auth.sql', 'utf8');
    for (const statement of sql.split(';').map(x => x.trim()).filter(Boolean)) await db.prepare(statement).run();
    const password = 'Teste-local-123456!';
    const hash = await hashPassword(password);
    for (const [id, role] of [['admin', 'ADMIN'], ['captador', 'CAPTADOR']]) await db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, 1, ?)').bind(id, id, `${id}@example.test`, hash, role, Date.now()).run();
    const request = (path, { method = 'GET', body, token, origin = 'https://captabit.test' } = {}) => mf.dispatchFetch(`https://captabit.test/api/${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Cookie: token } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    assert.equal((await request('me')).status, 401);
    assert.equal((await request('login', { method: 'POST', body: { email: 'admin@example.test', password }, origin: 'https://evil.test' })).status, 403);
    assert.equal((await request('login', { method: 'POST', body: { email: 'admin@example.test', password: 'wrong' } })).status, 401);
    const start = performance.now();
    const login = await request('login', { method: 'POST', body: { email: 'ADMIN@example.test', password } });
    assert.equal(login.status, 200, await login.clone().text());
    console.log(`Hash/login no runtime local: ${Math.round(performance.now() - start)} ms (tempo de parede; não mede CPU de produção).`);
    const setCookie = login.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /Secure/); assert.match(setCookie, /SameSite=Strict/);
    const adminToken = setCookie.split(';')[0];
    assert.equal((await request('me', { token: adminToken })).status, 200);
    const stored = await db.prepare('SELECT token_hash FROM sessions WHERE user_id = ?').bind('admin').first();
    assert.notEqual(stored.token_hash, adminToken.split('=')[1]);
    const captadorLogin = await request('login', { method: 'POST', body: { email: 'captador@example.test', password } });
    const captadorToken = captadorLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('users', { token: captadorToken })).status, 403);
    assert.equal((await request('users', { method: 'POST', token: captadorToken, body: { role: 'ADMIN' } })).status, 403);
    const list = await request('users', { token: adminToken });
    assert.equal(list.status, 200); assert.doesNotMatch(await list.text(), /password_hash|token_hash/);
    const created = await request('users', { method: 'POST', token: adminToken, body: { name: 'Novo', email: 'novo@example.test', role: 'CAPTADOR', password } });
    assert.equal(created.status, 201);
    assert.equal((await request('users/admin', { method: 'PATCH', token: adminToken, body: { active: false } })).status, 400);
    assert.equal((await request('users/captador', { method: 'PATCH', token: adminToken, body: { active: false } })).status, 200);
    assert.equal((await request('me', { token: captadorToken })).status, 401);
    assert.equal((await request('login', { method: 'POST', body: { email: 'captador@example.test', password } })).status, 401);
    await db.prepare('UPDATE sessions SET expires_at = 0 WHERE user_id = ?').bind('admin').run();
    assert.equal((await request('me', { token: adminToken })).status, 401);
    const again = await request('login', { method: 'POST', body: { email: 'admin@example.test', password } });
    const token2 = again.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('logout', { method: 'POST', token: token2, body: {} })).status, 200);
    assert.equal((await request('me', { token: token2 })).status, 401);
    await db.prepare('INSERT INTO login_limits VALUES (?, 8, ?)').bind(await sha('email:limit@example.test'), Date.now() + 60000).run();
    assert.equal((await request('login', { method: 'POST', body: { email: 'limit@example.test', password } })).status, 429);
    const audit = await db.prepare('SELECT COUNT(*) AS count FROM audit').first();
    assert.equal(audit.count, 2);
  } finally { await mf.dispose(); }
});
async function sha(value) { return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex'); }
