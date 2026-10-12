export const contactOutcomes = [
  { id:'UNKNOWN',name:'Não verificado',tone:'neutral' },
  { id:'CORRECT',name:'Contato correto',tone:'correct' },
  { id:'INCORRECT',name:'Contato errado',tone:'incorrect' },
  { id:'NO_RESPONSE',name:'Sem retorno',tone:'neutral' },
  { id:'NO_WHATSAPP',name:'Sem WhatsApp',tone:'neutral' }
];
// The initial-contact result is independent of the property's acquisition stage.
export function outcomeFromStatus(status) {
  return ({'Contato incorreto':'INCORRECT','Proprietário/Responsável localizado':'CORRECT','Sem resposta':'NO_RESPONSE','Não possui WhatsApp':'NO_WHATSAPP'})[status];
}
