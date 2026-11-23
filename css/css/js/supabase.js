const SUPABASE_URL = 'https://byycxurjjonbhrreoost.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CyvZ6fSv-rnd3tc_KhoVhg_jWxTrWOj';
const BUCKET = 'img_comidas';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mostrarMensagem(texto, tipo) {
  const el = document.getElementById('mensagem');
  if (!el) return;
  el.textContent = texto || '';
  el.className = 'mensagem' + (tipo ? ' ' + tipo : '');
}

function formatarPreco(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
