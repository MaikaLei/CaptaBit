const el = (tag,text,className) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const date = value => new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
function field(form,name,label,choices) {
  const wrapper=el('label',label); const input=el(choices?'select':'input');input.name=name;
  if(choices) for(const [value,title] of choices) {const option=el('option',title);option.value=value;input.append(option);}
  else input.maxLength=200;
  wrapper.append(input);form.append(wrapper);return input;
}
function button(text,handler,className='secondary') {const b=el('button',text,className);b.type='button';b.addEventListener('click',handler);return b;}
export async function mountReports(api,user,message,initialFilters) {
  const root=document.getElementById('reports-panel');root.replaceChildren();
  const options=await api('lead-options');
  root.append(el('h2','Relatórios e acompanhamento'),el('p','Filtre as captações, acompanhe o andamento e exporte os resultados.'));
  const filters=el('form',undefined,'report-filters');
  field(filters,'from','Cadastradas a partir de').type='date';field(filters,'to','Cadastradas até').type='date';
  field(filters,'proprietor','Proprietário');field(filters,'property','Imóvel: rua, número, bairro ou cidade');
  field(filters,'status','Andamento',[['','Todos'],...options.leadStatuses.map(s=>[s,s])]);
  field(filters,'outcome','Resultado do contato',[['','Todos'],...options.contactOutcomes.map(o=>[o.id,o.name])]);
  if(user.role==='ADMIN') {
    const {users}=await api('users?include_deleted=1');field(filters,'owner_id','Captador responsável',[['','Toda a equipe'],...users.map(u=>[u.id,u.name+(u.deleted?' (excluído)':u.active?'':' (inativo)')])]);
  }
  const apply=el('button','Aplicar filtros');apply.type='submit';filters.append(apply);
  const reset=button('Limpar filtros',()=>{filters.reset();page=0;applied=new URLSearchParams();run();});filters.append(reset);
  root.append(filters,el('small','Período pela data de cadastro, no horário de Brasília. O resumo conta todos os telefones ativos das captações filtradas.'));
  const summary=el('div',undefined,'report-summary');summary.setAttribute('aria-live','polite');
  const stages=el('div',undefined,'report-stages');const actions=el('div',undefined,'section-heading');const total=el('p');
  const download=button('Exportar CSV',exportCsv);actions.append(total,download);
  const list=el('div');const pager=el('div',undefined,'pager');const detail=el('section',undefined,'lead-detail');
  root.append(summary,stages,actions,list,pager,detail);
  let page=0;let applied=new URLSearchParams(initialFilters);let requestId=0;
  for(const [name,value] of applied){const input=filters.elements.namedItem(name);if(input)input.value=value;}
  filters.addEventListener('submit',event=>{event.preventDefault();applied=new URLSearchParams(new FormData(filters));page=0;run();});
  async function run() {message();try{await load();}catch(error){message(error.message);}}
  async function load() {
    const sequence=++requestId;apply.disabled=true;download.disabled=true;list.replaceChildren(el('p','Carregando relatório…'));pager.replaceChildren();detail.replaceChildren();
    try {
      const params=new URLSearchParams(applied);params.set('page',page);
      const data=await api('reports/captacoes?'+params);
      if(sequence!==requestId)return;
      summary.replaceChildren();stages.replaceChildren();list.replaceChildren();
      const metric=(label,value,tone='neutral')=>{const card=el('div',undefined,`report-metric outcome-${tone}`);card.append(el('strong',String(value)),el('span',label));summary.append(card);};
      metric('Captações',data.total);metric('Telefones ativos',data.summary.contacts_count);
      for(const o of options.contactOutcomes)metric(o.name,data.summary[o.id],o.tone);
      for(const stage of data.stages)stages.append(el('span',`${stage.status}: ${stage.total}`,'badge'));
      total.textContent=`${data.total} captação(ões) nos filtros aplicados`;
      if(!data.rows.length)list.append(el('p','Nenhuma captação encontrada para estes filtros.'));
      for(const row of data.rows) {
        const card=el('article',undefined,'report-row');const info=el('div');
        info.append(el('h3',row.proprietor_name||'Proprietário a preencher'),el('p',`${row.type} · ${row.street}, ${row.number||'s/n'} ${row.complement} · ${row.city}`),el('small',`${row.purpose} · ${row.captador} · Cadastro: ${date(row.created_at)}`));
        const action=button('Acompanhar',()=>open(row.id).catch(e=>message(e.message)));
        const status=el('div');status.append(el('span',row.status,'badge'),el('small',`${row.contacts_count} telefone(s) ativo(s)`),action);card.append(info,status);list.append(card);
      }
      const previous=button('Anterior',()=>{page--;run();});previous.disabled=page===0;
      const next=button('Próxima',()=>{page++;run();});next.disabled=(page+1)*20>=data.total;
      pager.append(previous,el('span',`Página ${page+1} de ${Math.max(1,Math.ceil(data.total/20))}`),next);
      download.disabled=!data.total;
    } catch(error) {if(sequence===requestId){summary.replaceChildren();stages.replaceChildren();total.textContent='';list.replaceChildren(el('p','Não foi possível carregar o relatório. Aplique os filtros para tentar novamente.'));}throw error;}
    finally {if(sequence===requestId)apply.disabled=false;}
  }
  async function exportCsv() {
    download.disabled=true;message();
    try {
      const response=await fetch('/api/reports/captacoes.csv?'+applied,{credentials:'same-origin'});
      if(!response.ok){const error=await response.json();throw new Error(error.error||'Não foi possível exportar.');}
      const url=URL.createObjectURL(await response.blob());const link=el('a');link.href=url;link.download='captabit-captacoes.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){message(error.message);}finally{download.disabled=false;}
  }
  async function open(id) {
    message();const {lead,contacts}=await api(`leads/${id}`);detail.replaceChildren();
    detail.append(el('h3',`${lead.proprietor_name||'Proprietário a preencher'} · ${lead.street}`),button('Fechar acompanhamento',()=>detail.replaceChildren()));
    const form=el('form',undefined,'form-grid');
    const terminal=['Captado','Recusado','Já alugado','Encerrado'].includes(lead.status);
    const allowed=user.role==='ADMIN'?options.leadStatuses:terminal?[lead.status]:options.leadStatuses.filter(s=>s!=='Encerrado');
    const status=field(form,'status','Andamento',allowed.map(s=>[s,s]));status.value=lead.status;
    const save=el('button','Salvar andamento');save.type='submit';form.append(save);detail.append(form);
    if(user.role!=='ADMIN' && terminal){save.disabled=true;detail.append(el('small','Peça ao administrador para reabrir ou alterar o andamento desta captação.'));}
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;message();try{await api(`leads/${id}`,'PATCH',{status:status.value,version:lead.version});await load();await open(id);message('Andamento atualizado.');}catch(error){message(error.message);save.disabled=false;}});
    detail.append(el('h4','Resultados dos contatos'));
    if(!contacts.length)detail.append(el('p','Nenhum telefone ativo.'));
    for(const contact of contacts){const outcome=options.contactOutcomes.find(o=>o.id===contact.outcome);detail.append(el('p',`+${contact.phone} · ${outcome?.name||'Não verificado'}`,`outcome-badge outcome-${outcome?.tone||'neutral'}`));}
    const history=el('ol',undefined,'history');detail.append(el('h4','Histórico'),history);
    let cursor;const more=button('Carregar eventos anteriores',()=>historyPage().catch(e=>message(e.message)));detail.append(more);
    const labels={message_model:'Modelo da mensagem',status:'Andamento',proprietor_name:'Proprietário',owner_id:'Responsável',phone:'Telefone',name:'Nome',notes:'Observações',outcome:'Resultado',deleted_at:'Exclusão',type:'Tipo',purpose:'Finalidade',street:'Logradouro',number:'Número',complement:'Complemento',district:'Bairro',city:'Cidade',state:'UF',postal_code:'CEP',source:'Origem',source_url:'Link'};
    async function historyPage() {
      more.disabled=true;
      try{const data=await api(`leads/${id}/history${cursor?'?before='+cursor:''}`);
        for(const event of data.events){const item=el('li');item.append(el('strong',event.event),el('small',`${event.actor_name} · ${date(event.created_at)}`));
          for(const [key,value] of Object.entries(event.after)){if(event.before && event.before[key]===value)continue;
            const readable=v=>key==='outcome'?(options.contactOutcomes.find(o=>o.id===v)?.name||v):key==='deleted_at'?(v?date(v):'—'):key==='owner_id'?'Responsável registrado':v||'—';
            item.append(el('span',`${labels[key]||key}: ${event.before?readable(event.before[key])+' → ':''}${readable(value)}`));}
          history.append(item);}
        cursor=data.next;more.hidden=!cursor;
      }finally{more.disabled=false;}
    }
    await historyPage();detail.scrollIntoView({behavior:'smooth',block:'start'});
  }
  await load();
}
