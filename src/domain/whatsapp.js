export const whatsappTemplates = [
  {id:'initial',name:'Primeiro contato',description:'Quando ainda não sabe se o número é do responsável.'},
  {id:'confirmed',name:'Captação certeira',description:'Para telefone marcado como contato correto.',requiresCorrect:true},
  {id:'direct',name:'Abordagem direta',description:'Texto curto para confirmar o responsável.'},
  {id:'friendly',name:'Abordagem cordial',description:'Apresentação próxima, sem presumir quem responde.'}
];
const greetingHour = new Intl.DateTimeFormat('en-GB', {timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'});
export function whatsappGreeting(now = new Date()) {
  const hour = Number(greetingHour.format(now));
  return hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
}
export function whatsappMessage(lead,user,templateId='initial',now=new Date()) {
  if(!whatsappTemplates.some(template=>template.id===templateId)) throw new Error('Modelo de mensagem inválido.');
  const greeting = whatsappGreeting(now);
  const name = !user.company_name && /^admin(istrador)?$/i.test(user.name.trim()) ? 'Maikon' : user.name;
  const company=user.company_name || 'Criativa Imóveis';
  const closingCompany=user.company_name || 'Criativa';
  const rental = lead.purpose === 'Locação';
  const purpose = lead.purpose === 'Locação e venda' ? 'locação ou venda' : rental ? 'locação' : 'venda';
  const profession = rental ? 'corretor de locações' : 'corretor de imóveis';
  const types = { Casa:'uma casa', Apartamento:'um apartamento', Terreno:'um terreno', Comercial:'um imóvel comercial', Outro:'um imóvel' };
  const property = types[lead.type] || 'um imóvel';
  const location = lead.street ? ` na ${lead.street}` : ` em ${lead.city}`;
  if(templateId==='confirmed') return `${greeting}!\nSou ${name}, ${profession} da ${company}.\n\nEstou entrando em contato sobre o imóvel que fica${location}, anunciado para ${purpose}.\n\nPodemos trabalhar a ${purpose} do seu imóvel pela ${closingCompany}?`;
  if(templateId==='direct') return `${greeting}! Sou ${name}, ${profession} da ${company}.\n\nVocê é o responsável pelo imóvel${location}, anunciado para ${purpose}? Caso seja, podemos trabalhar a ${purpose} pela ${closingCompany}?`;
  if(templateId==='friendly') return `${greeting}, tudo bem?\nSou ${name}, ${profession} da ${company}.\n\nVi o anúncio de ${property}${location} para ${purpose} e gostaria de conversar com o proprietário(a). Não sei se este é o contato correto.\n\nSe você for o responsável, podemos conversar sobre trabalhar a ${purpose} do imóvel pela ${closingCompany}?`;
  return `${greeting}!\nSou ${name}, ${profession} da ${company}.\n\nEstou buscando o proprietário(a) de ${property} que fica${location}, que está anunciado para ${purpose}. Não sei se cheguei ao contato correto.\n\nCaso seja o responsável, podemos trabalhar a ${purpose} do imóvel pela ${closingCompany}?`;
}
export function whatsappUrl(phone,message) {
  if(!/^[1-9]\d{7,14}$/.test(phone)) throw new Error('Telefone inválido.');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
