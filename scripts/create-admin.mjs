import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hashPassword, passwordOptions } from '../src/domain/password.js';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const remote = process.argv.includes('--remote');
const resetMaster = process.argv.includes('--reset-master');
if (resetMaster && !remote) throw new Error('Redefinição administrativa disponível somente com --remote.');
if (process.argv.slice(2).some(arg => !['--remote','--reset-master'].includes(arg))) throw new Error('Argumento desconhecido. Use --remote somente para produção.');
const database = remote ? 'captabit-production' : 'captabit-local';
const config = remote ? 'wrangler.production.jsonc' : 'wrangler.local.jsonc';
const location = remote ? '--remote' : '--local';
const passwords = remote ? passwordOptions({PASSWORD_PROFILE:'cloudflare-v1',...JSON.parse(await readFile('.wrangler/production-auth.json','utf8'))}) : {};
console.log(remote ? 'Criando Master na PRODUÇÃO Cloudflare.' : 'Criando Master no ambiente LOCAL.');
// Validate database access before collecting credentials.
const preflight = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', database, location, '--config', config, '--command', 'UPDATE users SET active = active WHERE 0;'], { encoding: 'utf8' });
if (preflight.status !== 0) {
  const detail = `${preflight.stdout || ''}\n${preflight.stderr || ''}`;
  if (/SQLITE_READONLY|SQLITE_BUSY|database is locked/i.test(detail)) {
    console.error('O banco local está ocupado ou sem acesso de gravação. Pare npm run dev com Ctrl+C e execute npm run admin:create novamente. Se persistir, confira as permissões da pasta.');
  } else if (/no such table/i.test(detail)) {
    console.error('O banco ainda não foi preparado. Aplique as migrações do ambiente escolhido antes de criar o administrador.');
  } else {
    console.error('Não foi possível verificar a gravação no banco escolhido. Confira as permissões e o ambiente Wrangler. Nenhuma credencial foi solicitada.');
  }
  process.exit(1);
}
let name,email;
if (resetMaster) {
  const lookup = spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute',database,location,'--config',config,'--command',"SELECT name,email FROM users WHERE access_role='MASTER' AND deleted_at IS NULL;",'--json'],{encoding:'utf8'});
  if (lookup.status !== 0) throw new Error('Não foi possível consultar a conta Master.');
  const rows=JSON.parse(lookup.stdout)[0].results;
  if(rows.length!==1)throw new Error('Esperado exatamente um Master.');
  ({name,email}=rows[0]);console.log('Defina a senha de produção para: '+email);
} else {
  const prompt = createInterface({ input: stdin, output: stdout });
  name = (await prompt.question('Nome do administrador: ')).trim();
  email = (await prompt.question('E-mail: ')).trim().toLowerCase();
  prompt.close();
}
if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Nome ou e-mail inválido.');
async function passwordPrompt(label) {
  if (!stdin.isTTY) throw new Error('Execute em um terminal interativo para proteger a senha.');
  stdout.write(label); stdin.setRawMode(true); stdin.resume();
  return new Promise((resolve, reject) => {
    let password = '';
    const handler = chunk => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { finish(); reject(new Error('Cancelado.')); return; }
        if (char === '\r' || char === '\n') { finish(); resolve(password); return; }
        if (char === '\u007f' || char === '\b') password = password.slice(0, -1);
        else if (char >= ' ') password += char;
      }
    };
    const finish = () => { stdin.off('data', handler); stdin.setRawMode(false); stdin.pause(); stdout.write('\n'); };
    stdin.on('data', handler);
  });
}
const password = await passwordPrompt('Senha (não será exibida; mínimo 12 caracteres): ');
if (password !== await passwordPrompt('Repita a senha: ')) throw new Error('As senhas não coincidem.');
const hash = await hashPassword(password,passwords);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
await mkdir('.wrangler/bootstrap', { recursive: true });
const file = `.wrangler/bootstrap/${randomUUID()}.sql`;
try {
  await writeFile(file, resetMaster ? `UPDATE users SET password_hash=${quote(hash)} WHERE access_role='MASTER' AND email=${quote(email)}; DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE access_role='MASTER');` : `INSERT INTO users (id,name,email,password_hash,role,access_role,active,created_at) SELECT ${quote(randomUUID())},${quote(name)},${quote(email)},${quote(hash)},'ADMIN','MASTER',1,${Date.now()} WHERE NOT EXISTS (SELECT 1 FROM users WHERE access_role='MASTER');`, { mode: 0o600 });
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', database, location, '--config', config, '--file', file], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Falha na gravação. Pare o servidor local (Ctrl+C em npm run dev), confira as permissões da pasta e tente novamente.');
  if(remote){
    const base='https://captabit.maikonandreyleiria.workers.dev';
    const response=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,password,company:''})});
    if(response.status!==200)throw new Error('Senha salva, mas a verificação de login falhou (HTTP '+response.status+'). Avise no chat.');
    const cookie=response.headers.get('set-cookie')?.split(';')[0];
    if(cookie)await fetch(base+'/api/logout',{method:'POST',headers:{Origin:base,Cookie:cookie}});
    await writeFile('.wrangler/bootstrap/production-master-ready.json',JSON.stringify({verifiedAt:new Date().toISOString(),email}));
    console.log('Senha salva e login online verificado com sucesso. Pode voltar ao chat.');
  }else console.log('Procedimento concluído. Se já havia Master, nenhuma conta foi alterada.');
} finally { await rm(file, { force: true }); }
