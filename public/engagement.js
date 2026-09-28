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
  if(!alerts.items.length && !alerts.incomplete && !alerts.truncated) return Promise.resolve(true);
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog'); const title=document.createElement('h2'); title.textContent='Revise antes de continuar';
    const body=document.createElement('div'); renderAlerts(body,alerts); const actions=document.createElement('div'); actions.className='pager';
    const finish=value=>{dialog.close();dialog.remove();resolve(value);};
    for(const [label,value] of [['Voltar',false],['Li os avisos. Continuar',true]]) {const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>finish(value));actions.append(button);}
    dialog.append(title,body,actions);document.body.append(dialog);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.showModal();
  });
}
export function appendWhatsApp(card,contact,lead,template,api,message,onRecorded) {
  const label=document.createElement('label');label.textContent='Mensagem para revisar antes de abrir o WhatsApp';
  const textarea=document.createElement('textarea');textarea.value=template;textarea.maxLength=2000;textarea.rows=4;label.append(textarea);
  const note=document.createElement('p');note.textContent='Você revisa e envia no WhatsApp. Abrir a conversa não marca a mensagem como enviada.';
  const action=document.createElement('button');action.type='button';action.textContent='Abrir WhatsApp';
  const fallback=document.createElement('a');fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='Clique aqui para abrir a conversa no WhatsApp';fallback.hidden=true;
  action.addEventListener('click',async()=>{
    action.disabled=true;fallback.hidden=true;message();
    try {
      const body={message:textarea.value,version:contact.version};
      let result=await api(`leads/${lead.id}/whatsapp/${contact.id}`,'POST',body);
      if(result.reviewRequired) {
        if(!await confirmAlerts(result.duplicates)) return;
        result=await api(`leads/${lead.id}/whatsapp/${contact.id}`,'POST',{...body,acknowledge:true});
      }
      fallback.href=result.url;fallback.hidden=false;
      // The fallback remains available when the browser blocks an async popup.
      window.open(result.url,'_blank','noopener,noreferrer');
      await onRecorded();
    } catch(error) {message(error.message);} finally {action.disabled=false;}
  });
  card.append(label,note,action,fallback);
}
