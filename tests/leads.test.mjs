import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
test('Carteiras isoladas, contatos, concorrência e histórico atômico',async()=>{
  const mf=new Miniflare(convertV4MiniflareOptions({modules:[{type:'ESModule',path:'src/worker/index.js'},{type:'ESModule',path:'src/domain/password.js'},{type:'ESModule',path:'src/worker/leads.js'},{type:'ESModule',path:'src/domain/leads.js'}],modulesRoot:'src',compatibilityDate:'2026-09-25',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']}));
  try {
    const db=await mf.getD1Database('DB');
    for(const file of ['0001_auth.sql','0002_captacoes.sql']) {
      const sql=await readFile(`migrations/${file}`,'utf8');
      // D1 exec accepts multi-statement SQL when each complete statement is on one line.
      const statements=sql.trim().split(/(?<=;)\s*(?=CREATE|PRAGMA)/);
      for(const statement of statements) await db.prepare(statement.trim()).run();
    }
    const tokens={};
    for(const [id,role] of [['a','CAPTADOR'],['b','CAPTADOR'],['admin','ADMIN']]) {
      tokens[id]=(id==='a'?'a':id==='b'?'b':'c').repeat(64);
      const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tokens[id]))).toString('hex');
      await db.prepare('INSERT INTO users VALUES (?,?,?,?,?,1,?)').bind(id,id,`${id}@example.test`,'unused',role,Date.now()).run();
      await db.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(hash,id,Date.now()+600000).run();
    }
    const req=(as,path,method='GET',body)=>mf.dispatchFetch(`https://test.local/api/${path}`,{method,headers:{Origin:'https://test.local','Content-Type':'application/json',Cookie:`captabit_session=${tokens[as]}`},...(body?{body:JSON.stringify(body)}:{})});
    const input={type:'Casa',purpose:'Locação',street:'Rua de teste',city:'Teste',phones:['51999991111','51999992222']};
    const response=await req('a','leads','POST',input); assert.equal(response.status,201,await response.clone().text());
    const {lead}=await response.json(); const id=lead.id;
    assert.equal(lead.owner_id,'a');
    assert.equal((await req('a','leads','POST',{...input,owner_id:'b'})).status,400);
    assert.equal((await req('b',`leads/${id}`)).status,404);
    assert.equal((await req('b',`leads/${id}/history`)).status,404);
    assert.equal((await req('b',`leads/${id}/contacts`,'POST',{phone:'51999993333'})).status,404);
    assert.equal((await (await req('b','leads?q=Rua')).json()).leads.length,0);
    assert.equal((await (await req('a','leads?q=Rua')).json()).leads.length,1);
    assert.equal((await (await req('admin','leads')).json()).leads.length,1);
    const {contacts}=await (await req('a',`leads/${id}`)).json(); assert.equal(contacts.length,2);
    assert.equal((await req('b',`leads/${id}/contacts/${contacts[0].id}`,'PATCH',{status:'Mensagem enviada',version:1})).status,404);
    assert.equal((await req('a',`leads/${id}/contacts/${contacts[0].id}`,'PATCH',{status:'Mensagem enviada',version:1})).status,200);
    assert.equal((await req('a',`leads/${id}/contacts/${contacts[0].id}`,'PATCH',{status:'Sem resposta',version:1})).status,409);
    assert.equal((await req('a',`leads/${id}/contacts`,'POST',{phone:contacts[0].phone})).status,409);
    const concurrent=await Promise.all([req('a',`leads/${id}`,'PATCH',{status:'Em pesquisa',version:1}),req('a',`leads/${id}`,'PATCH',{status:'Em contato',version:1})]);
    assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
    const history=await (await req('a',`leads/${id}/history`)).json(); assert.equal(history.events.length,5);
    assert.equal((await req('a',`leads/${id}`,'PATCH',{owner_id:'b',version:2})).status,403);
    assert.equal((await req('admin',`leads/${id}`,'PATCH',{owner_id:'b',version:2})).status,200);
    assert.equal((await req('a',`leads/${id}`)).status,404);
    assert.equal((await req('a',`leads/${id}/contacts/${contacts[0].id}`,'PATCH',{status:'Sem resposta',version:2})).status,404);
    assert.equal((await req('b',`leads/${id}`)).status,200);
    assert.equal((await req('b',`leads/${id}`,'PATCH',{status:'Captado',version:3})).status,200);
    assert.equal((await req('b',`leads/${id}`,'PATCH',{status:'Nova',version:4})).status,403);
    assert.equal((await req('admin',`leads/${id}`,'PATCH',{status:'Nova',version:4})).status,200);
    const count=await db.prepare('SELECT COUNT(*) AS n FROM leads').first();
    assert.equal((await req('a','leads','POST',{...input,phones:['inválido']})).status,400);
    assert.deepEqual(await db.prepare('SELECT COUNT(*) AS n FROM leads').first(),count);
    assert.equal((await req('a','leads?page=-1')).status,400);
  } finally {await mf.dispose();}
});
