const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const dayLabel=iso=>iso.split('-').reverse().join('/');
const dateString=time=>new Date(time-3*3600000).toISOString().slice(0,10);
export async function mountDashboard(api,user,message,showReport) {
  const root=document.getElementById('dashboard-panel');root.replaceChildren();
  root.append(el('h2','Visão geral'),el('p',user.role==='ADMIN'?'Acompanhe as captações e os contatos da equipe.':'Acompanhe suas captações e os resultados dos contatos.'));
  const form=el('form',undefined,'dashboard-filters');
  function field(name,title){const label=el('label',title);const input=el('input');input.type='date';input.name=name;input.required=true;label.append(input);form.append(label);return input;}
  const from=field('from','Cadastradas a partir de');const to=field('to','Cadastradas até');
  const today=Date.now();from.value=dateString(today-29*86400000);to.value=dateString(today);
  const apply=el('button','Atualizar visão');apply.type='submit';form.append(apply);
  let owner;
  if(user.role==='ADMIN'){
    const label=el('label','Captador responsável');owner=el('select');owner.name='owner_id';
    const all=el('option','Toda a equipe');all.value='';owner.append(all);
    const {users}=await api('users');for(const user of users){const option=el('option',user.name+(user.active?'':' (inativo)'));option.value=user.id;owner.append(option);}
    label.append(owner);form.insertBefore(label,apply);
  }
  root.append(form,el('small','Indicadores dos imóveis cadastrados no período, no horário de Brasília. Andamentos e resultados mostram a situação atual.'));
  const content=el('div');content.setAttribute('aria-live','polite');root.append(content);
  let sequence=0;
  async function load(){
    const requestId=++sequence;apply.disabled=true;message();content.replaceChildren(el('p','Carregando visão geral…'));
    const params=new URLSearchParams(new FormData(form));
    try{
      const data=await api('dashboard?'+params);if(requestId!==sequence)return;content.replaceChildren();
      const report=(extra={})=>{const filters=new URLSearchParams(params);for(const [key,value] of Object.entries(extra))filters.set(key,value);showReport(filters);};
      const range=el('div',undefined,'section-heading');range.append(el('p',`${dayLabel(data.period.from)} a ${dayLabel(data.period.to)}`));
      const all=el('button','Ver relatório deste período','secondary');all.type='button';all.addEventListener('click',()=>report());range.append(all);content.append(range);
      const metrics=el('div',undefined,'dashboard-metrics');
      for(const [name,value,hint] of [['Captações cadastradas',data.total,'Imóveis no período'],['Imóveis com contato correto',data.with_correct,'Ao menos um telefone confirmado'],['Imóveis sem telefone',data.without_phone,'Sem telefone ativo cadastrado'],['Imóveis captados',data.captured,'Andamento atual: Captado']]){
        const card=el('article',undefined,'dashboard-metric');card.append(el('strong',String(value)),el('span',name),el('small',hint));metrics.append(card);
      }
      content.append(metrics);
      if(!data.total)content.append(el('p','Nenhuma captação cadastrada neste período. Ajuste as datas ou cadastre um imóvel em Contato inicial.'));
      content.append(el('h3','Resultados dos contatos'),el('small',`${data.summary.contacts_count} telefone(s) ativo(s). Telefones excluídos não entram no resumo.`));
      const contacts=el('div',undefined,'report-summary');for(const o of (await api('lead-options')).contactOutcomes){
        if(requestId!==sequence)return;
        const b=el('button',undefined,`dashboard-outcome outcome-${o.tone}`);b.type='button';b.append(el('strong',String(data.summary[o.id])),el('span',o.name));b.setAttribute('aria-label',`${o.name}: ${data.summary[o.id]} telefones. Ver captações`);b.addEventListener('click',()=>report({outcome:o.id}));contacts.append(b);
      }content.append(contacts);
      content.append(el('h3','Evolução dos cadastros'),el('small',data.trend.length && data.trend[0].from!==data.trend[0].to?'Quantidade de imóveis por intervalos de até 7 dias.':'Quantidade de imóveis cadastrados por dia.'));
      const figure=el('figure',undefined,'dashboard-chart');const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 720 220');svg.setAttribute('role','img');
      const title=document.createElementNS(ns,'title');title.textContent='Evolução dos cadastros no período. Valores disponíveis na tabela abaixo.';svg.append(title);
      const max=Math.max(1,...data.trend.map(p=>p.total));const width=660/data.trend.length;
      data.trend.forEach((point,i)=>{const bar=document.createElementNS(ns,'rect');const h=point.total/max*155;bar.setAttribute('x',String(30+i*width+1));bar.setAttribute('y',String(180-h));bar.setAttribute('width',String(Math.max(1,width-2)));bar.setAttribute('height',String(h));bar.setAttribute('fill','#0066df');const title=document.createElementNS(ns,'title');title.textContent=`${dayLabel(point.from)}: ${point.total} cadastro(s)`;bar.append(title);svg.append(bar);});
      for(const [x,y,label,anchor] of [[30,205,dayLabel(data.period.from),'start'],[690,205,dayLabel(data.period.to),'end'],[30,18,`Máximo: ${max===1 && !data.total?0:max}`,'start']]){const text=document.createElementNS(ns,'text');text.setAttribute('x',String(x));text.setAttribute('y',String(y));text.setAttribute('text-anchor',anchor);text.setAttribute('fill','#52647a');text.setAttribute('font-size','13');text.textContent=label;svg.append(text);}
      figure.append(svg);content.append(figure);
      const details=el('details');details.append(el('summary','Ver valores do gráfico'));const table=el('table',undefined,'dashboard-table');const head=el('tr');head.append(el('th','Período'),el('th','Cadastros'));table.append(head);
      for(const point of data.trend){const row=el('tr');row.append(el('td',point.from===point.to?dayLabel(point.from):`${dayLabel(point.from)} a ${dayLabel(point.to)}`),el('td',String(point.total)));table.append(row);}details.append(table);content.append(details);
      content.append(el('h3','Andamento das captações'));const stages=el('div',undefined,'report-stages');
      for(const stage of data.stages){const b=el('button',`${stage.status}: ${stage.total}`,'secondary');b.type='button';b.addEventListener('click',()=>report({status:stage.status}));stages.append(b);}if(!data.stages.length)stages.append(el('p','Sem andamentos neste período.'));content.append(stages);
      if(user.role==='ADMIN'){
        content.append(el('h3','Captações por responsável'));const team=el('div',undefined,'report-stages');for(const member of data.team){const b=el('button',`${member.captador}: ${member.total}`,'secondary');b.type='button';b.addEventListener('click',()=>report({owner_id:member.owner_id}));team.append(b);}if(!data.team.length)team.append(el('p','Sem cadastros neste período.'));content.append(team);
      }
    }catch(error){if(requestId===sequence){content.replaceChildren(el('p','Não foi possível carregar os indicadores. Confira os filtros e tente novamente.'));message(error.message);}}
    finally{if(requestId===sequence)apply.disabled=false;}
  }
  form.addEventListener('submit',event=>{event.preventDefault();load();});await load();
}
