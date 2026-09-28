export function whatsappMessage(lead,user) {
  const location=lead.district ? ` no bairro ${lead.district}` : ` em ${lead.city}`;
  return `Olá! Sou ${user.name}. Estou buscando o proprietário ou responsável por um imóvel${location}, anunciado para ${lead.purpose.toLowerCase()}. Cheguei ao contato correto? Se for o responsável, podemos conversar sobre a ${lead.purpose.toLowerCase()} do imóvel?`;
}
export function whatsappUrl(phone,message) {
  if(!/^[1-9]\d{7,14}$/.test(phone)) throw new Error('Telefone inválido.');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
