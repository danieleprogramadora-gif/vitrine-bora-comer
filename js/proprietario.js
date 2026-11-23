// Painel do proprietário: dados da loja, itens e envio de imagens.
const TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;
let usuario = null, loja = null;

async function enviarImagem(arquivo, pasta) {
  if (!arquivo) return null;
  if (!TIPOS.includes(arquivo.type)) throw new Error('Formato inválido. Use JPG, PNG, WEBP ou GIF.');
  if (arquivo.size > MAX_BYTES) throw new Error('A imagem deve ter até 5 MB.');
  const ext = arquivo.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
  const caminho = `${pasta}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type });
  if (error) throw new Error('Falha no envio da imagem: ' + error.message);
  return db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

async function iniciar() {
  const { data } = await db.auth.getSession();
  usuario = data.session?.user;
  if (!usuario) return;
  await carregarTudo();
}

async function carregarTudo() {
  const { data, error } = await db.from('stores').select('*').eq('owner_id', usuario.id).limit(1);
  if (error) return mostrarMensagem('Erro ao carregar sua loja: ' + error.message, 'erro');
  loja = data[0] || null;
  if (loja) {
    const inputNome = document.getElementById('nomeLoja');
    if (inputNome) inputNome.value = loja.name || '';
  }
  renderLoja();
  await carregarItens();
}

function renderLoja() {
  const el = document.getElementById('minhaLoja');
  if (!el) return;
  el.innerHTML = loja ? `
    <article class="card">
      ${loja.image_url ? `<img src="${esc(loja.image_url)}" alt="${esc(loja.name)}">` : ''}
      <h3>${esc(loja.name)}</h3>
    </article>` : '<p>Você ainda não cadastrou sua loja. Preencha a etapa 1.</p>';
}

async function carregarItens() {
  const el = document.getElementById('meusItens');
  if (!el) return;
  if (!loja) { el.innerHTML = ''; return; }
  
  const { data, error } = await db.from('menu_items').select('*').eq('store_id', loja.id);
  if (error) return mostrarMensagem('Erro ao carregar itens: ' + error.message, 'erro');
  
  el.innerHTML = data.length ? data.map(i => `
    <article class="card">
      <h3>${esc(i.name)}</h3>
      ${i.description ? `<p>${esc(i.description)}</p>` : ''}
      <span class="preco">${formatarPreco(i.price)}</span>
      <div class="acoes">
        <button type="button" class="perigo" data-acao="excluir" data-id="${esc(i.id)}">Excluir</button>
      </div>
    </article>`).join('') : '<p>Nenhum item cadastrado ainda.</p>';
}

document.getElementById('formLoja').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  mostrarMensagem('Salvando loja...');
  try {
    const inputImg = document.getElementById('imagemLoja');
    const url = (inputImg && inputImg.files[0]) ? await enviarImagem(inputImg.files[0], `lojas/${usuario.id}`) : null;
    
    const campos = {
      name: document.getElementById('nomeLoja').value.trim(),
      location: 'POINT(-51.0786 -26.2300)'
    };
    if (url) campos.image_url = url;
    
    const q = loja
      ? db.from('stores').update(campos).eq('id', loja.id)
      : db.from('stores').insert({ ...campos, owner_id: usuario.id });
    const { error } = await q;
    if (error) throw error;
    if (inputImg) inputImg.value = '';
    await carregarTudo();
    mostrarMensagem('Dados da loja salvos!', 'sucesso');
  } catch (err) { mostrarMensagem(err.message, 'erro'); }
  btn.disabled = false;
});

document.getElementById('formItem').addEventListener('submit', async e => {
  e.preventDefault();
  if (!loja) return mostrarMensagem('Salve os dados da loja antes de adicionar itens.', 'erro');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  mostrarMensagem('Adicionando item...');
  try {
    const { error } = await db.from('menu_items').insert({
      store_id: loja.id, 
      name: document.getElementById('nomeItem').value.trim(), 
      description: document.getElementById('descricaoItem').value.trim(),
      price: parseFloat(document.getElementById('precoItem').value)
    });
    if (error) throw error;
    e.target.reset();
    await carregarItens();
    mostrarMensagem('Item adicionado!', 'sucesso');
  } catch (err) { mostrarMensagem(err.message, 'erro'); }
  btn.disabled = false;
});

const meusItensEl = document.getElementById('meusItens');
if (meusItensEl) {
  meusItensEl.addEventListener('click', async e => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'excluir') {
      if (!confirm('Excluir este item?')) return;
      const { error } = await db.from('menu_items').delete().eq('id', b.dataset.id);
      if (error) return mostrarMensagem(error.message, 'erro');
      carregarItens();
    }
  });
}

iniciar();
