const hex = bytes => [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const latest = (db,id) => db.prepare('SELECT p.* FROM company_profiles p WHERE p.company_id=? AND NOT EXISTS(SELECT 1 FROM company_profiles n WHERE n.previous_id=p.id) LIMIT 1').bind(id).first();
const declaration = (company,creci,purpose) => `Declaro ser proprietário(a) ou representante autorizado do imóvel identificado nesta ficha e autorizo a ${company} — CRECI ${creci} a divulgar suas informações e imagens para ${purpose === 'Locação e venda' ? 'locação ou venda' : purpose.toLowerCase()}, nas condições informadas, em seu site, portais imobiliários, redes sociais e WhatsApp. Esta autorização é sem exclusividade e poderá ser cancelada mediante solicitação à imobiliária. Declaro que li e estou ciente das taxas descritas no quadro desta ficha, devidas somente em caso de efetivação da ${purpose === 'Locação e venda' ? 'locação ou da venda' : purpose.toLowerCase()} do imóvel, conforme as condições apresentadas. Esta autorização não concede poderes para assinar contratos ou receber valores em meu nome.`;
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Object.assign(new Error('Confira os campos obrigatórios e os limites de texto.'),{status:400});return value.trim();}
function image(value){if(value==='')return '';if(typeof value!=='string'||value.length>280000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value))throw Object.assign(new Error('Use uma imagem PNG ou JPEG de até 200 KB.'),{status:400});const bytes=atob(value.split(',')[1]);if(bytes.length>204800||!(value.startsWith('data:image/png;')?bytes.startsWith('\x89PNG\r\n\x1a\n'):bytes.startsWith('\xff\xd8\xff')))throw Object.assign(new Error('Imagem inválida.'),{status:400});return value;}
function cpf(value){const n=value.replace(/\D/g,'');if(n.length!==11||/^(\d)\1+$/.test(n))return false;for(let k=9;k<11;k++){let sum=0;for(let i=0;i<k;i++)sum+=Number(n[i])*(k+1-i);let digit=(sum*10)%11;if(digit===10)digit=0;if(digit!==Number(n[k]))return false;}return true;}
export function validateOwnerResponse(body,purpose){
 const keys=['name','cpf','email','phone','address','sale_value','rent_value','condo_value','iptu_value','notes','accepted','turnstile'];
 if(Object.keys(body).some(k=>!keys.includes(k)))throw Object.assign(new Error('Campo não permitido.'),{status:400});
 const data={};for(const [key,max] of [['name',150],['cpf',18],['email',254],['phone',40],['address',600],['notes',2000]])data[key]=text(body[key]??'',max,['name','cpf','email','address'].includes(key));
 if(!cpf(data.cpf)||!/^\S+@\S+\.\S+$/.test(data.email)||typeof body.accepted!=='boolean')throw Object.assign(new Error('Confira CPF, e-mail e aceite.'),{status:400});
 data.cpf=data.cpf.replace(/\D/g,'');
 for(const key of ['sale_value','rent_value','condo_value','iptu_value']){const value=body[key]??'';if(typeof value!=='string'||value.length>15||(value!==''&&!/^\d{1,10}(\.\d{1,2})?$/.test(value)))throw Object.assign(new Error('Informe valores válidos em reais.'),{status:400});data[key]=value;}
 if((purpose!=='Locação'&&!data.sale_value)||(purpose!=='Venda'&&!data.rent_value))throw Object.assign(new Error('Informe o valor para a finalidade do imóvel.'),{status:400});
 if((purpose==='Locação'&&data.sale_value)||(purpose==='Venda'&&data.rent_value))throw Object.assign(new Error('Informe apenas os valores correspondentes à finalidade do imóvel.'),{status:400});
 return data;
}
async function limit(request,db,fail){const now=Date.now();const key=await digest('owner-form-ip:'+ (request.headers.get('CF-Connecting-IP')||'local'));const r=await db.prepare('INSERT INTO login_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts').bind(key,now+900000,now,now).first();if(r.attempts>40)fail('Muitas tentativas. Aguarde 15 minutos.',429);}
export async function publicFormRoutes(request,env,{json,fail,bodyOf}){
 const url=new URL(request.url),db=env.DB;
 if(url.pathname==='/api/branding'&&request.method==='GET'){
  const c=await db.prepare('SELECT id,name FROM companies WHERE slug=? AND active=1').bind(url.searchParams.get('company')||'').first();if(!c)fail('Imobiliária indisponível.',404);const p=await latest(db,c.id);return json({name:c.name,logo:p?.logo||''});
 }
 const m=url.pathname.match(/^\/api\/owner-form\/([a-f0-9]{64})$/);if(!m)return null;
 if(!['GET','POST'].includes(request.method))fail('Método não permitido.',405);
 if(request.method==='POST')await limit(request,db,fail);
 const f=await db.prepare('SELECT f.* FROM owner_forms f JOIN companies c ON c.id=f.company_id WHERE token_hash=? AND c.active=1').bind(await digest(m[1])).first();
 if(!f||f.revoked_at||f.submitted_at||f.expires_at<=Date.now())fail('Este link não está disponível. Solicite uma nova ficha ao corretor.',410);
 const p=await db.prepare('SELECT * FROM company_profiles WHERE id=?').bind(f.profile_id).first();
 if(request.method==='GET')return json({company_name:f.company_name,purpose:f.purpose,declaration:f.declaration,privacy_text:f.privacy_text,profile:{creci:p.creci,fees_text:p.fees_text,contact_email:p.contact_email,logo:p.logo,fees_image:p.fees_image},expires_at:f.expires_at,sitekey:env.TURNSTILE_SITE_KEY||''});
 const body=await bodyOf(request);const data=validateOwnerResponse(body,f.purpose);
 if(!env.TURNSTILE_SECRET_KEY||!env.TURNSTILE_SITE_KEY)fail('Envio temporariamente indisponível. Contate a imobiliária.',503);
 if(typeof body.turnstile!=='string'||!body.turnstile||body.turnstile.length>2048)fail('Conclua a verificação de segurança.',400);
 let verified;try{const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:body.turnstile,remoteip:request.headers.get('CF-Connecting-IP')||''}),signal:AbortSignal.timeout(10000)});verified=await r.json();}catch{fail('Verificação indisponível. Tente novamente.',503);}
 if(!verified.success||verified.hostname!==url.hostname||verified.action!=='owner-form')fail('Verificação de segurança inválida. Tente novamente.',400);
 const now=Date.now();const result=await db.prepare('UPDATE owner_forms SET response_json=?,accepted=?,submitted_at=? WHERE id=? AND submitted_at IS NULL AND revoked_at IS NULL AND expires_at>? AND EXISTS(SELECT 1 FROM companies WHERE id=owner_forms.company_id AND active=1)').bind(JSON.stringify(data),Number(body.accepted),now,f.id,now).run();
 if(!result.meta.changes)fail('Este link já foi utilizado ou cancelado.',409);
 return json({ok:true},201);
}
export async function ownerFormRoutes(request,env,user,{json,fail,bodyOf}){
 const url=new URL(request.url),db=env.DB;
 const profile=url.pathname.match(/^\/api\/company-profile\/([^/]+)$/);
 if(profile){const id=profile[1];if(user.role!=='MASTER'&&(user.role!=='BROKER'||user.company_id!==id))fail('Acesso não permitido.',403);
  const c=await db.prepare('SELECT id,name FROM companies WHERE id=?').bind(id).first();if(!c)fail('Imobiliária não encontrada.',404);
  const current=await latest(db,id);
  if(request.method==='GET')return json({company:c,profile:current});
  if(request.method!=='PUT')fail('Método não permitido.',405);
  const b=await bodyOf(request,600000);if(Object.keys(b).some(k=>!['previous_id','creci','fees_text','contact_email','logo','fees_image'].includes(k)))fail('Campo não permitido.',400);
  if((b.previous_id||null)!==(current?.id||null))fail('Configuração atualizada por outra pessoa. Reabra antes de salvar.',409);
  const creci=text(b.creci,40,true),fees=text(b.fees_text,4000,true),email=text(b.contact_email,254,true);if(!/^\S+@\S+\.\S+$/.test(email))fail('E-mail de contato inválido.',400);
  const pid=crypto.randomUUID();try{await db.batch([db.prepare('INSERT INTO company_profiles(id,company_id,previous_id,creci,fees_text,contact_email,logo,fees_image,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(pid,id,current?.id||null,creci,fees,email,image(b.logo||''),image(b.fees_image||''),user.id,Date.now()),db.prepare("INSERT INTO company_events VALUES(?,?,?,'PROFILE_UPDATED',?)").bind(crypto.randomUUID(),id,user.id,Date.now())]);}catch(e){if(String(e).includes('UNIQUE'))fail('Configuração alterada. Reabra antes de salvar.',409);throw e;}return json({ok:true,id:pid});
 }
 const m=url.pathname.match(/^\/api\/leads\/([^/]+)\/owner-forms(?:\/([^/]+)(?:\/(revoke|review))?)?$/);if(!m)return null;
 const lead=await db.prepare("SELECT * FROM leads WHERE id=? AND company_id IS ? AND (?<>'CAPTADOR' OR owner_id=?)").bind(m[1],user.company_id,user.role,user.id).first();if(!lead)fail('Captação não encontrada.',404);
 if(!lead.company_id)fail('A ficha está disponível para captações de imobiliárias.',400);
 if(!m[2]&&request.method==='GET'){const{results}=await db.prepare('SELECT id,created_at,expires_at,revoked_at,submitted_at,accepted,reviewed_at FROM owner_forms WHERE lead_id=? AND company_id=? ORDER BY created_at DESC LIMIT 100').bind(lead.id,lead.company_id).all();return json({forms:results});}
 if(!m[2]&&request.method==='POST'){
  if(!env.TURNSTILE_SITE_KEY||!env.TURNSTILE_SECRET_KEY)fail('A proteção da ficha ainda não foi configurada.',503);
  const p=await latest(db,lead.company_id);if(!p)fail('Peça ao Broker para configurar logo, CRECI e taxas em Imobiliária.',409);
  const c=await db.prepare('SELECT name FROM companies WHERE id=? AND active=1').bind(lead.company_id).first();if(!c)fail('Conta indisponível.',403);
  const token=hex(crypto.getRandomValues(new Uint8Array(32))),id=crypto.randomUUID(),now=Date.now(),expires=now+7*86400000;
  const privacy=`Os dados desta ficha serão recebidos pela ${c.name} para analisar o cadastro do imóvel e tratar a proposta de ${lead.purpose.toLowerCase()}. Eles serão acessados pelos responsáveis autorizados da imobiliária no CaptaBit. Para correções, dúvidas ou solicitação de exclusão, contate ${p.contact_email}. O aceite de divulgação é opcional e não corresponde a uma assinatura digital gov.br.`;
  await db.prepare('INSERT INTO owner_forms(id,company_id,lead_id,profile_id,token_hash,company_name,purpose,declaration,privacy_text,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,lead.company_id,lead.id,p.id,await digest(token),c.name,lead.purpose,declaration(c.name,p.creci,lead.purpose),privacy,user.id,now,expires).run();
  return json({id,url:url.origin+'/ficha.html#'+token,expires_at:expires},201);
 }
 const f=await db.prepare('SELECT * FROM owner_forms WHERE id=? AND lead_id=? AND company_id=?').bind(m[2]||'',lead.id,lead.company_id).first();if(!f)fail('Ficha não encontrada.',404);
 if(!m[3]&&request.method==='GET'){
  if(!f.submitted_at)fail('Ficha ainda não recebida.',409);const p=await db.prepare('SELECT creci,fees_text,contact_email,logo,fees_image FROM company_profiles WHERE id=?').bind(f.profile_id).first();
  return json({id:f.id,company_name:f.company_name,purpose:f.purpose,declaration:f.declaration,privacy_text:f.privacy_text,submitted_at:f.submitted_at,accepted:Boolean(f.accepted),reviewed_at:f.reviewed_at,response:JSON.parse(f.response_json),profile:p});
 }
 if(m[3]==='revoke'&&request.method==='POST'){if(f.submitted_at)fail('A resposta recebida deve ser preservada.',409);await db.prepare('UPDATE owner_forms SET revoked_at=? WHERE id=? AND submitted_at IS NULL').bind(Date.now(),f.id).run();return json({ok:true});}
 if(m[3]==='review'&&request.method==='POST'){if(!f.submitted_at)fail('Ficha ainda não recebida.',409);await db.prepare('UPDATE owner_forms SET reviewed_at=?,reviewed_by=? WHERE id=? AND reviewed_at IS NULL').bind(Date.now(),user.id,f.id).run();return json({ok:true});}
 fail('Método não permitido.',405);
}
