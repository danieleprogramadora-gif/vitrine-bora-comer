// Vitrine: descobrir restaurantes, montar a sacola, gerar QR Code e enviar o pedido.
let todasLojas = [];
let carrinho = null;
let catAtual = 'Todos';
const itensCache = {};

const lista = document.getElementById('listaLojas');
const CATS = [
  ['Hambúrgueres', /burger|hamb|smash|lanche/],
  ['Pizzas', /pizz|forno/],
  ['Japonesa', /sushi|japon|temaki|sashimi/],
  ['Saudável', /salada|saud[aá]vel|fit|vegan|natural/],
  ['Açaí', /a[cç]a[ií]/]
];
const EMOJI = {
  'Hambúrgueres': '🍔',
  Pizzas: '🍕',
  Japonesa: '🍣',
  'Saudável': '🥗',
  'Açaí': '🍇',
  Outros: '🍽️'
};

const categoriaDe = l => {
  const t = ((l.name || '') + ' ' + (l.description || '')).toLowerCase();
  const c = CATS.find(([, r]) => r.test(t));
  return c ? c[0] : 'Outros';
};

// ---------- Sessão no cabeçalho ----------
(async () => {
  try {
    if (!window.db?.auth) return;
    const { data } = await db.auth.getSession();
    const u = data?.session?.user;
    if (!u) return;
    const areaConta = document.getElementById('areaConta');
    if (areaConta) {
      areaConta.innerHTML = '<button type="button" class="btn-sair" onclick="sair()">Sair</button>';
    }
    if (u.user_metadata?.role === 'owner') {
      const v = document.getElementById('linkVender');
      if (v) {
        v.href = 'proprietario.html';
        v.textContent = 'Meu painel';
      }
    }
  } catch (e) {
    console.warn('Sessão não carregada:', e);
  }
})();

// ---------- Lista de lojas ----------
async function carregarLojas() {
  mostrarMensagem('Carregando restaurantes...');
  const { data, error } = await db.from('stores').select('*').order('created_at', { ascending: false });
  if (error) {
    return mostrarMensagem('Erro ao carregar restaurantes: ' + error.message, 'erro');
  }
  todasLojas = data || [];
  filtrar();
}

function filtrar() {
  const inputPesquisa = document.getElementById('pesquisa');
  const t = inputPesquisa ? inputPesquisa.value.trim().toLowerCase() : '';
  const r = todasLojas.filter(l =>
    (catAtual === 'Todos' || categoriaDe(l) === catAtual) &&
    (!t || ((l.name || '') + ' ' + (l.description || '')).toLowerCase().includes(t))
  );

  const contLojas = document.getElementById('contLojas');
  if (contLojas) contLojas.textContent = r.length;

  if (!r.length) {
    if (lista) lista.innerHTML = '';
    return mostrarMensagem('Nenhum restaurante encontrado.');
  }
  mostrarMensagem('');

  if (lista) {
    lista.innerHTML = r.map(l => {
      const cat = categoriaDe(l);
      const novo = l.created_at ? (Date.now() - new Date(l.created_at) < 14 * 864e5) : false;
      return `
        <article class="card loja-card" data-loja="${esc(l.id)}" tabindex="0" role="button" aria-label="Abrir cardápio de ${esc(l.name)}">
          <div class="img-wrap">
            ${l.image_url
              ? `<img src="${esc(l.image_url)}" alt="${esc(l.name)}" loading="lazy">`
              : `<div class="sem-img">${EMOJI[cat]}</div>`}
            <span class="selo">${novo ? 'Novidade' : 'Vem descobrir'}</span>
          </div>
          <div class="loja-corpo">
            <span class="avatar">${esc((l.name || '?')[0].toUpperCase())}</span>
            <div>
              <h3>${esc(l.name)}</h3>
              <small>${cat === 'Outros' ? 'Restaurante' : cat} · Cardápio disponível</small>
            </div>
            <span class="seta">→</span>
          </div>
        </article>`;
    }).join('');
  }
}

const pesquisaEl = document.getElementById('pesquisa');
if (pesquisaEl) pesquisaEl.addEventListener('input', filtrar);

const btnBuscarEl = document.getElementById('btnBuscar');
if (btnBuscarEl) {
  btnBuscarEl.onclick = () => {
    filtrar();
    const rest = document.getElementById('restaurantes');
    if (rest) rest.scrollIntoView({ behavior: 'smooth' });
  };
}

const categoriasEl = document.getElementById('categorias');
if (categoriasEl) {
  categoriasEl.addEventListener('click', e => {
    const b = e.target.closest('.cat');
    if (!b) return;
    catAtual = b.dataset.cat;
    document.querySelectorAll('.cat').forEach(c => c.classList.toggle('ativa', c === b));
    filtrar();
  });
}

// ---------- Diálogos (QR Code, Cardápio, Pedido) ----------
const dlgQr = document.createElement('dialog');
dlgQr.className = 'dialogo';
document.body.appendChild(dlgQr);

const dlgLoja = document.createElement('dialog');
dlgLoja.className = 'dialogo';
document.body.appendChild(dlgLoja);

const dlgPedido = document.createElement('dialog');
dlgPedido.className = 'dialogo';
document.body.appendChild(dlgPedido);

function abrirModalSeguro(dlg) {
  try {
    if (!dlg.open) dlg.showModal();
  } catch {
    dlg.setAttribute('open', '');
  }
}

function fecharModalSeguro(dlg) {
  try {
    if (dlg.open) dlg.close();
  } catch {
    dlg.removeAttribute('open');
  }
}

function abrirQrCode(titulo, conteudoInicial) {
  dlgQr.innerHTML = `
    <h3>QR Code de acesso · ${esc(titulo)}</h3>
    <p><small>Use o link abaixo para o professor e alunos acessarem a loja.</small></p>
    <label for="urlQrInput">Link ou conteúdo do QR Code</label>
    <input type="text" id="urlQrInput" value="${esc(conteudoInicial)}" style="width:100%;margin:6px 0 12px">
    <div id="qrCanvas" style="display:flex;justify-content:center;align-items:center;min-height:190px;padding:16px;background:#fff;border-radius:8px;margin:8px 0"></div>
    <div class="acoes">
      <button type="button" id="atualizarQr">Atualizar QR</button>
      <button type="button" id="copiarLinkQr">Copiar link</button>
      <button type="button" class="perigo" id="fecharQr">Fechar</button>
    </div>`;

  const inputUrl = dlgQr.querySelector('#urlQrInput');
  const box = dlgQr.querySelector('#qrCanvas');

  const renderizar = texto => {
    const valor = (texto || '').trim() || location.href;
    box.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(box, { text: valor, width: 180, height: 180 });
    } else {
      box.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(valor)}" alt="QR Code">`;
    }
  };

  renderizar(conteudoInicial);

  dlgQr.querySelector('#atualizarQr').onclick = () => renderizar(inputUrl.value);
  dlgQr.querySelector('#copiarLinkQr').onclick = () => {
    navigator.clipboard?.writeText(inputUrl.value).catch(() => {});
    alert('Link copiado!');
  };
  dlgQr.querySelector('#fecharQr').onclick = () => fecharModalSeguro(dlgQr);
  abrirModalSeguro(dlgQr);
}

function htmlItem(i) {
  const q = carrinho?.itens[i.id]?.qtd || 0;
  return `
    <div class="menu-item">
      ${i.image_url ? `<img src="${esc(i.image_url)}" alt="${esc(i.name)}" loading="lazy">` : ''}
      <div>
        <h4>${esc(i.name)}</h4>
        ${i.description ? `<p>${esc(i.description)}</p>` : ''}
      </div>
      <div class="menu-acao">
        <span class="preco">${formatarPreco(i.price)}</span>
        <div class="stepper">
          <button type="button" data-sub="${esc(i.id)}" aria-label="Remover um">−</button>
          <span data-qtd="${esc(i.id)}">${q}</span>
          <button type="button" data-add="${esc(i.id)}" aria-label="Adicionar um">+</button>
        </div>
      </div>
    </div>`;
}

async function abrirLoja(id) {
  const l = todasLojas.find(x => String(x.id) === String(id));
  if (!l) return;

  let itens = [];
  try {
    const { data, error } = await db
      .from('menu_items')
      .select('*')
      .eq('store_id', l.id)
      .order('created_at');

    if (!error && Array.isArray(data)) {
      itens = data.filter(item => item.available !== false);
    }
  } catch (err) {
    console.warn('Falha ao buscar itens:', err);
  }

  itens.forEach(i => {
    itensCache[i.id] = { ...i, loja: l };
  });

  const urlLoja = `${location.origin}${location.pathname}?loja=${encodeURIComponent(l.id)}`;
  dlgLoja.innerHTML = `
    <h3>${esc(l.name)}</h3>
    ${l.description ? `<p>${esc(l.description)}</p>` : ''}
    ${l.address ? `<p><small>📍 ${esc(l.address)}</small></p>` : ''}
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

  dlgLoja.querySelector('#btnQrLoja').onclick = () => abrirQrCode(l.name, urlLoja);
  dlgLoja.querySelector('#fecharLoja').onclick = () => fecharModalSeguro(dlgLoja);
  dlgLoja.querySelector('#irSacola').onclick = () => {
    if (carrinho) {
      fecharModalSeguro(dlgLoja);
      abrirPedido();
    } else {
      mostrarMensagem('Adicione pelo menos 1 item antes de ir para a sacola.');
    }
  };

  abrirModalSeguro(dlgLoja);
}

if (lista) {
  lista.addEventListener('click', e => {
    const c = e.target.closest('.loja-card');
    if (c) abrirLoja(c.dataset.loja);
  });
  lista.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const c = e.target.closest('.loja-card');
      if (c) {
        e.preventDefault();
        abrirLoja(c.dataset.loja);
      }
    }
  });
}

dlgLoja.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !(b.dataset.add || b.dataset.sub)) return;
  mudarQtd(b.dataset.add || b.dataset.sub, b.dataset.add ? 1 : -1);
});

// ---------- Sacola e Pedido ----------
function totais() {
  const l = Object.values(carrinho?.itens || {});
  return {
    qtd: l.reduce((a, i) => a + i.qtd, 0),
    total: l.reduce((a, i) => a + i.qtd * i.preco, 0)
  };
}

function atualizarContador() {
  const cont = document.getElementById('contSacola');
  if (cont) cont.textContent = totais().qtd;
}

function mudarQtd(id, delta) {
  const item = itensCache[id];
  if (!item?.loja) return;

  if (delta > 0 && carrinho && carrinho.loja.id !== item.loja.id) {
    if (!confirm('Sua sacola tem itens de outro restaurante. Deseja começar uma nova sacola?')) return;
    carrinho = null;
    document.querySelectorAll('[data-qtd]').forEach(s => { s.textContent = '0'; });
  }

  if (!carrinho) carrinho = { loja: item.loja, itens: {} };
  const nova = Math.max(0, (carrinho.itens[id]?.qtd || 0) + delta);
  if (nova) {
    carrinho.itens[id] = { nome: item.name, preco: Number(item.price || 0), qtd: nova };
  } else {
    delete carrinho.itens[id];
  }
  if (!Object.keys(carrinho.itens).length) carrinho = null;

  document.querySelectorAll(`[data-qtd="${id}"]`).forEach(s => { s.textContent = nova; });
  atualizarContador();
}

const btnSacola = document.getElementById('btnSacola');
if (btnSacola) {
  btnSacola.onclick = () => {
    if (carrinho) abrirPedido();
    else mostrarMensagem('Sua sacola está vazia. Abra um restaurante e adicione itens.');
  };
}

function abrirPedido() {
  const linhas = Object.values(carrinho.itens)
    .map(i => `<li><span>${i.qtd}× ${esc(i.nome)}</span><span>${formatarPreco(i.qtd * i.preco)}</span></li>`)
    .join('');

  dlgPedido.innerHTML = `
    <form id="formPedido" method="dialog">
      <h3>Sua sacola · ${esc(carrinho.loja.name)}</h3>
      <ul class="resumo">
        ${linhas}
        <li class="resumo-total"><span>Total</span><span>${formatarPreco(totais().total)}</span></li>
      </ul>
      <label for="pNome">Seu nome</label>
      <input id="pNome" required placeholder="Como devemos te chamar?">

      <label for="pTipo">Como deseja receber?</label>
      <select id="pTipo">
        <option value="Entrega">Entrega</option>
        <option value="Retirada">Retirar no restaurante</option>
      </select>

      <div id="blocoEndereco">
        <label for="pEndereco">Endereço de entrega</label>
        <input id="pEndereco" required placeholder="Rua, número, bairro e complemento">
      </div>

      <label for="pPagto">Forma de pagamento</label>
      <select id="pPagto">
        <option>Pix</option>
        <option>Cartão na entrega</option>
        <option>Dinheiro</option>
      </select>

      <div id="blocoTroco" hidden>
        <label for="pTroco">Troco para quanto?</label>
        <input id="pTroco" placeholder="Ex.: R$ 100,00">
      </div>

      <label for="pObs">Observações</label>
      <textarea id="pObs" placeholder="Ex.: sem cebola, borda recheada..."></textarea>

      <div class="acoes">
        <button type="submit">Enviar pedido por WhatsApp</button>
        <button type="button" id="simularPedido">Simular pedido + QR</button>
        <button type="button" class="perigo" id="fecharPedido">Voltar</button>
      </div>
    </form>`;

  const $ = id => dlgPedido.querySelector('#' + id);
  $('pTipo').onchange = e => {
    const ent = e.target.value === 'Entrega';
    $('blocoEndereco').hidden = !ent;
    $('pEndereco').required = ent;
  };
  $('pPagto').onchange = e => {
    $('blocoTroco').hidden = e.target.value !== 'Dinheiro';
  };
  $('fecharPedido').onclick = () => fecharModalSeguro(dlgPedido);
  $('simularPedido').onclick = () => finalizarSimulado($);
  $('formPedido').onsubmit = ev => {
    ev.preventDefault();
    enviarPedido($);
  };

  abrirModalSeguro(dlgPedido);
}

function limparSacola() {
  carrinho = null;
  document.querySelectorAll('[data-qtd]').forEach(s => { s.textContent = '0'; });
  atualizarContador();
}

function finalizarSimulado($) {
  const nomeCliente = ($('pNome').value || '').trim() || 'Aluno Teste';
  const codigoPedido = 'PED-' + Math.floor(1000 + Math.random() * 9000);
  const resumoTexto = `${codigoPedido} | ${carrinho.loja.name} | Cliente: ${nomeCliente} | Total: ${formatarPreco(totais().total)}`;
  fecharModalSeguro(dlgPedido);
  limparSacola();
  mostrarMensagem(`Pedido de teste ${codigoPedido} registrado para ${nomeCliente}!`, 'sucesso');
  abrirQrCode(`Pedido ${codigoPedido}`, resumoTexto);
}

function enviarPedido($) {
  let fone = (carrinho.loja.phone || '').replace(/\D/g, '');
  if (fone.length < 10) return alert('Este restaurante ainda não cadastrou um telefone para receber pedidos.');
  if (fone.length <= 11) fone = '55' + fone;

  const entrega = $('pTipo').value === 'Entrega';
  const pg = $('pPagto').value;
  const msg = [
    `*Novo pedido - ${carrinho.loja.name}*`,
    '',
    `Cliente: ${$('pNome').value.trim()}`,
    entrega ? `Entrega: ${$('pEndereco').value.trim()}` : 'Retirada no restaurante',
    '',
    '*Itens:*',
    ...Object.values(carrinho.itens).map(i => `${i.qtd}x ${i.nome} - ${formatarPreco(i.qtd * i.preco)}`),
    '',
    `*Total: ${formatarPreco(totais().total)}*`,
    `Pagamento: ${pg}` + (pg === 'Dinheiro' && $('pTroco').value ? ` (troco para ${$('pTroco').value})` : ''),
    $('pObs').value.trim() ? `Obs.: ${$('pObs').value.trim()}` : ''
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

  window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank');
  fecharModalSeguro(dlgPedido);
  limparSacola();
  mostrarMensagem('Pedido enviado para o WhatsApp do restaurante. Aguarde a confirmação!', 'sucesso');
}

(async () => {
  await carregarLojas();
  const params = new URLSearchParams(location.search);
  const lojaParam = params.get('loja');
  if (lojaParam) abrirLoja(lojaParam);
})();
