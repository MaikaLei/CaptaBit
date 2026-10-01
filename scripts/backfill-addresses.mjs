import { spawnSync } from 'node:child_process';
import { mkdir,writeFile,rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { addressKeys,keyFields } from '../src/domain/duplicates.js';
const base=['node_modules/wrangler/bin/wrangler.js','d1','execute','captabit-local','--local','--config','wrangler.local.jsonc'];
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
await mkdir('.wrangler/backfill',{recursive:true});
let count=0;
while(true) {
  const result=spawnSync(process.execPath,[...base,'--json','--command','SELECT id,city,street,number,complement,state FROM leads WHERE key_version=0 LIMIT 100'],{encoding:'utf8'});
  if(result.status!==0) throw new Error('Não foi possível ler endereços. Pare o servidor e aplique as migrações locais.');
  let rows; try {rows=JSON.parse(result.stdout)[0].results;} catch {throw new Error('Resposta inesperada do Wrangler.');}
  if(!rows.length) break;
  const file=`.wrangler/backfill/${randomUUID()}.sql`;
  try {
    await writeFile(file,rows.map(row=>{const keys=addressKeys(row);return `UPDATE leads SET ${keyFields.map(key=>`${key}=${quote(keys[key])}`).join(',')},key_version=1 WHERE id=${quote(row.id)} AND key_version=0;`;}).join('\n'),{mode:0o600});
    const update=spawnSync(process.execPath,[...base,'--file',file],{encoding:'utf8'});
    if(update.status!==0) throw new Error('Falha ao indexar endereços. Nenhum dado original foi apagado; execute novamente.');
    count+=rows.length;
  } finally {await rm(file,{force:true});}
}
console.log(`${count} endereço(s) indexado(s). Os dados originais e históricos foram preservados.`);
