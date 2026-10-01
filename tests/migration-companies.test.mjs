import { unstable_splitSqlQuery } from 'wrangler';
import { csvCell } from '../src/worker/reports.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
test('Migração mantém carteira antiga exclusivamente no Master',async()=>{
  const mf=new Miniflare(convertV4MiniflareOptions({modules:[{type:'ESModule',path:'src/worker/index.js'},{type:'ESModule',path:'src/domain/password.js'},{type:'ESModule',path:'src/worker/leads.js'},{type:'ESModule',path:'src/domain/leads.js'}, { type: 'ESModule', path: 'src/domain/duplicates.js' }, { type: 'ESModule', path: 'src/worker/duplicates.js' }, { type: 'ESModule', path: 'src/domain/whatsapp.js' }, { type: 'ESModule', path: 'src/domain/contact-outcomes.js' }, { type: 'ESModule', path: 'src/worker/reports.js' }, {type:'ESModule',path:'src/worker/companies.js'}],modulesRoot:'src',compatibilityDate:'2026-09-25',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']}));
  try {
    const db=await mf.getD1Database('DB');
    for(const file of ['0001_auth.sql','0002_captacoes.sql','0003_duplicates.sql','0004_contact_outcomes.sql','0005_proprietor.sql','0006_user_management.sql']){
      const sql=await readFile('migrations/'+file,'utf8');for(const statement of sql.trim().split(/(?<=;)\s*(?=CREATE|PRAGMA|ALTER|DROP|UPDATE|DELETE)/))await db.prepare(statement.trim()).run();
    }
    for(const [id,role] of [['old-admin','ADMIN'],['old-cap','CAPTADOR']])await db.prepare('INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').bind(id,id,id+'@example.test','preserved-hash',role,1).run();
    await db.prepare("INSERT INTO leads (id,owner_id,type,purpose,street,city,actor_id,created_at,updated_at,proprietor_name) VALUES ('old-lead','old-cap','Casa','Locação','Rua Original','Cidade','old-cap',1,1,'Proprietário')").run();
    await db.prepare("INSERT INTO contacts (id,lead_id,phone,actor_id,created_at,updated_at) VALUES ('old-phone','old-lead','5551999990000','old-cap',1,1)").run();
    await db.prepare("INSERT INTO sessions VALUES ('old-session','old-cap',9999999999999)").run();
    const before=await db.prepare('SELECT * FROM leads').first();const contacts=await db.prepare('SELECT * FROM contacts').all();const history=await db.prepare('SELECT * FROM lead_events ORDER BY id').all();
    const migration=await readFile('migrations/0007_companies.sql','utf8');for(const statement of unstable_splitSqlQuery(migration))await db.prepare(statement.trim()).run();
    assert.deepEqual(await db.prepare('SELECT * FROM leads').first(),{...before,company_id:null});
    assert.deepEqual((await db.prepare('SELECT * FROM contacts').all()).results,contacts.results);assert.deepEqual((await db.prepare('SELECT * FROM lead_events ORDER BY id').all()).results,history.results);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM companies').first()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first()).n,0);
    const master=await db.prepare("SELECT * FROM users WHERE id='old-admin'").first();assert.equal(master.access_role,'MASTER');assert.equal(master.password_hash,'preserved-hash');assert.equal(master.active,1);
    const oldCap=await db.prepare("SELECT * FROM users WHERE id='old-cap'").first();assert.equal(oldCap.access_role,'LEGACY');assert.equal(oldCap.active,0);assert.equal(oldCap.company_id,null);
    await assert.rejects(()=>db.prepare("INSERT INTO users (id,name,email,password_hash,role,access_role,created_at) VALUES ('second','Second','second@example.test','x','ADMIN','MASTER',2)").run());
  } finally {await mf.dispose();}
});
