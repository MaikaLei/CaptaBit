import { csvCell } from '../src/worker/reports.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
test('Multiempresa: Master, Brokers, isolamento e limite concorrente',async()=>{
  const mf=new Miniflare(convertV4MiniflareOptions({modules:[{type:'ESModule',path:'src/worker/index.js'},{type:'ESModule',path:'src/domain/password.js'},{type:'ESModule',path:'src/worker/leads.js'},{type:'ESModule',path:'src/domain/leads.js'}, { type: 'ESModule', path: 'src/domain/duplicates.js' }, { type: 'ESModule', path: 'src/worker/duplicates.js' }, { type: 'ESModule', path: 'src/domain/whatsapp.js' }, { type: 'ESModule', path: 'src/domain/contact-outcomes.js' }, { type: 'ESModule', path: 'src/worker/reports.js' }, {type:'ESModule',path:'src/worker/companies.js'}],modulesRoot:'src',compatibilityDate:'2026-09-25',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']}));
  try {
    const db=await mf.getD1Database('DB');
    for(const file of ['0001_auth.sql','0002_captacoes.sql','0003_duplicates.sql','0004_contact_outcomes.sql','0005_proprietor.sql','0006_user_management.sql','0007_companies.sql']) {
      const sql=await readFile(`migrations/${file}`,'utf8');
      // D1 exec accepts multi-statement SQL when each complete statement is on one line.
      const statements=sql.trim().split(/(?<=;)\s*(?=CREATE|PRAGMA|ALTER|DROP|UPDATE|DELETE)/);
      for(const statement of statements) await db.prepare(statement.trim()).run();
    }
    await db.prepare("INSERT INTO companies (id,slug,name,created_at) VALUES ('fixture','fixture','Criativa Imóveis',0)").run();
    const tokens={};
    for(const [id,role] of [['a','CAPTADOR'],['b','CAPTADOR'],['admin','ADMIN']]) {
      tokens[id]=(id==='a'?'a':id==='b'?'b':'c').repeat(64);
      const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tokens[id]))).toString('hex');
      await db.prepare(`INSERT INTO users (id,name,email,password_hash,role,active,created_at,company_id,access_role) VALUES (?,?,?,?,?,1,?,'fixture',?)`).bind(id,id,`${id}@example.test`,'unused',role,Date.now(),role==='ADMIN'?'BROKER':'CAPTADOR').run();
      await db.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(hash,id,Date.now()+600000).run();
    }
    const req=(as,path,method='GET',body)=>mf.dispatchFetch(`https://test.local/api/${path}`,{method,headers:{Origin:'https://test.local','Content-Type':'application/json',Cookie:`captabit_session=${tokens[as]}`},...(body?{body:JSON.stringify(body)}:{})});
    const password='Empresa-teste-12345!';
    tokens.master='d'.repeat(64);
    const tokenHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tokens.master))).toString('hex');
    await db.prepare("INSERT INTO users (id,name,email,password_hash,role,access_role,created_at) VALUES ('master','Titular','master@example.test','unused','ADMIN','MASTER',0)").run();
    await db.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(tokenHash,'master',Date.now()+600000).run();
    const createCompany=async(slug)=>{
      const response=await req('master','companies','POST',{name:'Imobiliária '+slug,slug,broker_name:'Gerente '+slug,broker_email:slug+'@example.test',password});
      assert.equal(response.status,201,await response.clone().text());return response.json();
    };
    const x=await createCompany('empresa-x'),y=await createCompany('empresa-y'),z=await createCompany('empresa-z');
    const signIn=async(key,email,company)=>{
      const response=await req('a','login','POST',{email,password,company});assert.equal(response.status,200,await response.clone().text());tokens[key]=response.headers.get('set-cookie').split(';')[0].split('=')[1];return (await response.json()).user;
    };
    const bx=await signIn('bx','empresa-x@example.test','empresa-x');const by=await signIn('by','empresa-y@example.test','empresa-y');await signIn('bz','empresa-z@example.test','empresa-z');
    assert.equal((await req('a','login','POST',{email:'empresa-x@example.test',password,company:'empresa-y'})).status,401);
    assert.equal((await req('a','login','POST',{email:'empresa-x@example.test',password})).status,401);
    assert.equal((await mf.dispatchFetch('https://test.local/api/me',{headers:{Cookie:`captabit_session=${tokens.bx}`,'X-Account':'empresa-y'}})).status,401);
    assert.equal((await req('bx','companies')).status,403);
    assert.equal((await req('bx','companies','POST',{})).status,403);
    assert.equal((await req('bx','users','POST',{name:'Intruso',email:'intruso@example.test',password,role:'MASTER'})).status,400);
    const fields={proprietor_name:'Proprietário privado',type:'Casa',purpose:'Locação',street:'Rua Igual',number:'7',city:'Teste',state:'RS',phones:['51999990000']};
    const lx=await (await req('bx','leads','POST',fields)).json();assert.ok(lx.lead);
    assert.equal((await (await req('by','leads/duplicates','POST',fields)).json()).duplicates.items.length,0);
    const ly=await (await req('by','leads','POST',fields)).json();assert.ok(ly.lead);
    const legacy=await (await req('master','leads','POST',fields)).json();assert.ok(legacy.lead);assert.equal(legacy.lead.company_id,null);
    assert.equal((await (await req('master','leads')).json()).leads.length,1);
    for(const who of ['by','bz','master'])for(const path of [`leads/${lx.lead.id}`,`leads/${lx.lead.id}/history`])assert.equal((await req(who,path)).status,404);
    assert.equal((await req('by',`leads/${lx.lead.id}`,'PATCH',{status:'Em contato',version:1})).status,404);
    assert.equal((await req('bx',`leads/${lx.lead.id}`,'PATCH',{owner_id:by.id,version:1})).status,400);
    assert.equal((await req('bx','leads','POST',{...fields,company_id:y.id})).status,400);
    const detail=await (await req('bx',`leads/${lx.lead.id}`)).json();const contact=detail.contacts[0];
    for(const verb of ['PATCH','DELETE'])assert.equal((await req('by',`leads/${lx.lead.id}/contacts/${contact.id}`,verb,{version:1,outcome:'CORRECT'})).status,404);
    assert.equal((await req('by',`leads/${lx.lead.id}/whatsapp/${contact.id}`,'POST',{version:1})).status,404);
    const wa=await (await req('bx',`leads/${lx.lead.id}/whatsapp/${contact.id}`,'POST',{version:1})).json();assert.match(new URL(wa.url).searchParams.get('text'),/Imobiliária empresa-x/);assert.doesNotMatch(new URL(wa.url).searchParams.get('text'),/Criativa|empresa-y/);
    assert.equal((await (await req('bz','reports/captacoes')).json()).total,0);
    assert.equal((await (await req('by','reports/captacoes')).json()).total,1);
    const csv=await (await req('by','reports/captacoes.csv')).text();assert.doesNotMatch(csv,/Gerente empresa-x|Titular/);
    assert.equal((await (await req('by','dashboard')).json()).total,1);
    assert.equal((await (await req('bx','users')).json()).users.length,1);
    for(const [verb,path,body] of [['POST',`users/${by.id}/password`,{password}],['DELETE',`users/${by.id}`,{}],['PATCH',`users/${by.id}`,{active:false}]])assert.equal((await req('bx',path,verb,body)).status,404);
    const publicInfo=await (await req('a','account?company=empresa-x')).json();assert.equal(publicInfo.manager,'Gerente empresa-x');assert.doesNotMatch(JSON.stringify(publicInfo),/email|password|empresa-y/);
    const createCap=i=>req('bx','users','POST',{name:'Captador '+i,email:`cap${i}@example.test`,password,role:'CAPTADOR'});
    const concurrent=await Promise.all([0,1,2,3].map(createCap));assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,201,201,409]);
    const successful=(await (await req('bx','users')).json()).users.filter(u=>u.role==='CAPTADOR');assert.equal(successful.length,3);const cap=successful[0];
    await signIn('cx',cap.email,'empresa-x');
    assert.equal((await req('cx','users')).status,403);assert.equal((await req('cx',`leads/${lx.lead.id}`)).status,404);
    assert.ok((await (await req('cx','leads/duplicates','POST',fields)).json()).duplicates.items.length>0);
    assert.equal((await req('bx','users/'+cap.id,'PATCH',{active:false})).status,200);
    assert.equal((await req('cx','me')).status,401);
    assert.equal((await createCap(4)).status,201);
    assert.equal((await req('bx','users/'+cap.id,'PATCH',{active:true})).status,409);
    assert.equal((await req('master','companies/'+x.id,'PATCH',{active:false})).status,200);
    assert.equal((await req('bx','me')).status,401);
    assert.equal((await req('a','login','POST',{email:bx.email,password,company:'empresa-x'})).status,401);
    assert.equal((await req('by','me')).status,200);
    assert.equal((await req('master','companies/'+x.id,'PATCH',{active:true})).status,200);
    assert.equal((await req('bx','me')).status,401);
    await signIn('bx',bx.email,'empresa-x');assert.equal((await (await req('bx','leads')).json()).leads.length,1);
    await assert.rejects(()=>db.prepare('UPDATE leads SET company_id=? WHERE id=?').bind(y.id,lx.lead.id).run());
    assert.equal((await (await req('master','companies')).json()).companies.length,4);

  } finally {await mf.dispose();}
});
