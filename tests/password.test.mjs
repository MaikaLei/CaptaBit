import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,passwordOptions,dummyPasswordHash} from '../src/domain/password.js';
test('Proteção de produção exige segredo e rejeita senha, segredo e formato incorretos',async()=>{
 const options=passwordOptions({PASSWORD_PROFILE:'cloudflare-v1',AUTH_PEPPER:'12'.repeat(32)});
 const password='Senha-teste-segura-123!';
 const a=await hashPassword(password,options),b=await hashPassword(password,options);
 assert.notEqual(a,b);assert.match(a,/^pbkdf2-sha256-hmac-v1\$100000\$/);
 assert.equal(await verifyPassword(password,a,options),true);
 assert.equal(await verifyPassword('senha-incorreta',a,options),false);
 assert.equal(await verifyPassword(password,a,{pepper:'34'.repeat(32)}),false);
 assert.equal(await verifyPassword(password,a),false);
 assert.equal(await verifyPassword(password,await hashPassword(password),options),false);
 assert.equal(await verifyPassword(password,a.replace('$100000$','$600000$'),options),false);
 assert.equal(await verifyPassword(password,dummyPasswordHash(options),options),false);
 assert.throws(()=>passwordOptions({PASSWORD_PROFILE:'cloudflare-v1'}));
});
