import{test}from'node:test';import assert from'node:assert/strict';import{readFile,readdir}from'node:fs/promises';import{Miniflare,convertV4MiniflareOptions}from'miniflare';import{unstable_splitSqlQuery}from'wrangler';import{validateOwnerResponse}from'../src/worker/owner-forms.js';
const response={name:'Proprietário de Teste',cpf:'529.982.247-25',email:'owner@example.test',phone:'51999990000',address:'Rua Teste, 100',sale_value:'',rent_value:'1800.00',condo_value:'200',iptu_value:'50',notes:'Exemplo',accepted:true,turnstile:'valid'};
test('Ficha pública: isolamento, versões, CPF, aceite, finalidades e envio único',async()=>{
 const modules=[];for(const dir of ['src/worker','src/domain'])for(const file of await readdir(dir))if(file.endsWith('.js'))modules.push({type:'ESModule',path:dir+'/'+file});
 modules.sort((a,b)=>Number(b.path==='src/worker/index.js')-Number(a.path==='src/worker/index.js'));
 const mf=new Miniflare(convertV4MiniflareOptions({modules,modulesRoot:'src',compatibilityDate:'2026-09-25',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{TURNSTILE_SITE_KEY:'test-site',TURNSTILE_SECRET_KEY:'test-secret'},outboundService:async request=>{assert.equal(new URL(request.url).hostname,'challenges.cloudflare.com');const form=await request.formData();return new Response(JSON.stringify({success:form.get('response')==='valid',hostname:'test.local',action:'owner-form'}),{headers:{'Content-Type':'application/json'}});}}));
 try{const db=await mf.getD1Database('DB');for(const file of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort())for(const sql of unstable_splitSqlQuery(await readFile('migrations/'+file,'utf8')))await db.prepare(sql).run();
 for(const id of ['x','y'])await db.prepare('INSERT INTO companies(id,slug,name,created_at) VALUES(?,?,?,0)').bind(id,id+'-company','Empresa '+id).run();
 const tokens={};let i=1;for(const[id,role,company]of[['master','MASTER',null],['bx','BROKER','x'],['by','BROKER','y'],['cx','CAPTADOR','x'],['dx','CAPTADOR','x']]){tokens[id]=String(i++).repeat(64);await db.prepare('INSERT INTO users(id,name,email,password_hash,role,access_role,company_id,created_at) VALUES(?,?,?,?,?,?,?,0)').bind(id,id,id+'@example.test','unused',role==='CAPTADOR'?'CAPTADOR':'ADMIN',role,company).run();const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tokens[id]))).toString('hex');await db.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(digest,id,Date.now()+3600000).run();}
 await db.prepare("INSERT INTO leads(id,owner_id,type,purpose,street,city,actor_id,created_at,updated_at,proprietor_name,company_id) VALUES('lx','cx','Casa','Locação','Rua original','Cidade','cx',1,1,'Original','x')").run();
 const req=(who,path,method='GET',body)=>mf.dispatchFetch('https://test.local/api/'+path,{method,headers:{Origin:'https://test.local','Content-Type':'application/json',...(who?{Cookie:'captabit_session='+tokens[who]}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const settings={previous_id:null,creci:'12345-J',contact_email:'contato@example.test',fees_text:'Taxa de intermediação: um aluguel, somente após concluir a locação.',logo:'',fees_image:''};
 assert.equal((await req('cx','company-profile/x','PUT',settings)).status,403);assert.equal((await req('by','company-profile/x')).status,403);assert.equal((await req('bx','company-profile/x','PUT',{...settings,logo:'data:image/svg+xml;base64,AAAA'})).status,400);
 const save=await req('bx','company-profile/x','PUT',settings);assert.equal(save.status,200,await save.clone().text());const version=(await save.json()).id;
 assert.equal((await req('master','company-profile/x')).status,200);
 const create=await req('cx','leads/lx/owner-forms','POST',{});assert.equal(create.status,201,await create.clone().text());const first=await create.json();const token=new URL(first.url).hash.slice(1);assert.equal(token.length,64);
 assert.equal((await req('by','leads/lx/owner-forms')).status,404);assert.equal((await req('dx','leads/lx/owner-forms')).status,404);
 let publicData=await(await req(null,'owner-form/'+token)).json();assert.equal(publicData.profile.fees_text,settings.fees_text);assert.equal(publicData.response,undefined);assert.equal(publicData.lead_id,undefined);assert.equal(publicData.profile.contact_email,settings.contact_email);
 assert.equal((await req('bx','company-profile/x','PUT',{...settings,previous_id:version,fees_text:'Taxa nova'})).status,200);
 assert.equal((await req('bx','company-profile/x','PUT',settings)).status,409);
 publicData=await(await req(null,'owner-form/'+token)).json();assert.equal(publicData.profile.fees_text,settings.fees_text);
 assert.equal((await req(null,'owner-form/'+token,'POST',{...response,cpf:'11111111111'})).status,400);
 assert.equal((await req(null,'owner-form/'+token,'POST',{...response,turnstile:'invalid'})).status,400);
 const responses=await Promise.all([req(null,'owner-form/'+token,'POST',response),req(null,'owner-form/'+token,'POST',response)]);assert.equal(responses.filter(r=>r.status===201).length,1);assert.ok(responses.some(r=>[409,410].includes(r.status)));
 assert.equal((await req(null,'owner-form/'+token)).status,410);const document=await(await req('bx',`leads/lx/owner-forms/${first.id}`)).json();assert.equal(document.accepted,true);assert.equal(document.response.name,response.name);assert.equal(document.profile.fees_text,settings.fees_text);
 assert.equal((await db.prepare("SELECT proprietor_name FROM leads WHERE id='lx'").first()).proprietor_name,'Original');
 assert.equal((await req('bx',`leads/lx/owner-forms/${first.id}/review`,'POST',{})).status,200);
 assert.equal((await req('by',`leads/lx/owner-forms/${first.id}`)).status,404);
 const second=await(await req('bx','leads/lx/owner-forms','POST',{})).json();assert.equal((await req(null,'owner-form/'+new URL(second.url).hash.slice(1),'POST',{...response,accepted:false})).status,201);assert.equal((await(await req('cx',`leads/lx/owner-forms/${second.id}`)).json()).accepted,false);
 const revoked=await(await req('bx','leads/lx/owner-forms','POST',{})).json();await req('bx',`leads/lx/owner-forms/${revoked.id}/revoke`,'POST',{});assert.equal((await req(null,'owner-form/'+new URL(revoked.url).hash.slice(1))).status,410);
 await assert.rejects(()=>db.prepare("UPDATE owner_forms SET declaration='alterada' WHERE id=?").bind(first.id).run());await assert.rejects(()=>db.prepare("UPDATE company_profiles SET fees_text='alterada' WHERE id=?").bind(version).run());

 for(const purpose of ['Venda','Locação e venda']){
  await db.prepare("UPDATE leads SET purpose=? WHERE id='lx'").bind(purpose).run();
  const created=await req('cx','leads/lx/owner-forms','POST',{});assert.equal(created.status,201);const form=await created.json();const endpoint='owner-form/'+new URL(form.url).hash.slice(1);const data=await(await req(null,endpoint)).json();assert.equal(data.purpose,purpose);assert.match(data.declaration,/efetivação/);assert.doesNotMatch(data.declaration,/conclusão/);
  assert.ok(data.declaration.includes(purpose==='Venda'?'efetivação da venda':'efetivação da locação ou da venda'));
  const values={...response,sale_value:'300000',rent_value:purpose==='Venda'?'':'1800'};
  assert.equal((await req(null,endpoint,'POST',{...values,sale_value:''})).status,400);
  if(purpose==='Locação e venda')assert.equal((await req(null,endpoint,'POST',{...values,rent_value:''})).status,400);
  assert.equal((await req(null,endpoint,'POST',values)).status,201);
 }
 await db.prepare("UPDATE companies SET active=0 WHERE id='x'").run();assert.equal((await req(null,'branding?company=x-company')).status,404);
 assert.throws(()=>validateOwnerResponse({...response,rent_value:'-2'},'Locação'));assert.throws(()=>validateOwnerResponse({...response,accepted:'true'},'Locação'));
 }finally{await mf.dispose();}
});
