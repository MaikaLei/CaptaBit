import {hashPassword,validPassword} from '../domain/password.js';
export async function companyRoutes(request,db,user,{json,fail,bodyOf}) {
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/companies'))return null;
 if(user.role!=='MASTER')fail('Acesso exclusivo do Master.',403);
 if(path==='/api/companies' && request.method==='GET') {
  const {results}=await db.prepare("SELECT c.*,u.id AS broker_id,u.name AS broker_name,u.email AS broker_email,(SELECT COUNT(*) FROM users x WHERE x.company_id=c.id AND x.access_role='CAPTADOR' AND x.active=1 AND x.deleted_at IS NULL) AS captadores FROM companies c LEFT JOIN users u ON u.company_id=c.id AND u.access_role='BROKER' AND u.deleted_at IS NULL ORDER BY c.created_at DESC,c.id LIMIT 201").all();
  return json({companies:results.slice(0,200),truncated:results.length>200});
 }
 if(path==='/api/companies' && request.method==='POST') {
  const body=await bodyOf(request);
  if(Object.keys(body).some(k=>!['name','slug','broker_name','broker_email','password'].includes(k)))fail('Campo não permitido.',400);
  const name=typeof body.name==='string'?body.name.trim():'';const slug=typeof body.slug==='string'?body.slug.trim().toLowerCase():'';
  const broker=typeof body.broker_name==='string'?body.broker_name.trim():'';const email=typeof body.broker_email==='string'?body.broker_email.trim().toLowerCase():'';
  if(!name || name.length>100 || !/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug) || ['master','api','assets'].includes(slug) || !broker || broker.length>100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !validPassword(body.password))fail('Confira nome, código (3 a 50 letras/números/hífens), Broker, e-mail e senha de 12 a 128 caracteres.',400);
  const id=crypto.randomUUID(),brokerId=crypto.randomUUID(),now=Date.now();const hash=await hashPassword(body.password);
  try{await db.batch([
   db.prepare('INSERT INTO companies (id,slug,name,created_at) VALUES (?,?,?,?)').bind(id,slug,name,now),
   db.prepare("INSERT INTO users (id,name,email,password_hash,role,access_role,company_id,created_at) VALUES (?,?,?,?,'ADMIN','BROKER',?,?)").bind(brokerId,broker,email,hash,id,now),
   db.prepare("INSERT INTO company_events VALUES (?,?,?,'COMPANY_CREATED',?)").bind(crypto.randomUUID(),id,user.id,now)
  ]);}catch(error){if(String(error).includes('UNIQUE'))fail('Código da imobiliária ou e-mail já cadastrado.',409);throw error;}
  return json({id,slug},201);
 }
 const match=path.match(/^\/api\/companies\/([^/]+)$/);
 if(match && request.method==='PATCH'){
  const body=await bodyOf(request);if(typeof body.active!=='boolean' || Object.keys(body).some(k=>k!=='active'))fail('Alteração inválida.',400);
  if(!await db.prepare('SELECT id FROM companies WHERE id=?').bind(match[1]).first())fail('Imobiliária não encontrada.',404);
  await db.batch([
   db.prepare('UPDATE companies SET active=? WHERE id=?').bind(Number(body.active),match[1]),
   db.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id=?)').bind(match[1]),
   db.prepare('INSERT INTO company_events VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),match[1],user.id,body.active?'COMPANY_ENABLED':'COMPANY_BLOCKED',Date.now())
  ]);return json({ok:true});
 }
 return json({error:'Não encontrado.'},404);
}
