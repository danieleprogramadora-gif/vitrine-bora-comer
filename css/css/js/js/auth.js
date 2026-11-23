// Autenticação: cadastro, login, sair e proteção das páginas.
function destinoPorPapel(user) {
  return user?.user_metadata?.role === 'owner' ? 'proprietario.html' : 'cliente.html';
}

async function sair() {
  await db.auth.signOut();
  window.location.href = 'index.html';
}

async function protegerPagina() {
  const pagina = location.pathname.split('/').pop();
  if (pagina !== 'cliente.html' && pagina !== 'proprietario.html') return;
  const { data } = await db.auth.getSession();
  const user = data.session?.user;
  if (!user) { window.location.href = 'login.html'; return; }
  if (pagina === 'proprietario.html' && user.user_metadata?.role !== 'owner') {
    window.location.href = 'cliente.html';
  }
}
protegerPagina();

const formCadastro = document.getElementById('formCadastro');
if (formCadastro) {
  formCadastro.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = formCadastro.querySelector('button');
    btn.disabled = true;
    mostrarMensagem('Criando sua conta...');
    const { data, error } = await db.auth.signUp({
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('senha').value,
      options: { data: {
        role: document.getElementById('tipo').value,
        name: document.getElementById('nome').value.trim()
      } }
    });
    btn.disabled = false;
    if (error) return mostrarMensagem('Não foi possível criar a conta: ' + error.message, 'erro');
    if (data.session) {
      mostrarMensagem('Conta criada! Redirecionando...', 'sucesso');
      setTimeout(() => window.location.href = destinoPorPapel(data.user), 800);
    } else {
      mostrarMensagem('Conta criada! Confirme seu e-mail e depois entre na plataforma.', 'sucesso');
    }
  });
}

const formLogin = document.getElementById('formLogin');
if (formLogin) {
  formLogin.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = formLogin.querySelector('button');
    btn.disabled = true;
    mostrarMensagem('Entrando...');
    const { data, error } = await db.auth.signInWithPassword({
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('senha').value
    });
    btn.disabled = false;
    if (error) return mostrarMensagem('E-mail ou senha incorretos.', 'erro');
    window.location.href = destinoPorPapel(data.user);
  });
}
