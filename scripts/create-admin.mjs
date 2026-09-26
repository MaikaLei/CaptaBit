import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hashPassword } from '../src/domain/password.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const prompt = createInterface({ input: stdin, output: stdout });
const name = (await prompt.question('Nome do administrador: ')).trim();
const email = (await prompt.question('E-mail: ')).trim().toLowerCase();
prompt.close();
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
const hash = await hashPassword(password);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
await mkdir('.wrangler/bootstrap', { recursive: true });
const file = `.wrangler/bootstrap/${randomUUID()}.sql`;
try {
  await writeFile(file, `INSERT INTO users (id,name,email,password_hash,role,active,created_at) SELECT ${quote(randomUUID())},${quote(name)},${quote(email)},${quote(hash)},'ADMIN',1,${Date.now()} WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='ADMIN');`, { mode: 0o600 });
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'captabit-local', '--local', '--config', 'wrangler.local.jsonc', '--file', file], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Falha no cadastro. Execute npm run db:migrate primeiro.');
  console.log('Procedimento concluído. Se já havia ADMIN, nenhuma conta foi alterada. Entre na aplicação local para verificar.');
} finally { await rm(file, { force: true }); }
