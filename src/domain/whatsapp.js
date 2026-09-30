export const whatsappTemplates = [
  {id:'initial',name:'Primeiro contato',description:'Quando ainda não sabe se o número é do responsável.'},
  {id:'confirmed',name:'Captação certeira',description:'Para telefone marcado como contato correto.',requiresCorrect:true},
  {id:'direct',name:'Abordagem direta',description:'Texto curto para confirmar o responsável.'},
  {id:'friendly',name:'Abordagem cordial',description:'Apresentação próxima, sem presumir quem responde.'}
];
export function whatsappMessage(lead,user,templateId='initial') {
  if(!whatsappTemplates.some(template=>template.id===templateId)) throw new Error('Modelo de mensagem inválido.');
  const name = /^admin(istrador)?$/i.test(user.name.trim()) ? 'Maikon' : user.name;
  const rental = lead.purpose === 'Locação';
  const purpose = rental ? 'locação' : 'venda';
  const profession = rental ? 'corretor de locações' : 'corretor de imóveis';
  const types = { Casa:'uma casa', Apartamento:'um apartamento', Terreno:'um terreno', Comercial:'um imóvel comercial', Outro:'um imóvel' };
  const property = types[lead.type] || 'um imóvel';
  const location = lead.street ? ` na ${lead.street}` : ` em ${lead.city}`;
  if(templateId==='confirmed') return `Boa tarde!\nSou ${name}, ${profession} da Criativa Imóveis.\n\nEstou entrando em contato sobre o imóvel que fica${location}, anunciado para ${purpose}.\n\nPodemos trabalhar a ${purpose} do seu imóvel pela Criativa?`;
  if(templateId==='direct') return `Olá! Sou ${name}, ${profession} da Criativa Imóveis.\n\nVocê é o responsável pelo imóvel${location}, anunciado para ${purpose}? Caso seja, podemos trabalhar a ${purpose} pela Criativa?`;
  if(templateId==='friendly') return `Olá, tudo bem?\nSou ${name}, ${profession} da Criativa Imóveis.\n\nVi o anúncio de ${property}${location} para ${purpose} e gostaria de conversar com o proprietário(a). Não sei se este é o contato correto.\n\nSe você for o responsável, podemos conversar sobre trabalhar a ${purpose} do imóvel pela Criativa?`;
  return `Boa tarde!\nSou ${name}, ${profession} da Criativa Imóveis.\n\nEstou buscando o proprietário(a) de ${property} que fica${location}, que está anunciado para ${purpose}. Não sei se cheguei ao contato correto.\n\nCaso seja o responsável, podemos trabalhar a ${purpose} do imóvel pela Criativa?`;
}
export function whatsappUrl(phone,message) {
  if(!/^[1-9]\d{7,14}$/.test(phone)) throw new Error('Telefone inválido.');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
