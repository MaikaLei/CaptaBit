export const leadStatuses = ['Nova','Em pesquisa','Em contato','Proprietário localizado','Em negociação','Captado','Recusado','Já alugado','Encerrado'];
export const contactStatuses = ['Não contatado','Mensagem enviada','Aguardando resposta','Contato incorreto','Proprietário/Responsável localizado','Sem resposta','Não possui WhatsApp'];
export const propertyTypes = ['Casa','Apartamento','Terreno','Comercial','Outro'];
export const terminalStatuses = ['Captado','Recusado','Já alugado','Encerrado'];
export const leadFields = ['proprietor_name','type','purpose','street','number','complement','district','city','state','postal_code','source','source_url','notes'];
export const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
export function text(value, max = 200) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) invalid('Texto inválido ou muito longo.');
  return value.trim();
}
export function phone(value) {
  const raw = text(value, 40);
  if (!/^[+\d\s().-]+$/.test(raw)) invalid('Informe um telefone válido com DDD.');
  let digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+') && [10,11].includes(digits.length)) digits = '55' + digits;
  if (!/^[1-9]\d{7,14}$/.test(digits)) invalid('Informe um telefone válido com DDD.');
  if (digits.startsWith('55') && (![12,13].includes(digits.length) || digits[2] === '0')) invalid('Telefone brasileiro deve incluir DDD e número.');
  return digits;
}
export function leadInput(body) {
  const result = Object.fromEntries(leadFields.map(key => [key, text(body[key], key === 'notes' ? 2000 : key === 'source_url' ? 1000 : 200)]));
  if (!result.proprietor_name) invalid('Preencha o nome do proprietário.');
  if (!propertyTypes.includes(result.type) || !['Venda','Locação'].includes(result.purpose) || !result.street || !result.city) invalid('Preencha tipo, finalidade, logradouro e cidade.');
  if (result.state && !/^[A-Za-z]{2}$/.test(result.state)) invalid('Informe a UF com duas letras.');
  result.state = result.state.toUpperCase();
  if (result.source_url) {
    try { if (!['http:','https:'].includes(new URL(result.source_url).protocol)) throw new Error(); }
    catch { invalid('O link de origem deve começar com http:// ou https://.'); }
  }
  return result;
}
