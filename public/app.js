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
  if (user.role === 'ADMIN') await loadUsers();
}
async function loadUsers() {
  const { users } = await api('users'); const list = byId('users'); list.replaceChildren();
  for (const user of users) {
    const row = document.createElement('li'); const label = document.createElement('span');
    label.textContent = `${user.name} · ${user.email} · ${user.role === 'ADMIN' ? 'Administrador' : 'Captador'} · ${user.active ? 'Ativo' : 'Inativo'}`;
    row.append(label);
    if (user.id !== me.id) {
      const button = document.createElement('button'); button.className = 'secondary'; button.textContent = user.active ? 'Desativar' : 'Reativar';
      button.addEventListener('click', async () => { button.disabled = true; message(); try { await api(`users/${user.id}`, 'PATCH', { active: !user.active }); await loadUsers(); } catch (error) { message(error.message); button.disabled = false; } }); row.append(button);
    }
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
