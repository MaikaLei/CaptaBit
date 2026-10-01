export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
export function addressKeys(lead) {
  let street = normalize(lead.street).replace(/^av\b/,'avenida').replace(/^r\b/,'rua').replace(/^trav\b/,'travessa').replace(/^rod\b/,'rodovia');
  let number = normalize(lead.number);
  if (['sn','s n','sem numero','desconhecido'].includes(number)) number='';
  number=number.replace(/^0+(?=\d)/,'');
  const complement=normalize(lead.complement).replace(/^(ap|apt|apto)\b/,'apartamento');
  return { city_key:normalize(lead.city),street_key:street,number_key:number,complement_key:complement,state_key:normalize(lead.state) };
}
export const keyFields = ['city_key','street_key','number_key','complement_key','state_key'];
export function matchAddress(a,b) {
  if (a.city_key!==b.city_key || a.street_key!==b.street_key) return null;
  if (a.state_key && b.state_key && a.state_key!==b.state_key) return null;
  if (a.number_key && b.number_key && a.number_key!==b.number_key) return null;
  if (a.complement_key && b.complement_key && a.complement_key!==b.complement_key) return null;
  return a.number_key && b.number_key && a.state_key && b.state_key && a.complement_key===b.complement_key ? 'Endereço correspondente' : 'Possível endereço correspondente (dados incompletos)';
}
