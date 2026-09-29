/* QR Studio — página de usuários (só administradores) */
(function () {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = Auth.esc;
  const PAPEIS = Auth.PAPEIS;

  let toastTimer;
  function toast(msg, erro) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast mostrar' + (erro ? ' erro' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, erro ? 4500 : 2200);
  }
  window.QRToast = toast;

  const estado = { usuarios: [], filtro: 'todos', busca: '' };
  let ed = null; // { novo, usuario }

  const fmtData = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  const iniciais = (u) => (u.nome || u.usuario).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  function aviso(html) {
    $('#carregandoU').hidden = true;
    $('#listaU').innerHTML = '';
    const a = $('#avisoU');
    a.hidden = false;
    a.innerHTML = html;
  }

  async function carregar() {
    $('#carregandoU').hidden = false;
    try {
      const d = await Auth.api('listarUsuarios');
      estado.usuarios = d.usuarios;
      $('#carregandoU').hidden = true;
      render();
    } catch (e) {
      if (!e.sessao) aviso(`<h2>Não foi possível carregar</h2><p>${esc(e.message)}</p>`);
    }
  }

  function render() {
    const eu = Auth.eu;
    const b = estado.busca.toLowerCase();
    const lista = estado.usuarios
      .filter((u) => estado.filtro === 'todos' || (estado.filtro === 'inativos' ? !u.ativo : u.papel === estado.filtro && u.ativo))
      .filter((u) => !b || (u.nome + ' ' + u.usuario).toLowerCase().includes(b))
      .sort((a, c) => (a.papel === c.papel ? a.nome.localeCompare(c.nome) : ['admin', 'editor', 'leitor'].indexOf(a.papel) - ['admin', 'editor', 'leitor'].indexOf(c.papel)));

    $$('#filtrosU button').forEach((bt) => {
      const f = bt.dataset.f;
      const n = f === 'todos' ? estado.usuarios.length : f === 'inativos' ? estado.usuarios.filter((u) => !u.ativo).length : estado.usuarios.filter((u) => u.papel === f && u.ativo).length;
      bt.innerHTML = bt.textContent.replace(/\d+$/, '').trim() + (n ? `<span class="n">${n}</span>` : '');
    });

    const el = $('#listaU');
    if (!lista.length) { el.innerHTML = '<p class="nota">Ninguém encontrado com esse filtro.</p>'; return; }
    el.innerHTML = lista.map((u) => `
      <article class="usuario${u.ativo ? '' : ' inativo'}" data-u="${esc(u.usuario)}" tabindex="0">
        <span class="avatar grande papel-${esc(u.papel)}">${esc(iniciais(u))}</span>
        <div class="usuario-info">
          <div class="usuario-nome">${esc(u.nome)}${u.usuario === eu.usuario ? ' <span class="voce">você</span>' : ''}</div>
          <div class="usuario-login">@${esc(u.usuario)}</div>
        </div>
        <span class="selo papel-${esc(u.papel)}">${esc(PAPEIS[u.papel] ? PAPEIS[u.papel].nome : u.papel)}</span>
        <div class="usuario-meta">
          <b>${u.qrs || 0}</b> QR Code${u.qrs === 1 ? '' : 's'}<br>
          ${u.ativo ? (u.ultimoAcesso ? 'Último acesso ' + fmtData(u.ultimoAcesso) : 'Ainda não entrou') : '<span class="selo pausa">Desativado</span>'}
        </div>
        <button class="btn ghost" data-editar>Editar</button>
      </article>`).join('');
  }

  // ---------- Editor ----------
  function abrir(u) {
    ed = { novo: !u, usuario: u || null };
    const f = $('#formU');
    f.reset();
    $('#erroU').hidden = true;
    $('#euTitulo').textContent = u ? `Editar ${u.nome}` : 'Novo usuário';
    f.nome.value = u ? u.nome : '';
    f.usuario.value = u ? u.usuario : '';
    f.usuario.disabled = !!u;
    $('#ajudaUsuario').textContent = u ? 'O usuário não muda. Para trocar, crie outro e exclua este.' : 'Letras minúsculas, números, ponto e hífen. Não muda depois de criado.';
    f.ativo.checked = u ? u.ativo : true;
    const souEu = u && u.usuario === Auth.eu.usuario;
    $('#linhaAtivo').hidden = souEu;
    $('#rotuloSenha').textContent = u ? 'Redefinir senha (opcional)' : 'Senha';
    f.senha.placeholder = u ? 'Deixe vazio para manter a atual' : 'Mínimo 8 caracteres';
    f.senha.required = !u;
    $('#btnExcluirU').hidden = !u || souEu;
    $('#escolhaPapel').innerHTML = Object.keys(PAPEIS).map((p) => `
      <label class="papel-opcao">
        <input type="radio" name="papel" value="${p}" ${(u ? u.papel : 'editor') === p ? 'checked' : ''} ${souEu ? 'disabled' : ''}>
        <span><b>${PAPEIS[p].nome}</b><small>${PAPEIS[p].desc}</small></span>
      </label>`).join('') + (souEu ? '<small class="nota">Você não pode mudar o próprio papel.</small>' : '');
    $('#edUsuario').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => (u ? f.nome : f.nome).focus(), 30);
  }

  function fechar() {
    $('#edUsuario').hidden = true;
    document.body.style.overflow = '';
    ed = null;
  }

  function gerarSenha() {
    const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const r = crypto.getRandomValues(new Uint8Array(12));
    let s = '';
    r.forEach((x, i) => { s += a[x % a.length]; if (i === 3 || i === 7) s += '-'; });
    return s;
  }

  async function salvar() {
    const f = $('#formU');
    const erro = (m) => { const p = $('#erroU'); p.textContent = m; p.hidden = false; };
    $('#erroU').hidden = true;
    const dados = {
      novo: ed.novo,
      nome: f.nome.value.trim(),
      usuario: f.usuario.value.trim().toLowerCase(),
      papel: (f.querySelector('input[name=papel]:checked') || {}).value || (ed.usuario && ed.usuario.papel),
      ativo: $('#linhaAtivo').hidden ? true : f.ativo.checked,
      senha: f.senha.value,
    };
    if (!dados.nome) return erro('Informe o nome');
    if (!/^[a-z0-9._-]{3,40}$/.test(dados.usuario)) return erro('Usuário: 3 a 40 caracteres (letras minúsculas, números, ponto, hífen)');
    if ((ed.novo || dados.senha) && dados.senha.length < 8) return erro('A senha precisa ter pelo menos 8 caracteres');
    if (!dados.senha) delete dados.senha;

    const b = $('#btnSalvarU');
    b.disabled = true; b.textContent = 'Salvando…';
    try {
      const d = await Auth.api('salvarUsuario', { usuario: dados });
      const i = estado.usuarios.findIndex((x) => x.usuario === d.usuario.usuario);
      if (i >= 0) estado.usuarios[i] = d.usuario; else estado.usuarios.push(d.usuario);
      const eraNovo = ed.novo;
      fechar();
      render();
      toast(eraNovo ? `Usuário @${d.usuario.usuario} criado` : 'Alterações salvas');
    } catch (e) {
      erro(e.message);
    } finally {
      b.disabled = false; b.textContent = 'Salvar';
    }
  }

  async function excluir() {
    const u = ed.usuario;
    if (!confirm(`Excluir @${u.usuario} (${u.nome})? A pessoa perde o acesso na hora. Os ${u.qrs || 0} QR Code(s) que ela criou continuam funcionando e ficam visíveis só para administradores.`)) return;
    try {
      await Auth.api('excluirUsuario', { login: u.usuario });
      estado.usuarios = estado.usuarios.filter((x) => x.usuario !== u.usuario);
      fechar();
      render();
      toast('Usuário excluído');
    } catch (e) { toast(e.message, true); }
  }

  // ---------- Eventos ----------
  $('#btnNovoUsuario').addEventListener('click', () => abrir(null));
  $('#listaU').addEventListener('click', (ev) => {
    const card = ev.target.closest('.usuario');
    if (card) abrir(estado.usuarios.find((u) => u.usuario === card.dataset.u));
  });
  $('#listaU').addEventListener('keydown', (ev) => {
    const card = ev.target.closest('.usuario');
    if (card && ev.key === 'Enter') abrir(estado.usuarios.find((u) => u.usuario === card.dataset.u));
  });
  $('#filtrosU').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    estado.filtro = b.dataset.f;
    $$('#filtrosU button').forEach((x) => x.classList.toggle('ativo', x === b));
    render();
  });
  $('#buscaU').addEventListener('input', (ev) => { estado.busca = ev.target.value; render(); });
  $$('[data-fechar]').forEach((b) => b.addEventListener('click', fechar));
  $('#edUsuario').addEventListener('mousedown', (ev) => { if (ev.target.id === 'edUsuario') fechar(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ed) fechar(); });
  $('#btnSalvarU').addEventListener('click', salvar);
  $('#formU').addEventListener('submit', (ev) => { ev.preventDefault(); salvar(); });
  $('#btnExcluirU').addEventListener('click', excluir);
  $('#btnGerarSenha').addEventListener('click', () => { $('#formU').senha.value = gerarSenha(); });
  $('#btnCopiarSenha').addEventListener('click', async () => {
    const v = $('#formU').senha.value;
    if (!v) return toast('Gere ou digite uma senha primeiro', true);
    try { await navigator.clipboard.writeText(v); toast('Senha copiada'); } catch (e) { toast('Não consegui copiar', true); }
  });
  $('#formU').usuario.addEventListener('input', (ev) => { ev.target.value = ev.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''); });

  $('#legenda').innerHTML = Object.keys(PAPEIS).map((p) => `<div class="legenda-item"><span class="selo papel-${p}">${PAPEIS[p].nome}</span><span>${PAPEIS[p].desc}</span></div>`).join('');

  // ---------- Início ----------
  Auth.exigirLogin().then((eu) => {
    if (Auth.MODO === 'local') return aviso('<h2>Precisa do servidor</h2><p>Usuários só existem com o servidor conectado (API_URL em config.js).</p>');
    if (eu.papel !== 'admin') return aviso('<h2>Só para administradores</h2><p>Peça a um administrador para mudar o seu papel.</p><a class="btn primario" href="index.html">Voltar aos QR Codes</a>');
    $('#btnNovoUsuario').hidden = false;
    carregar();
  });
})();
