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
export function appendWhatsApp(card,contact,lead,api,message,templates) {
  const label=document.createElement('label');label.textContent='Modelo da mensagem';
  const select=document.createElement('select');select.setAttribute('aria-label',`Modelo da mensagem para +${contact.phone}`);
  for(const template of templates){const option=document.createElement('option');option.value=template.id;option.textContent=template.name;option.disabled=Boolean(template.requiresCorrect && contact.outcome!=='CORRECT');select.append(option);}
  select.value='initial';label.append(select);
  const hint=document.createElement('small');hint.textContent=templates.find(t=>t.id===select.value)?.description||'';label.append(hint);
  select.addEventListener('change',()=>{hint.textContent=templates.find(t=>t.id===select.value)?.description||'';fallback.hidden=true;});
  const action=document.createElement('button');action.type='button';action.textContent='Enviar mensagem de captação';
  action.className='whatsapp-action';
  action.disabled=['INCORRECT','NO_WHATSAPP'].includes(contact.outcome);
  action.title=action.disabled ? 'Altere a classificação se este contato voltar a ser válido para WhatsApp.' : 'Abre o WhatsApp com o texto preenchido. Você revisa e confirma o envio lá.';
  const fallback=document.createElement('a');fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.hidden=true;fallback.textContent='Abrir WhatsApp em nova guia';
  action.addEventListener('click',async()=>{
    action.disabled=true;select.disabled=true;message();fallback.hidden=true;
    // Reserve the tab during the click so popup blockers allow the later navigation.
    const whatsappTab=window.open('about:blank','_blank');
    if(whatsappTab) whatsappTab.opener=null;
    let opened=false;
    try {
      const body={version:contact.version,templateId:select.value};
      let result=await api(`leads/${lead.id}/whatsapp/${contact.id}`,'POST',body);
      if(result.reviewRequired) {
        if(!await confirmAlerts(result.duplicates)) return;
        result=await api(`leads/${lead.id}/whatsapp/${contact.id}`,'POST',{...body,acknowledge:true});
      }
      if(whatsappTab && !whatsappTab.closed) {whatsappTab.location.replace(result.url);opened=true;}
      else {fallback.href=result.url;fallback.hidden=false;message('Clique em Abrir WhatsApp em nova guia para continuar.');}
    } catch(error) {message(error.message);} finally {if(!opened && whatsappTab && !whatsappTab.closed) whatsappTab.close();action.disabled=false;select.disabled=false;}
  });
  card.append(label,action,fallback);
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
