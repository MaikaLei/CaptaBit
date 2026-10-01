import {userActionDialog} from './user-actions.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export async function mountCompanies(api,message) {
 const root=document.getElementById('companies-panel');root.replaceChildren();root.append(el('h2','Imobiliárias'),el('p','Cadastre a imobiliária e seu Broker. Ela começa sem imóveis e com até 3 captadores ativos. Seus dados antigos permanecem na área reservada do Master.'));
 const form=el('form');form.className='form-grid';
 for(const [name,title,type,max] of [['name','Nome da imobiliária','text',100],['slug','Código de acesso (ex.: criativa)','text',50],['broker_name','Nome do Broker / gerente','text',100],['broker_email','E-mail do Broker','email',254],['password','Senha inicial do Broker','password',128],['confirm','Repita a senha','password',128]]){
  const label=el('label',title),input=el('input');input.name=name;input.type=type;input.required=true;input.maxLength=max;if(type==='password'){input.minLength=12;input.autocomplete='new-password';}if(name==='slug'){input.pattern='[a-z0-9][a-z0-9-]{1,48}[a-z0-9]';}label.append(input);form.append(label);
 }
 const submit=el('button','Cadastrar imobiliária e Broker');submit.type='submit';form.append(submit);root.append(form);const list=el('div');root.append(list);
 form.addEventListener('submit',async event=>{event.preventDefault();message();const data=Object.fromEntries(new FormData(form));if(data.password!==data.confirm){message('As senhas não conferem.');return;}delete data.confirm;submit.disabled=true;try{await api('companies','POST',data);form.reset();await load();message('Imobiliária e Broker cadastrados. Compartilhe o link de acesso e a senha com o Broker.');}catch(error){message(error.message);}finally{submit.disabled=false;}});
 async function load(){const data=await api('companies');list.replaceChildren();if(!data.companies.length)list.append(el('p','Nenhuma imobiliária cadastrada. Use o formulário acima para criar a primeira.'));if(data.truncated)list.append(el('p','Mostrando as 200 imobiliárias mais recentes.'));
  for(const company of data.companies){const card=el('article');card.className='contact-card';card.append(el('h3',company.name),el('p',`${company.active?'Ativa':'Bloqueada'} · ${company.captadores}/${company.captador_limit} captadores ativos · Broker: ${company.broker_name}`));
   const link=el('a','Abrir acesso da imobiliária');link.href='/?conta='+encodeURIComponent(company.slug);link.target='_blank';link.rel='noopener noreferrer';card.append(link,el('small',new URL(link.href).href));
   const actions=el('div');actions.className='user-actions';const block=el('button',company.active?'Bloquear imobiliária':'Liberar imobiliária');block.type='button';block.className='secondary';block.addEventListener('click',async()=>{block.disabled=true;try{await api('companies/'+company.id,'PATCH',{active:!company.active});await load();message('Acesso da imobiliária atualizado. As sessões foram encerradas.');}catch(error){message(error.message);block.disabled=false;}});
   const reset=el('button','Redefinir senha do Broker');reset.type='button';reset.className='secondary';reset.addEventListener('click',()=>userActionDialog({id:company.broker_id,name:company.broker_name,email:company.broker_email},'password',api,()=>message('Senha do Broker redefinida.')));actions.append(block,reset);card.append(actions);list.append(card);
  }
 }
 await load();
}
