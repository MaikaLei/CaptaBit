export function userActionDialog(user,mode,api,onSuccess) {
  const resetting=mode==='password';const dialog=document.createElement('dialog');
  const title=document.createElement('h2');title.textContent=resetting?'Redefinir senha':'Excluir usuário';
  const description=document.createElement('p');description.textContent=resetting?`Defina uma nova senha para ${user.name} (${user.email}). As sessões abertas serão encerradas.`:`Excluir ${user.name} (${user.email})? O acesso será bloqueado e o usuário sairá da lista. As captações e o histórico serão preservados e continuarão disponíveis ao administrador.`;
  const form=document.createElement('form');const error=document.createElement('p');error.setAttribute('role','alert');
  let password,confirmation;
  if(resetting)for(const [name,labelText] of [['password','Nova senha'],['confirmation','Repita a nova senha']]){
    const label=document.createElement('label');label.textContent=labelText;const input=document.createElement('input');input.type='password';input.name=name;input.required=true;input.minLength=12;input.maxLength=128;input.autocomplete='new-password';label.append(input);form.append(label);if(name==='password')password=input;else confirmation=input;
  }
  if(resetting){const hint=document.createElement('small');hint.textContent='De 12 a 128 caracteres. Informe a nova senha ao usuário por um canal privado.';form.append(hint);}
  const actions=document.createElement('div');actions.className='user-actions';const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Cancelar';
  const submit=document.createElement('button');submit.type='submit';submit.textContent=resetting?'Salvar nova senha':'Excluir usuário';if(!resetting)submit.className='danger';actions.append(cancel,submit);form.append(error,actions);
  let busy=false;const close=()=>{form.reset();dialog.close();dialog.remove();};cancel.addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)close();});
  form.addEventListener('submit',async event=>{event.preventDefault();error.textContent='';
    if(resetting && password.value!==confirmation.value){error.textContent='As senhas não conferem.';confirmation.focus();return;}
    busy=true;submit.disabled=true;cancel.disabled=true;
    try{const result=await api(`users/${user.id}${resetting?'/password':''}`,resetting?'POST':'DELETE',resetting?{password:password.value}:undefined);close();await onSuccess(result);}
    catch(failure){if(dialog.isConnected){error.textContent=failure.message;busy=false;submit.disabled=false;cancel.disabled=false;}}
  });
  dialog.append(title,description,form);document.body.append(dialog);dialog.showModal();if(password)password.focus();else cancel.focus();
}
