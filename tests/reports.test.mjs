import { csvCell } from '../src/worker/reports.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
test('Relatórios: filtros, totais, datas, CSV e isolamento',async()=>{
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
    const start=Date.parse('2026-01-02T03:00:00Z');
    const seed=async(id,owner,created,name='Maria')=>db.prepare(`INSERT INTO leads (id,owner_id,proprietor_name,type,purpose,street,city,actor_id,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,'fixture')`).bind(id,owner,name,'Casa','Locação','Rua "Teste"; Centro','Cidade',owner,created,created).run();
    for(let i=0;i<23;i++)await seed('a'+i,'a',start+i*1000,i===0?'=SUM(1;2)"\nNome':'Maria');
    await seed('before','a',start-1);await seed('after','a',start+86400000);
    await seed('private','b',start,'SEGREDO OUTRA CARTEIRA');
    for(const [i,outcome] of ['UNKNOWN','CORRECT','CORRECT','INCORRECT','NO_RESPONSE','NO_WHATSAPP'].entries()) {
      await db.prepare('INSERT INTO contacts (id,lead_id,phone,outcome,actor_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind('c'+i,'a0','555199999000'+i,outcome,'a',start,start).run();
    }
    await db.prepare('INSERT INTO contacts (id,lead_id,phone,outcome,deleted_at,actor_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind('deleted','a1','5551999990100','CORRECT',start,'a',start,start).run();
    const filter='from=2026-01-02&to=2026-01-02';
    const report=(as,extra='')=>req(as,'reports/captacoes?'+filter+extra);
    let response=await report('a');assert.equal(response.status,200,await response.clone().text());
    const first=await response.json();assert.equal(first.total,23);assert.equal(first.rows.length,20);
    assert.equal(first.summary.contacts_count,6);assert.equal(first.summary.CORRECT,2);assert.equal(first.summary.INCORRECT,1);assert.equal(first.summary.NO_RESPONSE,1);assert.equal(first.summary.NO_WHATSAPP,1);assert.equal(first.summary.UNKNOWN,1);
    assert.deepEqual(first.stages,[{status:'Nova',total:23}]);
    const second=await (await report('a','&page=1')).json();assert.equal(second.rows.length,3);assert.equal(second.total,23);
    assert.equal(new Set([...first.rows,...second.rows].map(r=>r.id)).size,23);
    assert.equal((await (await report('admin')).json()).total,24);
    assert.equal((await (await report('b')).json()).total,1);
    assert.equal((await (await report('admin','&owner_id=b')).json()).rows[0].proprietor_name,'SEGREDO OUTRA CARTEIRA');
    assert.equal((await report('a','&owner_id=b')).status,403);
    const onlyCorrect=await (await report('a','&outcome=CORRECT')).json();assert.equal(onlyCorrect.total,1);assert.equal(onlyCorrect.summary.contacts_count,6);
    assert.equal((await (await report('a','&proprietor=Maria')).json()).total,22);
    assert.equal((await (await report('a','&property=Centro')).json()).total,23);
    assert.equal((await (await report('a','&property=%25')).json()).total,0);
    assert.equal((await (await report('a','&proprietor=SEGREDO')).json()).total,0);
    const empty=await (await report('a','&status=Captado')).json();assert.equal(empty.total,0);assert.equal(empty.summary.CORRECT,0);
    for(const extra of ['&page=-1','&status=INVALID','&outcome=INVALID'])assert.equal((await report('a',extra)).status,400);
    for(const query of ['from=2026-02-30','from=2026-01-03&to=2026-01-02','from=invalid'])assert.equal((await req('a','reports/captacoes?'+query)).status,400);
    const csv=await req('a','reports/captacoes.csv?'+filter+'&page=1');assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);
    const content=await csv.text();assert.doesNotMatch(content,/SEGREDO OUTRA CARTEIRA/);assert.match(content,/'=SUM\(1;2\)""\nNome/);assert.match(content,/Rua ""Teste""; Centro/);
    assert.equal((content.match(/"Casa"/g)||[]).length,23);
    assert.equal((await req('a','reports/captacoes.csv?owner_id=b')).status,403);
    const privateCsv=await (await req('b','reports/captacoes.csv?'+filter)).text();assert.doesNotMatch(privateCsv,/Maria|SUM/);
    assert.equal((await req('b','leads/a0','PATCH',{status:'Em contato',version:1})).status,404);
    assert.equal((await req('a','leads/a0','PATCH',{status:'Em contato',version:1})).status,200);
    assert.equal((await req('a','leads/a0','PATCH',{status:'Captado',version:1})).status,409);
    assert.equal((await (await report('a','&status=Em%20contato')).json()).total,1);
    assert.equal((await (await req('a','leads/a0/history')).json()).events[0].after.status,'Em contato');
    await db.prepare("UPDATE leads SET proprietor_name='' WHERE id='a1'").run();
    assert.equal((await req('a','leads/a1','PATCH',{status:'Em pesquisa',version:1})).status,200);
    assert.equal((await req('a','leads/a1','PATCH',{proprietor_name:'',version:2})).status,400);
    const dashboard=await (await req('a','dashboard?'+filter)).json();
    assert.equal(dashboard.total,23);assert.equal(dashboard.with_correct,1);assert.equal(dashboard.without_phone,22);assert.equal(dashboard.captured,0);
    assert.equal(dashboard.summary.CORRECT,2);assert.equal(dashboard.summary.contacts_count,6);assert.deepEqual(dashboard.team,[]);
    assert.deepEqual(dashboard.trend,[{from:'2026-01-02',to:'2026-01-02',total:23}]);
    const adminDashboard=await (await req('admin','dashboard?'+filter)).json();assert.equal(adminDashboard.total,24);assert.equal(adminDashboard.team.length,2);
    assert.equal(adminDashboard.team.reduce((n,row)=>n+row.total,0),24);
    assert.equal((await req('a','dashboard?'+filter+'&owner_id=b')).status,403);
    const filteredDashboard=await (await req('admin','dashboard?'+filter+'&owner_id=b')).json();assert.equal(filteredDashboard.total,1);assert.equal(filteredDashboard.without_phone,1);
    const daily=await (await req('a','dashboard?from=2026-01-01&to=2026-01-04')).json();assert.deepEqual(daily.trend.map(p=>p.total),[1,23,1,0]);
    const weekly=await (await req('a','dashboard?from=2026-01-01&to=2026-02-02')).json();assert.equal(weekly.trend.length,5);assert.equal(weekly.trend.reduce((n,p)=>n+p.total,0),25);assert.equal(weekly.trend.at(-1).to,'2026-02-02');
    const emptyDashboard=await (await req('a','dashboard?from=2026-02-01&to=2026-02-01')).json();assert.equal(emptyDashboard.total,0);assert.equal(emptyDashboard.summary.CORRECT,0);assert.equal(emptyDashboard.with_correct,0);assert.equal(emptyDashboard.trend[0].total,0);
    for(const query of ['from=2026-01-01','from=&to=','from=2026-01-01&to=2028-01-01'])assert.equal((await req('a','dashboard?'+query)).status,400);
    const defaultDashboard=await (await req('a','dashboard')).json();assert.equal(defaultDashboard.trend.length,30);
    assert.equal((await req('a','leads/a22','PATCH',{status:'Captado',version:1})).status,200);
    assert.equal((await (await req('a','dashboard?'+filter)).json()).captured,1);
    assert.equal((await mf.dispatchFetch('https://test.local/api/dashboard')).status,401);
    const unauth=await mf.dispatchFetch('https://test.local/api/reports/captacoes.csv');assert.equal(unauth.status,401);

  } finally {await mf.dispose();}
});

test('CSV neutraliza fórmulas e preserva separadores, aspas e quebras',()=>{
  for(const value of ['=SUM(A1)','+1','-1','@SUM(A1)','  =A1','\t=1','\r=1','\n=1']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('nome; "sobrenome"\nlinha'), '"nome; ""sobrenome""\nlinha"');
  assert.equal(csvCell(0),'"0"');
});
