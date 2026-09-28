import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappMessage } from '../src/domain/whatsapp.js';
test('Modelo Criativa usa os dados da captação e do captador',()=>{
  const message=whatsappMessage({type:'Apartamento',street:'Rua Tupinambá',purpose:'Locação'},{name:'Maikon'});
  assert.equal(message,'Boa tarde!\nSou Maikon, corretor de locações da Criativa Imóveis.\n\nEstou buscando o proprietário(a) de um apartamento que fica na Rua Tupinambá, que está anunciado para locação. Não sei se cheguei ao contato correto.\n\nCaso seja o responsável, podemos trabalhar a locação do imóvel pela Criativa?');
  const sale=whatsappMessage({type:'Casa',street:'Rua A',purpose:'Venda'},{name:'Carlos'});
  assert.match(sale,/Sou Carlos, corretor de imóveis/);
  assert.match(sale,/uma casa/); assert.match(sale,/trabalhar a venda/);
  assert.match(whatsappMessage({type:'Casa',street:'Rua A',purpose:'Locação'},{name:'admin'}),/Sou Maikon,/);
});
