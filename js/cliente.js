// Vitrine pública do cliente: busca restaurantes e itens no Supabase, aplica filtros e gerencia a sacola.
const CATS = [
  { id: 'hamburguer', label: 'Hambúrgueres', emoji: '🍔', cls: 'c-burg', kw: ['hamburguer', 'hambúrguer', 'burger', 'lanche', 'x-'] },
  { id: 'pizza', label: 'Pizzas', emoji: '🍕', cls: 'c-pizza', kw: ['pizza', 'pizzaria'] },
  { id: 'japonesa', label: 'Japonesa', emoji: '🍣', cls: 'c-jap', kw: ['sushi', 'japonesa', 'temaki', 'yakisoba'] },
  { id: 'saudavel', label: 'Saudável', emoji: '🥗', cls: 'c-saud', kw: ['salada', 'saudavel', 'saudável', 'fit', 'poke', 'vegano'] },
  { id: 'acai', label: 'Açaí', emoji: '🍇', cls: 'c-acai', kw: ['acai', 'açaí', 'sorvete', 'gelato'] }
];
const CAT_MAP = Object.fromEntries(CATS.map(c => [c.id, c]));

const est = { lojas: [], itens: [], filtroCat: '', busca: '', apenasPromo: false, ordenacao: 'padrao', sacola: {} };
let lojaAtual = null;

function categoriaDe(loja, itensDaLoja = []) {
  const texto = `${loja.name || ''} ${loja.description || ''} ${itensDaLoja.map(i => `${i.name} ${i.description || ''}`).join(' ')}`.toLowerCase();
  for (const c of CATS) {
    if (c.kw.some(k => texto.includes(k))) return c.id;
  }
  return '';
}

function iniciais(nome) {
  const partes = String(nome || 'LJ').trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || partes[0]?.[1] || '')).toUpperCase();
}

function gerarCardapioDemo(loja) {
  const baseId = `demo-${loja.id}`;
  const nomeLoja = (loja.name || '').toLowerCase();

  if (nomeLoja.includes('bora comer')) {
    return [
      {
        id: `${baseId}-1`,
        name: '🍔 Combo Bora Comer Clássico',
        description: 'Hambúrguer artesanal grelhado, queijo cheddar, alface, tomate, molho da casa e batatas fritas.',
        price: 32.90,
        image_url: ''
      },
      {
        id: `${baseId}-2`,
        name: '🥓 Duplo Bacon Smash',
        description: 'Dois blends smash na chapa, bacon crocante, cheddar duplo e pão brioche amanteigado.',
        price: 36.50,
        image_url: ''
      },
      {
        id: `${baseId}-3`,
        name: '🍟 Porção de Batata com Cheddar e Bacon',
        description: 'Batatas crocantes cobertas com creme de cheddar quente e cubos de bacon.',
        price: 22.00,
        image_url: ''
      },
      {
        id: `${baseId}-4`,
        name: '🥤 Refrigerante Lata 350ml',
        description: 'Bem gelado (Coca-Cola, Guaraná ou Zero).',
        price: 6.50,
        image_url: ''
      }
    ];
  }

  return [
    {
      id: `${baseId}-1`,
      name: 'Prato Especial da Casa',
      description: 'Preparo artesanal da casa com ingredientes selecionados e acompanhamento.',
      price: 29.90,
      image_url: ''
    },
    {
      id: `${baseId}-2`,
      name: 'Porção de Entrada',
      description: 'Porção ideal para compartilhar com molho especial da casa.',
      price: 18.50,
      image_url: ''
    },
    {
      id: `${baseId}-3`,
      name: 'Bebida Gelada 350ml',
      description: 'Opção refrescante para acompanhar seu pedido.',
      price: 6.00,
      image_url: ''
    }
  ];
}

function obterItensDaLoja(loja) {
  const reais = est.itens.filter(i => String(i.store_id) === String(loja.id));
  if (reais.length) {
    return { itens: reais, usandoDemo: false };
  }
  return { itens: gerarCardapioDemo(loja), usandoDemo: true };
}

function renderCategorias() {
  const el = document.getElementById('catStrip');
  if (!el) return;
  const todosAtivo = !est.filtroCat ? ' ativo' : '';
  el.innerHTML = `
    <button type="button" class="cat-tile c-todos${todosAtivo}" data-cat="">
      <span class="cat-box" aria-hidden="true">🍽️</span>
      <span class="cat-lbl">Todos</span>
    </button>` + CATS.map(c => `
    <button type="button" class="cat-tile ${c.cls}${est.filtroCat === c.id ? ' ativo' : ''}" data-cat="${c.id}">
      <span class="cat-box" aria-hidden="true">${c.emoji}</span>
      <span class="cat-lbl">${c.label}</span>
    </button>`).join('');
}

function lojasFiltradas() {
  const q = est.busca.trim().toLowerCase();
  const lista = est.lojas.filter(l => {
    const { itens: itensL } = obterItensDaLoja(l);
    const cat = categoriaDe(l, itensL);
    if (est.filtroCat && cat !== est.filtroCat) return false;
    if (est.apenasPromo && !itensL.some(i => Number(i.price) > 0 && Number(i.price) < 25)) return false;
    if (!q) return true;
    const matchLoja = `${l.name || ''} ${l.description || ''} ${l.address || ''}`.toLowerCase().includes(q);
    const matchItem = itensL.some(i => `${i.name} ${i.description || ''}`.toLowerCase().includes(q));
    return matchLoja || matchItem;
  });
  if (est.ordenacao === 'nome') lista.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  return lista;
}

function renderVitrine() {
  const grid = document.getElementById('gridLojas');
  if (!grid) return;
  const lista = lojasFiltradas();
  const cnt = document.getElementById('cntLojas');
  if (cnt) cnt.textContent = lista.length;
  const titulo = document.getElementById('tituloVitrine');
  if (titulo) {
    titulo.textContent = est.filtroCat
      ? `${CAT_MAP[est.filtroCat].label}`
      : (est.busca ? `Resultados para "${est.busca}"` : 'Restaurantes para descobrir');
  }
  if (!lista.length) {
    grid.innerHTML = '<p class="vazio">Nenhuma loja encontrada com esse filtro. <button type="button" class="link-limpar" id="limparVazio">Limpar filtros</button></p>';
    return;
  }
  grid.innerHTML = lista.map((l, idx) => {
    const { itens: itensL } = obterItensDaLoja(l);
    const cat = CAT_MAP[categoriaDe(l, itensL)];
    const minPreco = itensL.reduce((m, i) => (Number(i.price) > 0 && Number(i.price) < m ? Number(i.price) : m), Infinity);
    const badge = idx < 3 ? '<span class="badge-card">NOVIDADE</span>' : '';
    const midia = l.image_url
      ? `<img src="${esc(l.image_url)}" alt="${esc(l.name)}" loading="lazy">`
      : `<span class="card-thumb-ph" aria-hidden="true">${cat ? cat.emoji : '🍽️'}</span>`;
    const meta = minPreco < Infinity ? `A partir de ${formatarPreco(minPreco)}` : 'Cardápio disponível';
    return `
      <article class="card-loja" data-abrir="${esc(l.id)}">
        <div class="card-thumb">${midia}${badge}</div>
        <div class="card-body">
          <span class="card-avatar">${esc(iniciais(l.name))}</span>
          <div class="card-info">
            <h3 class="card-nome">${esc(l.name)}</h3>
            <p class="card-sub">${cat ? `${cat.label} · ` : 'Restaurante · '}${meta}</p>
          </div>
          <span class="card-go" aria-hidden="true">→</span>
        </div>
      </article>`;
  }).join('');
}

async function carregar() {
  mostrarMensagem('Carregando restaurantes...');
  const [resLojas, resItens] = await Promise.all([
    db.from('stores').select('*').order('created_at', { ascending: false }),
    db.from('menu_items').select('*')
  ]);
  if (resLojas.error) return mostrarMensagem('Erro ao carregar lojas: ' + resLojas.error.message, 'erro');
  est.lojas = resLojas.data || [];
  est.itens = resItens.error ? [] : (resItens.data || []);
  mostrarMensagem('');
  renderCategorias();
  renderVitrine();

  const paramLoja = new URLSearchParams(location.search).get('loja');
  if (paramLoja) {
    requestAnimationFrame(() => abrirLoja(paramLoja));
  }
}

function htmlItem(it) {
  const qtd = est.sacola[it.id]?.qtd || 0;
  return `
    <div class="item-menu">
      ${it.image_url ? `<img src="${esc(it.image_url)}" alt="${esc(it.name)}">` : ''}
      <div>
        <h4>${esc(it.name)}</h4>
        ${it.description ? `<p>${esc(it.description)}</p>` : ''}
      </div>
      <div class="item-dir">
        <span class="preco">${formatarPreco(it.price)}</span>
        <div class="qtd-box">
          <button type="button" data-qtd="-1" data-id="${esc(it.id)}" aria-label="Remover">−</button>
          <span>${qtd}</span>
          <button type="button" data-qtd="1" data-id="${esc(it.id)}" aria-label="Adicionar">+</button>
        </div>
      </div>
    </div>`;
}

function abrirLoja(id) {
  const l = est.lojas.find(x => String(x.id) === String(id));
  if (!l) return mostrarMensagem('Loja não encontrada.', 'erro');
  lojaAtual = l;
  const { itens, usandoDemo } = obterItensDaLoja(l);
  const modal = document.getElementById('modalLoja');
  const dlgLoja = document.getElementById('dlgLoja');
  const urlLoja = `${location.origin}${location.pathname}?loja=${encodeURIComponent(l.id)}`;
  dlgLoja.innerHTML = `
    <h3>${esc(l.name)}</h3>
    ${l.description ? `<p>${esc(l.description)}</p>` : ''}
    ${l.address ? `<p><small>📍 ${esc(l.address)}</small></p>` : ''}
    ${usandoDemo ? `<p><small>✨ Cardápio em destaque para demonstração · Adicione itens à sacola</small></p>` : ''}
    <div class="menu-lista">
      ${itens.length
        ? itens.map(htmlItem).join('')
        : '<p>Este restaurante ainda não tem itens cadastrados no cardápio.</p>'}
    </div>
    <div class="acoes">
      <button type="button" id="btnQrLoja">QR Code da loja</button>
      <button type="button" id="irSacola">Ver sacola</button>
      <button type="button" class="perigo" id="fecharLoja">Fechar</button>
    </div>`;
  if (!modal.open) modal.showModal();

  dlgLoja.querySelectorAll('[data-qtd]').forEach(b => {
    b.addEventListener('click', () => {
      alterarQtd(b.dataset.id, Number(b.dataset.qtd));
      abrirLoja(l.id);
    });
  });
  document.getElementById('btnQrLoja').addEventListener('click', () => abrirQr(`Cardápio · ${l.name}`, urlLoja));
  document.getElementById('irSacola').addEventListener('click', () => {
    modal.close();
    abrirSacola();
  });
  document.getElementById('fecharLoja').addEventListener('click', () => modal.close());
}

function alterarQtd(itemId, delta) {
  let item = est.itens.find(x => String(x.id) === String(itemId));
  let lojaDoItem = item ? est.lojas.find(l => String(l.id) === String(item.store_id)) : lojaAtual;

  if (!item && lojaDoItem) {
    const { itens } = obterItensDaLoja(lojaDoItem);
    item = itens.find(x => String(x.id) === String(itemId));
  }
  if (!item) return;

  const atual = est.sacola[itemId]?.qtd || 0;
  const prox = atual + delta;
  if (prox <= 0) delete est.sacola[itemId];
  else est.sacola[itemId] = { item, loja: lojaDoItem, qtd: prox };
  atualizarBadgeSacola();
}

function atualizarBadgeSacola() {
  const total = Object.values(est.sacola).reduce((s, r) => s + r.qtd, 0);
  const b = document.getElementById('badgeSacola');
  if (b) b.textContent = total;
}

function abrirSacola() {
  const entradas = Object.values(est.sacola);
  const dlg = document.getElementById('dlgSacola');
  if (!entradas.length) {
    dlg.innerHTML = '<h3>Sua sacola está vazia</h3><p>Escolha itens no cardápio de alguma loja.</p><div class="acoes"><button type="button" id="fecharSac">Fechar</button></div>';
    document.getElementById('modalSacola').showModal();
    document.getElementById('fecharSac').addEventListener('click', () => document.getElementById('modalSacola').close());
    return;
  }
  const total = entradas.reduce((s, r) => s + Number(r.item.price) * r.qtd, 0);
  dlg.innerHTML = `
    <h3>Sua sacola</h3>
    ${entradas.map(r => `
      <div class="sacola-linha">
        <div><strong>${esc(r.item.name)}</strong><br><small>${esc(r.loja?.name || '')}</small></div>
        <div>${r.qtd} × ${formatarPreco(r.item.price)} = <strong>${formatarPreco(r.qtd * r.item.price)}</strong></div>
      </div>`).join('')}
    <p class="sacola-total">Total: ${formatarPreco(total)}</p>
    <div class="acoes">
      <button type="button" id="btnZap">Enviar no WhatsApp</button>
      <button type="button" id="btnSimular">Simular pedido + QR</button>
      <button type="button" class="perigo" id="limparSac">Limpar</button>
      <button type="button" id="fecharSac">Fechar</button>
    </div>`;
  document.getElementById('modalSacola').showModal();
  document.getElementById('fecharSac').addEventListener('click', () => document.getElementById('modalSacola').close());
  document.getElementById('limparSac').addEventListener('click', () => {
    est.sacola = {};
    atualizarBadgeSacola();
    abrirSacola();
  });
  document.getElementById('btnZap').addEventListener('click', () => {
    const linhas = entradas.map(r => `• ${r.qtd}x ${r.item.name} (${formatarPreco(r.item.price * r.qtd)})`).join('%0A');
    const msg = `Olá! Gostaria de fazer um pedido:%0A${linhas}%0ATotal: ${encodeURIComponent(formatarPreco(total))}`;
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener');
  });
  document.getElementById('btnSimular').addEventListener('click', () => {
    const codigo = 'PED-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    est.sacola = {};
    atualizarBadgeSacola();
    document.getElementById('modalSacola').close();
    abrirQr(`Pedido ${codigo} · ${formatarPreco(total)}`, `${location.origin}${location.pathname}?pedido=${codigo}`);
  });
}

function abrirQr(titulo, texto) {
  const dlg = document.getElementById('dlgQr');
  dlg.innerHTML = `
    <h3>${esc(titulo)}</h3>
    <div id="qrCanvas"></div>
    <p class="qr-url">${esc(texto)}</p>
    <div class="acoes"><button type="button" id="fecharQr">Fechar</button></div>`;
  new QRCode(document.getElementById('qrCanvas'), { text: texto, width: 196, height: 196 });
  document.getElementById('modalQr').showModal();
  document.getElementById('fecharQr').addEventListener('click', () => document.getElementById('modalQr').close());
}

document.getElementById('catStrip')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  est.filtroCat = btn.dataset.cat;
  renderCategorias();
  renderVitrine();
});

document.getElementById('formBusca')?.addEventListener('submit', e => {
  e.preventDefault();
  est.busca = document.getElementById('inputBusca')?.value || '';
  renderVitrine();
});

document.getElementById('inputBusca')?.addEventListener('input', e => {
  est.busca = e.target.value;
  renderVitrine();
});

document.getElementById('btnPromo')?.addEventListener('click', e => {
  est.apenasPromo = !est.apenasPromo;
  e.currentTarget.classList.toggle('ativo', est.apenasPromo);
  renderVitrine();
});

document.getElementById('btnOrdenar')?.addEventListener('click', e => {
  est.ordenacao = est.ordenacao === 'padrao' ? 'nome' : 'padrao';
  e.currentTarget.classList.toggle('ativo', est.ordenacao === 'nome');
  renderVitrine();
});

function limparTodosFiltros() {
  est.filtroCat = '';
  est.busca = '';
  est.apenasPromo = false;
  est.ordenacao = 'padrao';
  const inp = document.getElementById('inputBusca');
  if (inp) inp.value = '';
  document.getElementById('btnPromo')?.classList.remove('ativo');
  document.getElementById('btnOrdenar')?.classList.remove('ativo');
  renderCategorias();
  renderVitrine();
}

document.getElementById('btnLimparFiltros')?.addEventListener('click', limparTodosFiltros);

document.getElementById('gridLojas')?.addEventListener('click', e => {
  if (e.target.closest('#limparVazio')) return limparTodosFiltros();
  const card = e.target.closest('[data-abrir]');
  if (card) abrirLoja(card.dataset.abrir);
});

document.getElementById('btnAbrirSacola')?.addEventListener('click', abrirSacola);

carregar();
