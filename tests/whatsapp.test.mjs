import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappMessage,whatsappTemplates } from '../src/domain/whatsapp.js';
test('Modelo Criativa usa os dados da captação e do captador',()=>{
  const message=whatsappMessage({proprietor_name:'Nome Privado do Proprietário',type:'Apartamento',street:'Rua Tupinambá',purpose:'Locação'},{name:'Maikon'},'initial',new Date('2026-10-11T15:00:00Z'));
  assert.equal(message,'Boa tarde!\nSou Maikon, corretor de locações da Criativa Imóveis.\n\nEstou buscando o proprietário(a) de um apartamento que fica na Rua Tupinambá, que está anunciado para locação. Não sei se cheguei ao contato correto.\n\nCaso seja o responsável, podemos trabalhar a locação do imóvel pela Criativa?');
  const sale=whatsappMessage({type:'Casa',street:'Rua A',purpose:'Venda'},{name:'Carlos'});
  assert.match(sale,/Sou Carlos, corretor de imóveis/);
  assert.match(sale,/uma casa/); assert.match(sale,/trabalhar a venda/);
  assert.match(whatsappMessage({type:'Casa',street:'Rua A',purpose:'Locação'},{name:'admin'}),/Sou Maikon,/);
});

test('Modelos usam dados do imóvel sem revelar o nome do proprietário',()=>{
  for(const template of whatsappTemplates)for(const purpose of ['Venda','Locação']){
    const message=whatsappMessage({proprietor_name:'NOME-SECRETO',type:'Casa',street:'Rua A',purpose},{name:'Carlos'},template.id);
    assert.doesNotMatch(message,/NOME-SECRETO/);assert.match(message,/Carlos/);assert.match(message,/Rua A/);
    assert.ok(message.includes(purpose==='Venda'?'venda':'locação'));
  }
  assert.throws(()=>whatsappMessage({}, {}, 'invalid'),/Modelo/);
  assert.doesNotMatch(whatsappMessage({street:'Rua A',purpose:'Venda'},{name:'Carlos'},'confirmed'),/Não sei|Você é o responsável/);
});

test('Nome de administrador de outra empresa não vira Maikon',()=>{const text=whatsappMessage({street:'Rua X',purpose:'Venda'},{name:'admin',company_name:'Imobiliária X'});assert.match(text,/Sou admin,/);assert.match(text,/Imobiliária X/);assert.doesNotMatch(text,/Maikon|Criativa/);});

 test('Saudação acompanha horário de Brasília em todos os modelos, inclusive viradas',()=>{
  const cases=[['2026-10-11T03:00:00Z','Boa noite'],['2026-10-11T07:59:59Z','Boa noite'],['2026-10-11T08:00:00Z','Bom dia'],['2026-10-11T14:59:59Z','Bom dia'],['2026-10-11T15:00:00Z','Boa tarde'],['2026-10-11T20:59:59Z','Boa tarde'],['2026-10-11T21:00:00Z','Boa noite'],['2026-10-12T02:59:59Z','Boa noite']];
  for(const [time,greeting] of cases)for(const template of whatsappTemplates){
   const message=whatsappMessage({type:'Casa',street:'Rua A',purpose:'Locação'},{name:'Carlos'},template.id,new Date(time));
   assert.ok(message.startsWith(greeting),time+' '+template.id);
  }
 });
