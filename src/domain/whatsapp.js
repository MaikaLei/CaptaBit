export function whatsappMessage(lead,user) {
  const name = /^admin(istrador)?$/i.test(user.name.trim()) ? 'Maikon' : user.name;
  const rental = lead.purpose === 'Locação';
  const purpose = rental ? 'locação' : 'venda';
  const profession = rental ? 'corretor de locações' : 'corretor de imóveis';
  const types = { Casa:'uma casa', Apartamento:'um apartamento', Terreno:'um terreno', Comercial:'um imóvel comercial', Outro:'um imóvel' };
  const property = types[lead.type] || 'um imóvel';
  const location = lead.street ? ` na ${lead.street}` : ` em ${lead.city}`;
  return `Boa tarde!\nSou ${name}, ${profession} da Criativa Imóveis.\n\nEstou buscando o proprietário(a) de ${property} que fica${location}, que está anunciado para ${purpose}. Não sei se cheguei ao contato correto.\n\nCaso seja o responsável, podemos trabalhar a ${purpose} do imóvel pela Criativa?`;
}
export function whatsappUrl(phone,message) {
  if(!/^[1-9]\d{7,14}$/.test(phone)) throw new Error('Telefone inválido.');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
