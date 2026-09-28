export function renderAlerts(container,alerts) {
  container.replaceChildren();
  if(!alerts) return;
  const add=value=>{const p=document.createElement('p');p.textContent=value;container.append(p);};
  if(alerts.items.length) {
    add('Atenção: possíveis duplicidades. Revise antes de iniciar um contato; procure o administrador se necessário.');
    for(const item of alerts.items) add(`${item.type} · ${item.owner_name} · ${item.status} · ${item.historical?'Registro histórico':'Em andamento'} · Início: ${new Date(item.created_at).toLocaleDateString('pt-BR')}`);
  }
  if(alerts.incomplete) add('Há dados de endereço incompletos ou registros ainda não indexados. A comparação não garante a ausência de duplicidades.');
  if(alerts.truncated) add('Existem mais correspondências do que as exibidas. Peça revisão ao administrador.');
  container.hidden=!container.childNodes.length;
}
export function confirmAlerts(alerts) {
  if(!alerts.items.length && !alerts.truncated) return Promise.resolve(true);
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog'); const title=document.createElement('h2'); title.textContent='Revise antes de continuar';
    const body=document.createElement('div'); renderAlerts(body,alerts); const actions=document.createElement('div'); actions.className='pager';
    const finish=value=>{dialog.close();dialog.remove();resolve(value);};
    for(const [label,value] of [['Voltar',false],['Li os avisos. Continuar',true]]) {const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>finish(value));actions.append(button);}
    dialog.append(title,body,actions);document.body.append(dialog);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.showModal();
  });
}
export function appendWhatsApp(card,contact,lead,api,message) {
  const action=document.createElement('button');action.type='button';action.textContent='Enviar mensagem de captação';
  action.className='whatsapp-action';
  action.disabled=['INCORRECT','NO_WHATSAPP'].includes(contact.outcome);
  action.title=action.disabled ? 'Altere a classificação se este contato voltar a ser válido para WhatsApp.' : 'Abre o WhatsApp com o texto preenchido. Você revisa e confirma o envio lá.';
  action.addEventListener('click',async()=>{
    action.disabled=true;message();
    try {
      const body={version:contact.version,templateId:'initial'};
      let result=await api(`leads/${lead.id}/whatsapp/${contact.id}`,'POST',body);
      if(result.reviewRequired) {
        if(!await confirmAlerts(result.duplicates)) return;
        result=await api(`leads/${lead.id}/whatsapp/${contact.id}`,'POST',{...body,acknowledge:true});
      }
      // Same-tab navigation works without asynchronous popup permissions.
      window.location.assign(result.url);
    } catch(error) {message(error.message);} finally {action.disabled=false;}
  });
  card.append(action);
}
export function confirmDeleteContact(phone) {
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');const title=document.createElement('h2');title.textContent='Excluir contato?';
    const text=document.createElement('p');text.textContent=`O telefone +${phone} sairá desta lista. A exclusão ficará registrada no histórico.`;
    const actions=document.createElement('div');actions.className='pager';
    const finish=value=>{dialog.close();dialog.remove();resolve(value);};
    for(const [label,value] of [['Cancelar',false],['Excluir contato',true]]) {const button=document.createElement('button');button.type='button';button.textContent=label;button.className=value?'danger':'secondary';button.addEventListener('click',()=>finish(value));actions.append(button);}
    dialog.append(title,text,actions);document.body.append(dialog);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.showModal();
  });
}
