import { userActionDialog } from './user-actions.js';
import { mountDashboard } from './dashboard.js';
import { mountReports } from './reports.js';
import { mountLeads } from './leads.js';
const byId = id => document.getElementById(id);
let me;
function message(text = '') { byId('message').textContent = text; }
async function api(path, method = 'GET', body) {
  const response = await fetch(`/api/${path}`, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw Object.assign(new Error(data.error || 'Não foi possível concluir.'), { status: response.status });
  }
  return data;
}
function showLogin() { me = null; byId('login-view').hidden = false; byId('workspace').hidden = true; byId('admin-panel').hidden = true; byId('users').replaceChildren(); }
async function showWorkspace(user) {
  me = user; byId('login-view').hidden = true; byId('workspace').hidden = false;
  byId('greeting').textContent = `Olá, ${user.name}.`;
  byId('profile').textContent = user.role === 'ADMIN' ? 'Você está no acesso administrativo.' : 'Você está no acesso de captador.';
  byId('admin-panel').hidden = user.role !== 'ADMIN';
  function selectArea(area) {
    for(const id of ['dashboard','leads','reports']) {
      byId(id+'-panel').hidden=id!==area;byId('nav-'+id).setAttribute('aria-pressed',String(id===area));byId('nav-'+id).className=id===area?'':'secondary';
    }
    byId('admin-panel').hidden=area!=='leads' || user.role!=='ADMIN';
  }
  async function showReport(filters) {selectArea('reports');message();try{await mountReports(api,user,message,filters);}catch(error){message(error.message);}}
  byId('nav-reports').onclick=()=>showReport();
  byId('nav-dashboard').onclick=async()=>{selectArea('dashboard');message();try{await mountDashboard(api,user,message,showReport);}catch(error){message(error.message);}};
  byId('nav-leads').onclick=async()=>{selectArea('leads');message();try{await mountLeads(api,user,message);}catch(error){message(error.message);}};
  selectArea('leads');
  await mountLeads(api, user, message);
  if (user.role === 'ADMIN') await loadUsers();
}
async function loadUsers() {
  const { users } = await api('users'); const list = byId('users'); list.replaceChildren();
  for (const user of users) {
    const row = document.createElement('li'); const label = document.createElement('span');
    label.textContent = `${user.name} · ${user.email} · ${user.role === 'ADMIN' ? 'Administrador' : 'Captador'} · ${user.active ? 'Ativo' : 'Inativo'}`;
    row.append(label);const actions=document.createElement('div');actions.className='user-actions';row.append(actions);
    if (user.id !== me.id) {
      const button = document.createElement('button'); button.className = 'secondary'; button.textContent = user.active ? 'Desativar' : 'Reativar';
      button.addEventListener('click', async () => { button.disabled = true; message(); try { await api(`users/${user.id}`, 'PATCH', { active: !user.active }); await loadUsers(); } catch (error) { message(error.message); button.disabled = false; } }); actions.append(button);
    }
    const reset=document.createElement('button');reset.className='secondary';reset.textContent='Redefinir senha';
    reset.addEventListener('click',()=>userActionDialog(user,'password',api,async result=>{if(result.reauthenticate)showLogin();message(result.reauthenticate?'Senha alterada. Entre com a nova senha.':'Senha redefinida. As sessões do usuário foram encerradas.');}));actions.append(reset);
    if(user.id!==me.id){const remove=document.createElement('button');remove.className='danger';remove.textContent='Excluir usuário';remove.addEventListener('click',()=>userActionDialog(user,'delete',api,async()=>{await loadUsers();message('Usuário excluído. Captações e histórico preservados.');}));actions.append(remove);}
    list.append(row);
  }
}
function handleForm(id, action) {
  byId(id).addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true; message();
    try { await action(Object.fromEntries(new FormData(form))); form.reset(); } catch (error) { message(error.message); } finally { button.disabled = false; }
  });
}
handleForm('login-form', async data => { const result = await api('login', 'POST', data); await showWorkspace(result.user); });
handleForm('user-form', async data => { await api('users', 'POST', data); await loadUsers(); message('Usuário cadastrado.'); });
byId('logout').addEventListener('click', async () => { try { await api('logout', 'POST', {}); showLogin(); message(); } catch (error) { message(error.message); } });
try { const result = await api('me'); await showWorkspace(result.user); } catch (error) { if (error.status !== 401) message(error.message); }
