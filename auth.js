/* QR Studio — login, sessão e menu do usuário (compartilhado entre as páginas) */
(function () {
  'use strict';

  const CFG = window.QR_CONFIG || {};
  const API = (CFG.API_URL || '').trim();
  const MODO = API ? 'servidor' : 'local';
  const K_TOKEN = 'qrstudio.token';
  const K_EU = 'qrstudio.eu';

  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const PAPEIS = {
    admin: { nome: 'Administrador', desc: 'Tudo, inclusive gerenciar usuários' },
    editor: { nome: 'Editor', desc: 'Cria, edita, pausa e exclui QR Codes' },
    leitor: { nome: 'Visualizador', desc: 'Só vê e baixa os QR Codes' },
  };

  let eu = null;
  try { eu = JSON.parse(lsGet(K_EU)); } catch (e) { eu = null; }
  if (MODO === 'local') eu = { usuario: 'local', nome: 'Modo demonstração', papel: 'admin' };

  async function chamar(acao, extra, semToken) {
    const corpo = Object.assign({ acao }, extra || {});
    if (!semToken) corpo.token = lsGet(K_TOKEN) || '';
    let r;
    try {
      r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) });
    } catch (e) {
      throw new Error('Sem conexão com o servidor. Tente de novo.');
    }
    const d = await r.json();
    if (!d.ok) {
      if (d.sessao) { encerrar(); mostrarLogin(); }
      const err = new Error(d.erro || 'Erro no servidor');
      err.sessao = !!d.sessao;
      throw err;
    }
    return d;
  }

  function guardarSessao(d) {
    lsSet(K_TOKEN, d.token);
    lsSet(K_EU, JSON.stringify(d.eu));
    eu = d.eu;
  }

  function encerrar() {
    lsSet(K_TOKEN, null);
    lsSet(K_EU, null);
    eu = null;
  }

  // ---------- Tela de login ----------
  let resolverLogin = null;

  function mostrarLogin() {
    let tela = document.getElementById('telaLogin');
    if (!tela) {
      tela = document.createElement('div');
      tela.id = 'telaLogin';
      tela.className = 'login-fundo';
      document.body.appendChild(tela);
    }
    document.body.classList.add('sem-sessao');
    tela.hidden = false;
    tela.innerHTML = `<div class="login-caixa"><div class="marca login-marca">
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zm2 2h2v2h-2zm-6 2h2v2h-2zm4 0h2v2h-2zm-2 2h2v2h-2zm4 0h2v2h-2z"/></svg>
      <span>QR Studio</span></div><div class="carregando"><div class="spin"></div></div></div>`;
    chamar('estado', {}, true).then((d) => {
      if (d.temUsuarios) formEntrar(tela); else formPrimeiro(tela, d.pedeChave);
    }).catch((e) => {
      tela.querySelector('.carregando').outerHTML = `<p class="login-erro">${esc(e.message)}</p><button class="btn primario largo" onclick="location.reload()">Tentar de novo</button>`;
    });
  }

  function corpoLogin(tela, html) {
    const caixa = tela.querySelector('.login-caixa');
    caixa.querySelectorAll(':scope > :not(.login-marca)').forEach((n) => n.remove());
    caixa.insertAdjacentHTML('beforeend', html);
    return caixa;
  }

  function formEntrar(tela) {
    const c = corpoLogin(tela, `
      <h1>Entrar</h1>
      <form class="login-form" autocomplete="on">
        <label class="campo"><span>Usuário</span><input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        <label class="campo"><span>Senha</span><input name="senha" type="password" autocomplete="current-password" required></label>
        <p class="login-erro" hidden></p>
        <button class="btn primario largo" type="submit">Entrar</button>
      </form>
      <p class="nota login-rodape">Esqueceu a senha? Peça a um administrador para redefinir.</p>`);
    const f = c.querySelector('form');
    setTimeout(() => f.usuario.focus(), 30);
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      enviar(f, () => chamar('entrar', { usuario: f.usuario.value, senha: f.senha.value }, true));
    });
  }

  function formPrimeiro(tela, pedeChave) {
    const c = corpoLogin(tela, `
      <h1>Criar o administrador</h1>
      <p class="nota">Primeiro acesso: crie o seu usuário. Ele poderá cadastrar as outras pessoas depois.</p>
      <form class="login-form" autocomplete="off">
        <label class="campo"><span>Seu nome</span><input name="nome" autocomplete="name" required></label>
        <label class="campo"><span>Usuário</span><input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ex.: everton" required></label>
        <label class="campo"><span>Senha</span><input name="senha" type="password" autocomplete="new-password" minlength="8" placeholder="Mínimo 8 caracteres" required></label>
        <label class="campo"><span>Repita a senha</span><input name="senha2" type="password" autocomplete="new-password" required></label>
        ${pedeChave ? '<label class="campo"><span>Chave de acesso atual</span><input name="chave" type="password" autocomplete="off" required><small>A chave que você usava para entrar no painel. Ela prova que você é o dono.</small></label>' : ''}
        <p class="login-erro" hidden></p>
        <button class="btn primario largo" type="submit">Criar e entrar</button>
      </form>`);
    const f = c.querySelector('form');
    setTimeout(() => f.nome.focus(), 30);
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (f.senha.value !== f.senha2.value) return erroLogin(f, 'As senhas não conferem');
      enviar(f, () => chamar('primeiroAdmin', {
        nome: f.nome.value, usuario: f.usuario.value, senha: f.senha.value, chave: f.chave ? f.chave.value : '',
      }, true));
    });
  }

  function erroLogin(f, msg) {
    const p = f.querySelector('.login-erro');
    p.textContent = msg;
    p.hidden = false;
  }

  async function enviar(f, fn) {
    const b = f.querySelector('button[type=submit]');
    const txt = b.textContent;
    b.disabled = true; b.textContent = 'Aguarde…';
    f.querySelector('.login-erro').hidden = true;
    try {
      const d = await fn();
      guardarSessao(d);
      document.getElementById('telaLogin').hidden = true;
      document.body.classList.remove('sem-sessao');
      aplicarPapel();
      montarMenu();
      if (resolverLogin) { const r = resolverLogin; resolverLogin = null; r(eu); } else location.reload();
    } catch (e) {
      erroLogin(f, e.message);
    } finally {
      b.disabled = false; b.textContent = txt;
    }
  }

  /** Resolve com o usuário logado (pede login se precisar). */
  function exigirLogin() {
    aplicarPapel();
    if (MODO === 'local') { montarMenu(); return Promise.resolve(eu); }
    if (lsGet(K_TOKEN) && eu) { montarMenu(); return Promise.resolve(eu); }
    return new Promise((ok) => { resolverLogin = ok; mostrarLogin(); });
  }

  function aplicarPapel() {
    document.body.dataset.papel = eu ? eu.papel : '';
  }

  // ---------- Menu do usuário ----------
  function montarMenu() {
    const alvo = document.getElementById('menuUsuario');
    if (!alvo || !eu) return;
    const iniciais = (eu.nome || eu.usuario).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    const pagina = location.pathname.split('/').pop() || 'index.html';
    alvo.innerHTML = `
      <button class="avatar-btn" aria-haspopup="menu" aria-expanded="false" title="${esc(eu.nome)}">
        <span class="avatar">${esc(iniciais)}</span><span class="avatar-nome">${esc(eu.nome.split(' ')[0])}</span>
      </button>
      <div class="menu" role="menu" hidden>
        <div class="menu-topo"><b>${esc(eu.nome)}</b><span>@${esc(eu.usuario)} · ${esc(PAPEIS[eu.papel] ? PAPEIS[eu.papel].nome : eu.papel)}</span></div>
        ${pagina !== 'index.html' && pagina !== '' ? '<a role="menuitem" href="index.html">QR Codes</a>' : ''}
        ${eu.papel === 'admin' && pagina !== 'usuarios.html' ? '<a role="menuitem" href="usuarios.html">Usuários</a>' : ''}
        ${MODO === 'servidor' ? '<button role="menuitem" data-m="senha">Trocar minha senha</button><button role="menuitem" data-m="sair" class="perigo-txt">Sair</button>' : ''}
      </div>`;
    const btn = alvo.querySelector('.avatar-btn');
    const menu = alvo.querySelector('.menu');
    const fechar = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('click', (ev) => { if (!alvo.contains(ev.target)) fechar(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fechar(); });
    menu.addEventListener('click', (ev) => {
      const m = ev.target.closest('[data-m]');
      if (!m) return;
      fechar();
      if (m.dataset.m === 'sair') { encerrar(); location.reload(); }
      if (m.dataset.m === 'senha') trocarSenha();
    });
  }

  function trocarSenha() {
    const fundo = document.createElement('div');
    fundo.className = 'painel-fundo';
    fundo.innerHTML = `<div class="painel pequeno" role="dialog" aria-modal="true" aria-labelledby="tsTitulo">
      <header class="painel-topo"><h2 id="tsTitulo">Trocar minha senha</h2><button class="btn ghost icone" data-x aria-label="Fechar">✕</button></header>
      <form class="painel-corpo coluna">
        <label class="campo"><span>Senha atual</span><input name="atual" type="password" autocomplete="current-password" required></label>
        <label class="campo"><span>Nova senha</span><input name="nova" type="password" autocomplete="new-password" minlength="8" placeholder="Mínimo 8 caracteres" required></label>
        <label class="campo"><span>Repita a nova senha</span><input name="nova2" type="password" autocomplete="new-password" required></label>
        <p class="login-erro" hidden></p>
        <button class="btn primario" type="submit">Salvar nova senha</button>
      </form></div>`;
    document.body.appendChild(fundo);
    const f = fundo.querySelector('form');
    const fechar = () => fundo.remove();
    fundo.querySelector('[data-x]').addEventListener('click', fechar);
    fundo.addEventListener('mousedown', (ev) => { if (ev.target === fundo) fechar(); });
    setTimeout(() => f.atual.focus(), 30);
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (f.nova.value !== f.nova2.value) return erroLogin(f, 'As senhas não conferem');
      const b = f.querySelector('button[type=submit]');
      b.disabled = true;
      try {
        await chamar('trocarSenha', { senhaAtual: f.atual.value, novaSenha: f.nova.value });
        fechar();
        if (window.QRToast) window.QRToast('Senha alterada');
      } catch (e) { erroLogin(f, e.message); b.disabled = false; }
    });
  }

  window.Auth = {
    MODO, API, PAPEIS, esc,
    get eu() { return eu; },
    pode: (acao) => !!eu && (acao === 'editar' ? eu.papel !== 'leitor' : acao === 'usuarios' ? eu.papel === 'admin' : true),
    api: chamar,
    exigirLogin,
  };
})();
