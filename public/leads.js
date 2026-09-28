import { renderAlerts,confirmAlerts,appendWhatsApp } from './engagement.js';
const labels = { type:'Tipo do imóvel',purpose:'Finalidade',street:'Logradouro',number:'Número (se conhecido)',complement:'Complemento / unidade',district:'Bairro',city:'Cidade',state:'UF',postal_code:'CEP',source:'Origem',source_url:'Link de origem',notes:'Observações',status:'Status',owner_id:'Responsável',name:'Nome',phone:'Telefone com DDD' };
const element = (tag, value, className) => { const node = document.createElement(tag); if (value !== undefined) node.textContent=value; if (className) node.className=className; return node; };
const button = (label, action, className='secondary') => { const node=element('button',label,className); node.type='button'; node.addEventListener('click',action); return node; };
function field(form,key,value='',choices) {
  const label=element('label',labels[key] || key); let input;
  if (choices) { input=element('select'); for (const item of choices) { const option=element('option', typeof item==='string' ? item : item.name); option.value=typeof item==='string' ? item : item.id; input.append(option); } }
  else input=element(key==='notes' ? 'textarea' : 'input');
  input.name=key; input.value=value ?? ''; input.maxLength=key==='notes'?2000:key==='source_url'?1000:200;
  if (['type','purpose','street','city'].includes(key)) input.required=true;
  if (key==='phone') { input.type='tel'; input.required=true; input.maxLength=40; }
  label.append(input); form.append(label); return input;
}
function bindForm(form,submitLabel,action,message) {
  const submit=element('button',submitLabel); submit.type='submit'; form.append(submit);
  form.addEventListener('submit',async event=>{ event.preventDefault(); submit.disabled=true; message(); try { await action(Object.fromEntries(new FormData(form))); } catch(error) { message(error.message); } finally { submit.disabled=false; } });
}
export async function mountLeads(api,user,message) {
  const root=document.getElementById('leads-panel'); root.replaceChildren();
  const options=await api('lead-options'); let page=0; let query=''; let filter=''; let owners=[];
  if (user.role==='ADMIN') owners=(await api('users')).users;
  const heading=element('div',undefined,'section-heading'); heading.append(element('h2',user.role==='ADMIN'?'Captações da equipe':'Minhas captações')); root.append(heading);
  const create=element('form',undefined,'lead-form'); create.hidden=true;
  heading.append(button('+ Nova captação',()=>{ create.hidden=!create.hidden; if(!create.hidden) create.querySelector('select').focus(); },'primary'));
  root.append(element('p','Cadastre o essencial e complemente durante a pesquisa.'));
  const warning=element('p','Endereços e telefones são comparados entre as carteiras. Alertas não impedem o cadastro; revise-os antes de contatar.','note-inline'); root.append(warning);
  const basic=element('div',undefined,'form-grid'); create.append(basic);
  field(basic,'type','Casa',options.propertyTypes); field(basic,'purpose','Locação',['Locação','Venda']);
  for(const key of ['street','number','district','city']) field(basic,key);
  const more=element('details'); more.append(element('summary','Mais informações')); const extra=element('div',undefined,'form-grid'); more.append(extra); create.append(more);
  for(const key of ['complement','state','postal_code','source','source_url','notes']) field(extra,key);
  const phoneLabel=element('label','Possíveis telefones (opcional; um por linha)'); const phones=element('textarea'); phones.name='phones'; phones.rows=2; phones.maxLength=400; phoneLabel.append(phones); create.append(phoneLabel);
  bindForm(create,'Salvar captação',async data=>{ data.phones=data.phones.split(/[;\n]/).map(x=>x.trim()).filter(Boolean); const check=await api('leads/duplicates','POST',data); if(!await confirmAlerts(check.duplicates)) return; const result=await api('leads','POST',data); create.reset(); create.hidden=true; page=0; await load(); await openLead(result.lead.id); },message); root.append(create);
  const search=element('form',undefined,'search-bar'); const searchLabel=element('label','Buscar endereço, bairro, cidade, nome ou telefone'); const searchInput=element('input'); searchInput.name='q'; searchInput.maxLength=100; searchLabel.append(searchInput); search.append(searchLabel); field(search,'status','',['',...options.leadStatuses]);
  bindForm(search,'Buscar',async data=>{ query=data.q; filter=data.status; page=0; await load(); },message); root.append(search);
  const list=element('div',undefined,'lead-list'); const pager=element('div',undefined,'pager'); const detail=element('section',undefined,'lead-detail'); root.append(list,pager,detail);
  async function load() {
    const result=await api(`leads?${new URLSearchParams({q:query,status:filter,page:String(page)})}`); list.replaceChildren(); pager.replaceChildren();
    if(!result.leads.length) list.append(element('p','Nenhuma captação encontrada.'));
    for(const lead of result.leads) {
      const row=element('article',undefined,'lead-row'); const title=button(`${lead.type} · ${lead.street}${lead.number?', '+lead.number:''}`,()=>openLead(lead.id).catch(error=>message(error.message)),'lead-link');
      const info=element('div'); info.append(title,element('p',`${lead.district ? lead.district+' · ':''}${lead.city} · ${lead.purpose}${user.role==='ADMIN'?' · '+lead.owner_name:''}`));
      const meta=element('div'); meta.append(element('span',lead.status,'badge'),element('small',`${lead.contacts_count} contato(s)`)); row.append(info,meta); list.append(row);
    }
    pager.append(button('Anterior',()=>{ page--; load().catch(error=>message(error.message)); })); pager.firstChild.disabled=page===0;
    pager.append(element('span',`Página ${page+1}`),button('Próxima',()=>{ page++; load().catch(error=>message(error.message)); })); pager.lastChild.disabled=!result.hasMore;
  }
  async function openLead(id) {
    const {lead,contacts,duplicates,messageTemplate}=await api(`leads/${id}`); detail.replaceChildren(); detail.append(element('h2',`${lead.type} · ${lead.street}`));
    detail.append(button('Fechar detalhes',()=>detail.replaceChildren()));
    const alertBox=element('aside',undefined,'note-inline'); renderAlerts(alertBox,duplicates); detail.append(alertBox);
    const edit=element('form',undefined,'lead-form'); const grid=element('div',undefined,'form-grid'); edit.append(grid);
    field(grid,'type',lead.type,options.propertyTypes); field(grid,'purpose',lead.purpose,['Locação','Venda']);
    for(const key of ['street','number','complement','district','city','state','postal_code','source','source_url','notes']) field(grid,key,lead[key]);
    field(grid,'status',lead.status,options.leadStatuses);
    if(user.role==='ADMIN') field(grid,'owner_id',lead.owner_id,owners.filter(owner=>owner.active||owner.id===lead.owner_id).map(owner=>({id:owner.id,name:owner.name})));
    bindForm(edit,'Salvar alterações',async data=>{ await api(`leads/${id}`,'PATCH',{...data,version:lead.version}); await load(); await openLead(id); message('Captação atualizada.'); },message); detail.append(edit);
    detail.append(element('h3','Possíveis contatos'));
    if(!contacts.length) detail.append(element('p','Nenhum telefone cadastrado ainda.'));
    for(const contact of contacts) {
      const card=element('details',undefined,'contact-card'); card.append(element('summary',`${contact.name || 'Contato'} · +${contact.phone} · ${contact.status}`));
      const form=element('form',undefined,'form-grid'); field(form,'name',contact.name); field(form,'phone','+'+contact.phone); field(form,'status',contact.status,options.contactStatuses); field(form,'notes',contact.notes);
      bindForm(form,'Salvar contato',async data=>{ await api(`leads/${id}/contacts/${contact.id}`,'PATCH',{...data,version:contact.version}); await openLead(id); },message); card.append(form); appendWhatsApp(card,contact,lead,messageTemplate,api,message,async()=>{ history.replaceChildren(); cursor=undefined; await loadHistory(); }); detail.append(card);
    }
    const add=element('form',undefined,'form-grid'); add.append(element('h3','Adicionar telefone')); field(add,'name'); field(add,'phone');
    bindForm(add,'Adicionar contato',async data=>{ await api(`leads/${id}/contacts`,'POST',data); await load(); await openLead(id); },message); detail.append(add);
    detail.append(element('h3','Histórico')); const history=element('ol',undefined,'history'); const moreEvents=button('Carregar eventos anteriores',()=>loadHistory().catch(error=>message(error.message))); detail.append(history,moreEvents); let cursor;
    async function loadHistory() {
      const result=await api(`leads/${id}/history${cursor?'?before='+cursor:''}`);
      for(const event of result.events) {
        const row=element('li'); row.append(element('strong',event.event),element('small',`${event.actor_name} · ${new Date(event.created_at).toLocaleString('pt-BR')}`));
        for(const [key,value] of Object.entries(event.after)) {
          if(event.before && event.before[key]===value) continue;
          const readable=v=> key==='owner_id' ? owners.find(owner=>owner.id===v)?.name || 'Responsável registrado' : v || '—';
          row.append(element('span',`${labels[key] || key}: ${event.before?readable(event.before[key])+' → ':''}${readable(value)}`));
        }
        history.append(row);
      }
      cursor=result.next; moreEvents.hidden=!cursor;
    }
    await loadHistory(); detail.scrollIntoView({behavior:'smooth',block:'start'});
  }
  await load();
}
