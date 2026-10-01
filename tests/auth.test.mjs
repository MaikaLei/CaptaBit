import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { hashPassword } from '../src/domain/password.js';

for (const production of [false,true]) test(`Autenticação e permissões (${production?'produção com pepper':'local'})`, async () => {
  const pepper = 'ab'.repeat(32);
  const bindings = production ? {PASSWORD_PROFILE:'cloudflare-v1',AUTH_PEPPER:pepper} : {};
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: [{ type: 'ESModule', path: 'src/worker/index.js' }, { type: 'ESModule', path: 'src/domain/password.js' }, { type: 'ESModule', path: 'src/worker/leads.js' }, { type: 'ESModule', path: 'src/domain/leads.js' }, { type: 'ESModule', path: 'src/domain/duplicates.js' }, { type: 'ESModule', path: 'src/worker/duplicates.js' }, { type: 'ESModule', path: 'src/domain/whatsapp.js' }, { type: 'ESModule', path: 'src/domain/contact-outcomes.js' }, { type: 'ESModule', path: 'src/worker/reports.js' }, {type:'ESModule',path:'src/worker/companies.js'}], modulesRoot: 'src', compatibilityDate: '2026-09-25', compatibilityFlags: ['nodejs_compat'], bindings, d1Databases: ['DB'] }));
  try {
    const db = await mf.getD1Database('DB');
    for(const file of ['0001_auth.sql','0002_captacoes.sql','0003_duplicates.sql','0004_contact_outcomes.sql','0005_proprietor.sql','0006_user_management.sql','0007_companies.sql']){
      const sql=await readFile('migrations/'+file,'utf8');for(const statement of sql.trim().split(/(?<=;)\s*(?=CREATE|PRAGMA|ALTER|DROP|UPDATE|DELETE)/))await db.prepare(statement.trim()).run();
    }
    await db.prepare("INSERT INTO companies (id,slug,name,created_at) VALUES ('fixture','fixture','Criativa Imóveis',0)").run();
    const password = 'Teste-local-123456!';
    const hash = await hashPassword(password,production?{pepper}:{});
    for (const [id, role] of [['admin', 'ADMIN'], ['captador', 'CAPTADOR']]) await db.prepare(`INSERT INTO users (id,name,email,password_hash,role,active,created_at,company_id,access_role) VALUES (?, ?, ?, ?, ?, 1, ?, 'fixture', ?)`).bind(id, id, `${id}@example.test`, hash, role, Date.now(),role==='ADMIN'?'BROKER':'CAPTADOR').run();
    const request = (path, { method = 'GET', body, token, origin = 'https://captabit.test' } = {}) => mf.dispatchFetch(`https://captabit.test/api/${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Cookie: token } : {}) }, ...(body !== undefined ? { body: JSON.stringify(path==='login'?{...body,company:'fixture'}:body) } : {}) });
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
    await db.prepare('INSERT INTO login_limits VALUES (?, 8, ?)').bind(await sha('email:fixture:limit@example.test'), Date.now() + 60000).run();
    assert.equal((await request('login', { method: 'POST', body: { email: 'limit@example.test', password } })).status, 429);
    const audit = await db.prepare('SELECT COUNT(*) AS count FROM audit').first();
    assert.equal(audit.count, 2);
    const adminLogin=await request('login',{method:'POST',body:{email:'admin@example.test',password}});
    const managementToken=adminLogin.headers.get('set-cookie').split(';')[0];
    await request('users/captador',{method:'PATCH',token:managementToken,body:{active:true}});
    const beforeReset=await request('login',{method:'POST',body:{email:'captador@example.test',password}});
    const beforeToken=beforeReset.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('users/admin/password',{method:'POST',token:beforeToken,body:{password}})).status,403);
    assert.equal((await request('users/admin',{method:'DELETE',token:beforeToken})).status,403);
    assert.equal((await request('users/captador/password',{method:'POST',token:managementToken,body:{password:'short'}})).status,400);
    const newPassword='Nova-senha-testes-123!';
    assert.equal((await request('users/captador/password',{method:'POST',token:managementToken,body:{password:newPassword}})).status,200);
    assert.equal((await request('me',{token:beforeToken})).status,401);
    assert.equal((await request('login',{method:'POST',body:{email:'captador@example.test',password}})).status,401);
    const afterReset=await request('login',{method:'POST',body:{email:'captador@example.test',password:newPassword}});assert.equal(afterReset.status,200);
    const afterToken=afterReset.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('users/admin',{method:'DELETE',token:managementToken})).status,400);
    assert.equal((await request('users/captador',{method:'DELETE',token:managementToken,origin:'https://evil.test'})).status,403);
    assert.equal((await request('users/captador',{method:'DELETE',token:managementToken})).status,200);
    assert.equal((await request('me',{token:afterToken})).status,401);
    assert.equal((await request('login',{method:'POST',body:{email:'captador@example.test',password:newPassword}})).status,401);
    assert.ok(!(await (await request('users',{token:managementToken})).json()).users.some(u=>u.id==='captador'));
    assert.ok((await (await request('users?include_deleted=1',{token:managementToken})).json()).users.find(u=>u.id==='captador').deleted);
    assert.equal((await request('users/captador',{method:'PATCH',token:managementToken,body:{active:true}})).status,404);
    assert.equal((await request('users/captador/password',{method:'POST',token:managementToken,body:{password}})).status,404);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM audit WHERE event='USER_PASSWORD_RESET'").first()).n,1);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM audit WHERE event='USER_DELETED'").first()).n,1);
    assert.equal((await request('users/admin/password',{method:'POST',token:managementToken,body:{password:newPassword}})).status,200);
    assert.equal((await request('me',{token:managementToken})).status,401);

  } finally { await mf.dispose(); }
});
async function sha(value) { return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex'); }
