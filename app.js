/* QR Studio — painel de QR Codes dinâmicos */
(function () {
  'use strict';

  // ================= Configuração =================
  const CFG = window.QR_CONFIG || {};
  const API = (CFG.API_URL || '').trim();
  const MODO = API ? 'servidor' : 'local';
  const BASE = (CFG.BASE_URL || (location.protocol.startsWith('http') ? location.origin : 'https://seu-site.netlify.app')).replace(/\/+$/, '');
  const K_CHAVE = 'qrstudio.chave';
  const K_LOCAL = 'qrstudio.dados';

  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };

  const linkDe = (code) => `${BASE}/q/${code}`;

  // ================= Estilos =================
  const ESTILO_BASE = {
    shape: 'square',
    dotsType: 'square', dotsColor: '#111111', dotsColor2: '#4f46e5', grad: 'none',
    cSqType: 'square', cSqColor: '#111111',
    cDotType: 'square', cDotColor: '#111111',
    bg: '#ffffff', transp: false,
    ecl: 'Q', margin: 12,
    logo: '', logoSize: 0.35, logoMargin: 6, hideDots: true,
    frame: 'none', frameText: 'ESCANEIE AQUI', frameColor: '#111111', frameTextColor: '#ffffff',
  };
  const normalizar = (e) => Object.assign({}, ESTILO_BASE, e || {});

  const PADROES = [
    { nome: 'Clássico', estilo: {} },
    { nome: 'Suave', estilo: { dotsType: 'rounded', dotsColor: '#1e293b', cSqType: 'extra-rounded', cSqColor: '#1e293b', cDotType: 'dot', cDotColor: '#4f46e5' } },
    { nome: 'Pontos', estilo: { dotsType: 'dots', dotsColor: '#111827', cSqType: 'extra-rounded', cSqColor: '#111827', cDotType: 'dot', cDotColor: '#111827' } },
    { nome: 'Circular', estilo: { shape: 'circle', dotsType: 'dots', dotsColor: '#0f172a', cSqType: 'extra-rounded', cSqColor: '#4f46e5', cDotType: 'dot', cDotColor: '#4f46e5' } },
    { nome: 'Degradê', estilo: { dotsType: 'rounded', grad: 'linear', dotsColor: '#6d28d9', dotsColor2: '#2563eb', cSqType: 'extra-rounded', cSqColor: '#6d28d9', cDotType: 'dot', cDotColor: '#2563eb' } },
    { nome: 'Elegante', estilo: { dotsType: 'classy-rounded', dotsColor: '#3d2f1f', cSqType: 'extra-rounded', cSqColor: '#8a6a2f', cDotType: 'dot', cDotColor: '#8a6a2f', bg: '#fffaf0' } },
    { nome: 'Oceano', estilo: { dotsType: 'classy', grad: 'radial', dotsColor: '#0e7490', dotsColor2: '#1e3a8a', cSqType: 'extra-rounded', cSqColor: '#0c4a6e', cDotType: 'square', cDotColor: '#0e7490' } },
    { nome: 'Floresta', estilo: { dotsType: 'extra-rounded', dotsColor: '#14532d', cSqType: 'extra-rounded', cSqColor: '#15803d', cDotType: 'dot', cDotColor: '#14532d', bg: '#f3faf5' } },
    { nome: 'Coral', estilo: { dotsType: 'dots', dotsColor: '#9f1239', cSqType: 'dot', cSqColor: '#e11d48', cDotType: 'dot', cDotColor: '#9f1239' } },
    { nome: 'Etiqueta', estilo: { dotsType: 'rounded', dotsColor: '#111111', cSqType: 'extra-rounded', cSqColor: '#111111', cDotType: 'dot', cDotColor: '#111111', frame: 'etiqueta', frameColor: '#111111', frameTextColor: '#ffffff' } },
    { nome: 'Moldura', estilo: { dotsType: 'square', dotsColor: '#1e1b4b', cSqType: 'square', cSqColor: '#1e1b4b', cDotType: 'square', cDotColor: '#4f46e5', frame: 'caixa', frameColor: '#1e1b4b', frameTextColor: '#ffffff' } },
  ];

  const OPCOES = {
    shape: [['square', 'Quadrado'], ['circle', 'Circular']],
    dotsType: [['square', 'Quadrado'], ['dots', 'Pontos'], ['rounded', 'Arredondado'], ['extra-rounded', 'Bem redondo'], ['classy', 'Clássico'], ['classy-rounded', 'Folha']],
    cSqType: [['square', 'Quadrado'], ['extra-rounded', 'Arredondado'], ['dot', 'Círculo'], ['rounded', 'Suave'], ['classy', 'Folha']],
    cDotType: [['square', 'Quadrado'], ['dot', 'Círculo'], ['rounded', 'Suave'], ['classy', 'Folha'], ['extra-rounded', 'Gota']],
    frame: [['none', 'Sem moldura'], ['caixa', 'Caixa'], ['topo', 'Texto em cima'], ['etiqueta', 'Etiqueta']],
  };

  // ================= Cores =================
  const hexRgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgbHex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
  const lum = (hex) => { const c = hexRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const escurecer = (hex, t) => { const [r, g, b] = hexRgb(hex); return rgbHex(r * (1 - t), g * (1 - t), b * (1 - t)); };
  const garantirContraste = (hex, fundo, min) => { let c = hex, i = 0; while (contraste(c, fundo) < min && i++ < 30) c = escurecer(c, 0.08); return c; };

  // ================= Geração do QR Code =================
  function opcoesQR(e, dados, S) {
    const k = S / 300;
    const dots = { type: e.dotsType, color: e.dotsColor };
    if (e.grad !== 'none') {
      dots.gradient = { type: e.grad, rotation: Math.PI / 4, colorStops: [{ offset: 0, color: e.dotsColor }, { offset: 1, color: e.dotsColor2 }] };
    }
    const semFundo = e.transp || e.frame !== 'none';
    const o = {
      width: S, height: S, type: 'svg', data: dados, shape: e.shape,
      margin: Math.round(e.margin * k),
      qrOptions: { errorCorrectionLevel: e.logo ? (e.ecl === 'L' || e.ecl === 'M' ? 'Q' : e.ecl) : e.ecl },
      dotsOptions: dots,
      cornersSquareOptions: { type: e.cSqType, color: e.cSqColor },
      cornersDotOptions: { type: e.cDotType, color: e.cDotColor },
      backgroundOptions: { color: semFundo ? 'transparent' : e.bg },
    };
    if (e.logo) {
      o.image = e.logo;
      o.imageOptions = { hideBackgroundDots: e.hideDots, imageSize: e.logoSize, margin: Math.round(e.logoMargin * k), crossOrigin: 'anonymous', saveAsBlob: true };
    }
    return o;
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FONTE = 'Arial, Helvetica, sans-serif';

  /** Gera o SVG final (QR + moldura). Devolve { svg, w, h }. */
  async function montarSVG(estilo, dados, S) {
    const e = normalizar(estilo);
    S = S || 1000;
    const qr = new QRCodeStyling(opcoesQR(e, dados, S));
    const blob = await qr.getRawData('svg');
    const txt = await blob.text();
    if (e.frame === 'none') return { svg: txt, w: S, h: S };

    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
    const raiz = doc.documentElement;
    raiz.setAttribute('viewBox', `0 0 ${S} ${S}`);
    const coloca = (x, y) => { raiz.setAttribute('x', x); raiz.setAttribute('y', y); raiz.setAttribute('width', S); raiz.setAttribute('height', S); return new XMLSerializer().serializeToString(raiz); };
    const fundo = e.transp ? 'none' : e.bg;
    const texto = esc(e.frameText || '');
    let W, H, corpo;

    if (e.frame === 'caixa' || e.frame === 'topo') {
      const p = Math.round(S * 0.05), faixa = Math.round(S * 0.2);
      W = S + 2 * p; H = S + p + faixa;
      const topo = e.frame === 'topo';
      const yQR = topo ? faixa : p;
      const yTxt = topo ? faixa / 2 + p / 4 : S + p + faixa / 2 - p / 4;
      corpo =
        `<rect width="${W}" height="${H}" rx="${S * 0.07}" fill="${e.frameColor}"/>` +
        `<rect x="${p}" y="${yQR}" width="${S}" height="${S}" rx="${S * 0.04}" fill="${fundo === 'none' ? '#ffffff' : fundo}"/>` +
        coloca(p, yQR) +
        `<text x="${W / 2}" y="${yTxt}" text-anchor="middle" dominant-baseline="central" font-family="${FONTE}" font-weight="700" font-size="${faixa * 0.38}" letter-spacing="${S * 0.006}" fill="${e.frameTextColor}">${texto}</text>`;
    } else {
      const ph = Math.round(S * 0.13), pw = Math.round(S * 0.78), extra = Math.round(S * 0.19);
      W = S; H = S + extra;
      const px = (S - pw) / 2, py = S + extra - ph - S * 0.03;
      corpo =
        (fundo === 'none' ? '' : `<rect width="${W}" height="${H}" rx="${S * 0.04}" fill="${fundo}"/>`) +
        coloca(0, 0) +
        `<path d="M${S / 2 - S * 0.03} ${py + 1} L${S / 2} ${py - S * 0.03} L${S / 2 + S * 0.03} ${py + 1}Z" fill="${e.frameColor}"/>` +
        `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="${e.frameColor}"/>` +
        `<text x="${S / 2}" y="${py + ph / 2}" text-anchor="middle" dominant-baseline="central" font-family="${FONTE}" font-weight="700" font-size="${ph * 0.42}" letter-spacing="${S * 0.005}" fill="${e.frameTextColor}">${texto}</text>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${corpo}</svg>`;
    return { svg, w: W, h: H };
  }

  const urlDeSVG = (svg) => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

  async function imagemEm(el, estilo, dados, S, antigo) {
    const r = await montarSVG(estilo, dados, S);
    const url = urlDeSVG(r.svg);
    if (antigo) URL.revokeObjectURL(antigo);
    el.innerHTML = '';
    const img = new Image();
    img.alt = '';
    img.src = url;
    img.style.cssText = 'max-width:100%;max-height:100%;display:block';
    el.appendChild(img);
    return url;
  }

  async function baixar(estilo, dados, fmt, tam, nome) {
    const { svg, w, h } = await montarSVG(estilo, dados, 1000);
    const alt = Math.round(tam * h / w);
    let blob;
    if (fmt === 'svg') {
      blob = new Blob([svg.replace(/^(<svg[^>]*?)width="[\d.]+" height="[\d.]+"/, `$1width="${tam}" height="${alt}"`)], { type: 'image/svg+xml' });
    } else {
      const img = new Image();
      const url = urlDeSVG(svg);
      img.src = url;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = tam; cv.height = alt;
      const cx = cv.getContext('2d');
      const e = normalizar(estilo);
      if (fmt === 'jpeg') { cx.fillStyle = e.transp ? '#ffffff' : e.bg; cx.fillRect(0, 0, tam, alt); }
      cx.drawImage(img, 0, 0, tam, alt);
      URL.revokeObjectURL(url);
      blob = await new Promise((ok) => cv.toBlob(ok, 'image/' + fmt, 0.95));
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${nome}.${fmt === 'jpeg' ? 'jpg' : fmt}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ================= Logo =================
  const carregarImg = (src) => new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = src; });
  const lerArquivo = (f) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = falha; r.readAsDataURL(f); });

  async function prepararLogo(arquivo) {
    const img = await carregarImg(await lerArquivo(arquivo));
    const w0 = img.naturalWidth || 256, h0 = img.naturalHeight || 256;
    let max = 320, out = '';
    do {
      const k = Math.min(1, max / Math.max(w0, h0));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      out = cv.toDataURL('image/png');
      max = Math.round(max * 0.8);
    } while (out.length > 36000 && max > 64);
    return out;
  }

  /** Lê formato e cores da logo para montar um QR Code que combine com ela. */
  async function analisarLogo(dataUrl) {
    const img = await carregarImg(dataUrl);
    const N = 96;
    const k = N / Math.max(img.naturalWidth || N, img.naturalHeight || N);
    const w = Math.max(1, Math.round((img.naturalWidth || N) * k)), h = Math.max(1, Math.round((img.naturalHeight || N) * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, w, h);
    const px = cx.getImageData(0, 0, w, h).data;

    let transparentes = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 20) transparentes++;
    const temAlfa = transparentes > w * h * 0.08;
    const cantos = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => { const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2]]; });
    const fundo = cantos.reduce((a, c) => [a[0] + c[0] / 4, a[1] + c[1] / 4, a[2] + c[2] / 4], [0, 0, 0]);

    const mask = new Uint8Array(w * h);
    let minX = w, minY = h, maxX = -1, maxY = -1, total = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const on = temAlfa ? px[i + 3] >= 128 : Math.hypot(px[i] - fundo[0], px[i + 1] - fundo[1], px[i + 2] - fundo[2]) > 60;
      if (on) { mask[y * w + x] = 1; total++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (!total) return null;
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const preench = total / (bw * bh);
    const aspecto = bw / bh;

    // Quanto os cantos do contorno estão ocupados: logo quadrada ocupa, redonda deixa vazio.
    let cantoOn = 0, cantoTot = 0;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const u = (x - minX) / bw, v = (y - minY) / bh;
      const du = Math.min(u, 1 - u), dv = Math.min(v, 1 - v);
      if (du + dv < 0.16) { cantoTot++; cantoOn += mask[y * w + x]; }
    }
    const cantoCheio = cantoTot ? cantoOn / cantoTot : 0;

    // Paleta: agrupa as cores da logo e ordena por presença.
    const baldes = new Map();
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue;
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      const chave = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
      const bk = baldes.get(chave) || { n: 0, r: 0, g: 0, b: 0 };
      bk.n++; bk.r += r; bk.g += g; bk.b += b;
      baldes.set(chave, bk);
    }
    const cores = [];
    [...baldes.values()].sort((a, b) => b.n - a.n).forEach((bk) => {
      const hex = rgbHex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n);
      if (lum(hex) > 0.85) return; // branco não serve para os pontos
      const [r, g, b] = hexRgb(hex);
      const perto = cores.find((c) => { const [r2, g2, b2] = hexRgb(c.hex); return Math.hypot(r - r2, g - g2, b - b2) < 56; });
      if (perto) perto.n += bk.n; else cores.push({ hex, n: bk.n });
    });
    cores.sort((a, b) => b.n - a.n);
    // Descarta tons de borda (antisserrilhado) que ocupam quase nada da logo.
    const paleta = cores.filter((c, i) => i === 0 || c.n > total * 0.04).slice(0, 6).map((c) => c.hex);

    let forma;
    if (cantoCheio < 0.2 && preench > 0.55 && Math.abs(aspecto - 1) < 0.25) forma = 'circular';
    else if (preench > 0.5 && cantoCheio < 0.6) forma = 'arredondada';
    else if (preench > 0.5) forma = 'quadrada';
    else forma = 'fina';
    return { forma, paleta, aspecto };
  }

  function estiloCombinando(base, analise) {
    const e = normalizar(base);
    const MAPA = {
      circular: { shape: 'circle', dotsType: 'dots', cSqType: 'extra-rounded', cDotType: 'dot' },
      arredondada: { shape: 'square', dotsType: 'rounded', cSqType: 'extra-rounded', cDotType: 'dot' },
      quadrada: { shape: 'square', dotsType: 'square', cSqType: 'square', cDotType: 'square' },
      fina: { shape: 'square', dotsType: 'classy-rounded', cSqType: 'extra-rounded', cDotType: 'dot' },
    };
    Object.assign(e, MAPA[analise.forma]);
    const fundo = e.transp ? '#ffffff' : e.bg;
    const p = analise.paleta;
    if (p.length) {
      const principal = garantirContraste(p[0], fundo, 4);
      const segunda = p[1] ? garantirContraste(p[1], fundo, 3.2) : escurecer(principal, 0.25);
      e.dotsColor = principal;
      e.dotsColor2 = segunda;
      e.cSqColor = segunda;
      e.cDotColor = principal;
      e.grad = 'none';
      e.frameColor = principal;
      e.frameTextColor = lum(principal) > 0.4 ? '#111111' : '#ffffff';
    }
    e.ecl = 'H';
    e.hideDots = true;
    e.logoSize = analise.aspecto > 1.6 ? 0.45 : analise.forma === 'circular' ? 0.3 : 0.34;
    return e;
  }

  const NOMES_FORMA = {
    circular: 'Logo circular → QR Code circular com pontos redondos.',
    arredondada: 'Logo com cantos arredondados → pontos e cantos arredondados.',
    quadrada: 'Logo geométrica/quadrada → pontos e cantos retos.',
    fina: 'Logo de traço fino/tipográfica → pontos elegantes em folha.',
  };

  // ================= Armazenamento =================
  const Local = {
    ler() { try { return JSON.parse(lsGet(K_LOCAL)) || { qrs: [], padroes: [] }; } catch (e) { return { qrs: [], padroes: [] }; } },
    gravar(d) { lsSet(K_LOCAL, JSON.stringify(d)); },
  };

  async function api(acao, extra) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ acao, chave: lsGet(K_CHAVE) || '' }, extra || {})),
    });
    const d = await r.json();
    if (!d.ok) { const err = new Error(d.erro || 'Erro no servidor'); err.chave = /chave/i.test(d.erro || ''); throw err; }
    return d;
  }

  const Store = {
    async carregar() {
      if (MODO === 'local') return Local.ler();
      const d = await api('listar');
      return { qrs: d.qrs, padroes: d.padroes };
    },
    async salvar(qr) {
      if (MODO === 'servidor') return (await api('salvar', { qr })).qr;
      const d = Local.ler();
      const i = d.qrs.findIndex((x) => x.code === qr.code);
      const atual = i >= 0 ? d.qrs[i] : null;
      if (qr.novo && atual) throw new Error(`Já existe um QR Code com o código "${qr.code}"`);
      const agora = new Date().toISOString();
      const historico = atual ? atual.historico.slice() : [];
      if (!atual || atual.url !== qr.url) historico.unshift({ url: qr.url, em: agora });
      const reg = {
        code: qr.code, nome: qr.nome, url: qr.url, ativo: qr.ativo, expiraEm: qr.expiraEm, maxLeituras: qr.maxLeituras,
        urlExpirado: qr.urlExpirado, leituras: atual && !qr.zerarLeituras ? atual.leituras : 0,
        ultimaLeitura: atual && !qr.zerarLeituras ? atual.ultimaLeitura : '', criadoEm: atual ? atual.criadoEm : agora,
        atualizadoEm: agora, estilo: qr.estilo, historico: historico.slice(0, 20),
      };
      if (i >= 0) d.qrs[i] = reg; else d.qrs.push(reg);
      Local.gravar(d);
      return reg;
    },
    async excluir(code) {
      if (MODO === 'servidor') return api('excluir', { code });
      const d = Local.ler(); d.qrs = d.qrs.filter((x) => x.code !== code); Local.gravar(d);
    },
    async leituras(code) {
      if (MODO === 'servidor') return (await api('leituras', { code })).dias;
      return null;
    },
    async salvarPadrao(p) {
      if (MODO === 'servidor') return (await api('salvarPadrao', { padrao: p })).padrao;
      const d = Local.ler(); const reg = Object.assign({ id: Math.random().toString(36).slice(2, 10) }, p);
      d.padroes.push(reg); Local.gravar(d); return reg;
    },
    async excluirPadrao(id) {
      if (MODO === 'servidor') return api('excluirPadrao', { id });
      const d = Local.ler(); d.padroes = d.padroes.filter((x) => x.id !== id); Local.gravar(d);
    },
  };

  // ================= Utilitários de interface =================
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  let toastTimer;
  function toast(msg, erro) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast mostrar' + (erro ? ' erro' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, erro ? 4500 : 2200);
  }
  const fmtData = (iso, soDia) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const o = soDia ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleString('pt-BR', o);
  };
  function daquiA(iso) {
    const ms = new Date(iso) - Date.now();
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `${h} h`;
    return `${Math.round(h / 24)} dias`;
  }
  const paraLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const codigoAleatorio = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint8Array(6)); r.forEach((x) => { s += a[x % a.length]; }); return s; };
  const copiar = async (txt) => { try { await navigator.clipboard.writeText(txt); toast('Link copiado'); } catch (e) { prompt('Copie o link:', txt); } };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function status(qr) {
    const exp = qr.expiraEm && Date.now() > new Date(qr.expiraEm);
    const lim = qr.maxLeituras > 0 && qr.leituras >= qr.maxLeituras;
    if (!qr.ativo) return { id: 'pausados', cls: 'pausa', txt: 'Pausado' };
    if (exp || lim) return { id: 'expirados', cls: 'exp', txt: 'Expirado' };
    if (qr.expiraEm) return { id: 'temporarios', cls: 'temp', txt: `Expira em ${daquiA(qr.expiraEm)}` };
    if (qr.maxLeituras > 0) return { id: 'temporarios', cls: 'temp', txt: `Restam ${qr.maxLeituras - qr.leituras} leituras` };
    return { id: 'ativos', cls: 'ok', txt: 'Ativo' };
  }

  // ================= Estado =================
  const estado = { qrs: [], padroes: [], filtro: 'todos', busca: '' };
  const miniCache = new Map();

  async function carregar() {
    $('#carregando').hidden = false;
    $('#grade').innerHTML = '';
    $('#vazio').hidden = true;
    try {
      const d = await Store.carregar();
      estado.qrs = (d.qrs || []).map((q) => Object.assign(q, { estilo: normalizar(q.estilo) }));
      estado.padroes = d.padroes || [];
    } catch (err) {
      if (err.chave) abrirConfig();
      toast(err.message === 'Failed to fetch' ? 'Não consegui falar com o servidor. Confira a URL em config.js.' : err.message, true);
    }
    $('#carregando').hidden = true;
    renderLista();
  }

  function renderResumo() {
    const n = { ativos: 0, temporarios: 0, expirados: 0, pausados: 0 };
    let leituras = 0;
    estado.qrs.forEach((q) => { n[status(q).id]++; leituras += q.leituras || 0; });
    const kpi = (v, t) => `<div class="kpi"><b>${v.toLocaleString('pt-BR')}</b><span>${t}</span></div>`;
    $('#resumo').innerHTML =
      kpi(estado.qrs.length, 'QR Codes') + kpi(n.ativos + n.temporarios, 'no ar agora') +
      kpi(n.temporarios, 'temporários') + kpi(leituras, MODO === 'local' ? 'leituras (só com servidor)' : 'leituras no total');
    $$('#filtros button').forEach((b) => {
      const f = b.dataset.f;
      const c = f === 'todos' ? estado.qrs.length : n[f];
      b.innerHTML = b.textContent.replace(/\d+$/, '').trim() + (c ? `<span class="n">${c}</span>` : '');
    });
  }

  function renderLista() {
    renderResumo();
    const g = $('#grade');
    const busca = estado.busca.toLowerCase();
    const lista = estado.qrs
      .filter((q) => estado.filtro === 'todos' || status(q).id === estado.filtro)
      .filter((q) => !busca || [q.nome, q.code, q.url].join(' ').toLowerCase().includes(busca))
      .sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));

    $('#vazio').hidden = estado.qrs.length > 0;
    g.innerHTML = '';
    if (!lista.length && estado.qrs.length) {
      g.innerHTML = '<p class="nota">Nada encontrado com esse filtro.</p>';
      return;
    }
    lista.forEach((q) => {
      const st = status(q);
      const el = document.createElement('article');
      el.className = 'card' + (st.id === 'pausados' || st.id === 'expirados' ? ' inativo' : '');
      el.innerHTML = `
        <div class="card-qr" data-a="editar" title="Editar"><div></div></div>
        <div class="card-corpo">
          <div class="card-titulo"><h2>${esc(q.nome || q.code)}</h2><span class="selo ${st.cls}">${esc(st.txt)}</span></div>
          <div class="card-destino">→ <a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.url.replace(/^https?:\/\//, ''))}</a></div>
          <button class="card-curto" data-a="copiar" title="Copiar link curto">${esc(linkDe(q.code).replace(/^https?:\/\//, ''))}</button>
          <div class="card-meta"><span>${(q.leituras || 0).toLocaleString('pt-BR')} leituras</span><span>criado ${fmtData(q.criadoEm, true)}</span></div>
        </div>
        <div class="card-acoes">
          <button data-a="editar">Editar</button>
          <button data-a="baixar">Baixar</button>
          <button data-a="pausar">${q.ativo ? 'Pausar' : 'Ativar'}</button>
        </div>`;
      el.addEventListener('click', (ev) => {
        const a = ev.target.closest('[data-a]');
        if (!a) return;
        if (a.dataset.a === 'editar') abrirEditor(q);
        if (a.dataset.a === 'copiar') copiar(linkDe(q.code));
        if (a.dataset.a === 'baixar') baixar(q.estilo, linkDe(q.code), 'png', 1024, `qr-${q.code}`).catch((e) => toast(e.message, true));
        if (a.dataset.a === 'pausar') alternarAtivo(q, a);
      });
      g.appendChild(el);
      const chave = q.code + JSON.stringify(q.estilo).length + JSON.stringify(q.estilo).slice(0, 400) + (q.estilo.logo || '').slice(-60);
      const alvo = $('.card-qr > div', el);
      if (miniCache.has(chave)) {
        alvo.innerHTML = `<img alt="" src="${miniCache.get(chave)}" style="max-width:100%;max-height:100%;display:block">`;
      } else {
        montarSVG(q.estilo, linkDe(q.code), 320).then((r) => {
          const u = urlDeSVG(r.svg);
          miniCache.set(chave, u);
          alvo.innerHTML = `<img alt="" src="${u}" style="max-width:100%;max-height:100%;display:block">`;
        }).catch(() => {});
      }
    });
  }

  async function alternarAtivo(q, botao) {
    botao.disabled = true;
    try {
      const reg = await Store.salvar(Object.assign({}, q, { ativo: !q.ativo, novo: false }));
      Object.assign(q, reg, { estilo: normalizar(reg.estilo) });
      toast(q.ativo ? 'QR Code ativado' : 'QR Code pausado');
      renderLista();
    } catch (e) { toast(e.message, true); botao.disabled = false; }
  }

  // ================= Editor =================
  let ed = null; // { novo, qr, estilo, tipo }
  let previaUrl = null, previaToken = 0;

  function abrirEditor(qr) {
    const novo = !qr;
    const base = qr ? JSON.parse(JSON.stringify(qr)) : {
      code: gerarCodigoUnico(), nome: '', url: '', ativo: true, expiraEm: '', maxLeituras: 0, urlExpirado: '', leituras: 0, historico: [],
      estilo: normalizar(ultimoEstilo()),
    };
    ed = { novo, qr: base, estilo: normalizar(base.estilo), tipo: base.expiraEm || base.maxLeituras ? 'temporario' : 'permanente' };

    $('#edTitulo').textContent = novo ? 'Novo QR Code' : (qr.nome || qr.code);
    $('#fNome').value = base.nome;
    $('#fUrl').value = base.url;
    $('#fCode').value = base.code;
    $('#fCode').disabled = !novo;
    $('#fCodeAjuda').textContent = novo ? 'Letras minúsculas, números e hífen. Não muda depois de criado.' : 'O código é fixo: é ele que está impresso no QR Code.';
    $('#fPrefixo').textContent = '‎' + BASE.replace(/^https?:\/\//, '') + '/q/‎';
    $('#fAtivo').checked = base.ativo;
    $('#fExpira').value = paraLocalInput(base.expiraEm);
    $('#fMax').value = base.maxLeituras || '';
    $('#fUrlExp').value = base.urlExpirado || '';
    $('#fZerar').checked = false;
    $('#linhaZerar').hidden = novo;
    $('#btnExcluir').hidden = novo;
    $$('.campo input').forEach((i) => i.classList.remove('erro'));

    const h = $('#fHistorico');
    h.hidden = novo || !(base.historico || []).length;
    $('ol', h).innerHTML = (base.historico || []).map((x) => `<li><time>${fmtData(x.em)}</time><span title="${esc(x.url)}">${esc(x.url)}</span></li>`).join('');

    setTipo(ed.tipo);
    trocarAba('link');
    sincronizarEstiloUI();
    renderPadroes();
    renderLeituras(novo ? null : base.code);
    $('#editor').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => (novo ? $('#fUrl') : $('#fUrl')).focus(), 50);
  }

  function fecharModais() {
    $('#editor').hidden = true;
    $('#config').hidden = true;
    document.body.style.overflow = '';
    ed = null;
  }

  const ultimoEstilo = () => {
    const ult = estado.qrs.slice().sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)))[0];
    return ult ? ult.estilo : {};
  };
  function gerarCodigoUnico() {
    let c;
    do { c = codigoAleatorio(); } while (estado.qrs.some((q) => q.code === c));
    return c;
  }

  function trocarAba(nome) {
    $$('#abas button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === nome));
    $$('.aba').forEach((s) => { s.hidden = s.dataset.aba !== nome; });
  }

  function setTipo(t) {
    ed.tipo = t;
    $$('#fTipo button').forEach((b) => b.classList.toggle('ativo', b.dataset.v === t));
    $('#blocoTemp').hidden = t !== 'temporario';
    $('#notaPerm').hidden = t === 'temporario';
  }

  // Miniaturas das opções de formato
  const iconeCache = new Map();
  function iconeOpcao(campo, valor) {
    const k = campo + valor;
    if (iconeCache.has(k)) return Promise.resolve(iconeCache.get(k));
    const e = normalizar({ margin: 4, ecl: 'L' });
    const cinza = '#c9c9d1', escuro = '#26262e';
    if (campo === 'shape') Object.assign(e, { shape: valor, dotsType: 'dots', cSqType: 'extra-rounded', cDotType: 'dot', dotsColor: escuro, cSqColor: escuro, cDotColor: escuro });
    if (campo === 'dotsType') Object.assign(e, { dotsType: valor, dotsColor: escuro, cSqColor: cinza, cDotColor: cinza, cSqType: 'square' });
    if (campo === 'cSqType') Object.assign(e, { cSqType: valor, dotsColor: cinza, cSqColor: escuro, cDotColor: cinza, dotsType: 'square' });
    if (campo === 'cDotType') Object.assign(e, { cDotType: valor, dotsColor: cinza, cSqColor: cinza, cDotColor: escuro, dotsType: 'square' });
    if (campo === 'frame') Object.assign(e, { frame: valor, frameText: 'SCAN', dotsColor: escuro, cSqColor: escuro, cDotColor: escuro, frameColor: escuro });
    return montarSVG(e, 'QR', 120).then((r) => { const u = urlDeSVG(r.svg); iconeCache.set(k, u); return u; });
  }

  function renderOpcoes(alvoId, campo) {
    const alvo = $('#' + alvoId);
    if (!alvo.childElementCount) {
      OPCOES[campo].forEach(([valor, rotulo]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'opcao';
        b.dataset.v = valor;
        b.innerHTML = `<span style="width:44px;height:44px;border-radius:8px;background:#fff;display:grid;place-items:center;overflow:hidden"></span>${rotulo}`;
        b.addEventListener('click', () => { ed.estilo[campo] = valor; sincronizarEstiloUI(); });
        alvo.appendChild(b);
        // Amplia a miniatura para o detalhe (ponto ou canto) ficar visível.
        const zoom = campo === 'dotsType' ? 'transform:scale(2.2)' : campo === 'cSqType' || campo === 'cDotType' ? 'transform:scale(2.3);transform-origin:4px 4px' : '';
        iconeOpcao(campo, valor).then((u) => { b.firstElementChild.innerHTML = `<img alt="" src="${u}" style="width:40px;height:40px;object-fit:contain;${zoom}">`; });
      });
    }
    $$('.opcao', alvo).forEach((b) => b.classList.toggle('ativo', b.dataset.v === ed.estilo[campo]));
  }

  function sincronizarEstiloUI() {
    const e = ed.estilo;
    renderOpcoes('oShape', 'shape');
    renderOpcoes('oDots', 'dotsType');
    renderOpcoes('oCSq', 'cSqType');
    renderOpcoes('oCDot', 'cDotType');
    renderOpcoes('oFrame', 'frame');
    $('#cDots').value = e.dotsColor; $('#cDots2').value = e.dotsColor2;
    $('#cCSq').value = e.cSqColor; $('#cCDot').value = e.cDotColor; $('#cBg').value = e.bg;
    $('#cTransp').checked = e.transp;
    $$('#oGrad button').forEach((b) => b.classList.toggle('ativo', b.dataset.v === e.grad));
    $('#lDots2').hidden = e.grad === 'none';
    $('#oEcl').value = e.ecl;
    $('#oMargem').value = e.margin; $('#vMargem').textContent = e.margin;
    $('#oLogoTam').value = e.logoSize; $('#vLogoTam').textContent = Math.round(e.logoSize * 100) + '%';
    $('#oLogoMarg').value = e.logoMargin; $('#vLogoMarg').textContent = e.logoMargin;
    $('#oEsconder').checked = e.hideDots;
    $('#logoMini').hidden = !e.logo; if (e.logo) $('#logoMini').src = e.logo;
    $('#logoVazio').hidden = !!e.logo;
    $('#logoOpcoes').hidden = !e.logo;
    $('#frameOpcoes').hidden = e.frame === 'none';
    $('#fFrameTxt').value = e.frameText;
    $('#cFrame').value = e.frameColor; $('#cFrameTxt').value = e.frameTextColor;
    checarContraste();
    atualizarPrevia();
  }

  function checarContraste() {
    const e = ed.estilo;
    const fundo = e.transp ? '#ffffff' : e.bg;
    const cores = [e.dotsColor, e.cSqColor, e.cDotColor].concat(e.grad !== 'none' ? [e.dotsColor2] : []);
    const pior = Math.min(...cores.map((c) => contraste(c, fundo)));
    const invertido = cores.some((c) => lum(c) > lum(fundo));
    const al = $('#alertaContraste');
    if (invertido) { al.hidden = false; al.textContent = 'Pontos mais claros que o fundo: muitas câmeras não leem QR Code invertido. Use pontos escuros sobre fundo claro.'; }
    else if (pior < 3) { al.hidden = false; al.textContent = `Contraste baixo (${pior.toFixed(1)}:1). O QR Code pode falhar na leitura; o ideal é acima de 4:1.`; }
    else al.hidden = true;
    if (e.transp && !al.hidden) al.textContent += ' (Com fundo transparente, considere a cor de onde ele será impresso.)';
  }

  const atualizarPrevia = debounce(async () => {
    if (!ed) return;
    const token = ++previaToken;
    const code = ($('#fCode').value || '').trim() || 'codigo';
    const link = linkDe(code);
    $('#previaLink').textContent = link.replace(/^https?:\/\//, '');
    try {
      const r = await montarSVG(ed.estilo, link, 600);
      if (token !== previaToken) return;
      const u = urlDeSVG(r.svg);
      $('#previa').innerHTML = `<img alt="Prévia do QR Code" src="${u}" style="max-width:100%;max-height:100%;display:block">`;
      if (previaUrl) URL.revokeObjectURL(previaUrl);
      previaUrl = u;
    } catch (err) { console.error(err); }
  }, 120);

  function renderPadroes() {
    const fixos = $('#padroesFixos');
    if (!fixos.childElementCount) PADROES.forEach((p) => fixos.appendChild(cartaoPadrao(p, false)));
    const meus = $('#padroesMeus');
    meus.innerHTML = '';
    if (!estado.padroes.length) meus.innerHTML = '<p class="sem">Monte um estilo (com sua logo, cores e moldura) e salve aqui para reutilizar em outros QR Codes.</p>';
    estado.padroes.forEach((p) => meus.appendChild(cartaoPadrao(p, true)));
  }

  function cartaoPadrao(p, meu) {
    const b = document.createElement('div');
    b.className = 'padrao';
    b.tabIndex = 0;
    b.innerHTML = `<div class="mini"></div><span>${esc(p.nome)}</span>` + (meu ? '<button class="apagar" title="Excluir padrão" aria-label="Excluir padrão">✕</button>' : '');
    const aplicar = () => {
      const atual = ed.estilo;
      const novo = normalizar(p.estilo);
      if (!meu) {
        // Padrão pronto troca o visual, mas mantém a logo e a moldura que você já escolheu.
        ['logo', 'logoSize', 'logoMargin', 'hideDots'].forEach((k) => { novo[k] = atual[k]; });
        if (!p.estilo.frame) ['frame', 'frameText', 'frameColor', 'frameTextColor'].forEach((k) => { novo[k] = atual[k]; });
        if (atual.logo) novo.ecl = 'H';
      }
      ed.estilo = novo;
      sincronizarEstiloUI();
      toast(`Padrão “${p.nome}” aplicado`);
    };
    b.addEventListener('click', (ev) => {
      if (ev.target.closest('.apagar')) {
        ev.stopPropagation();
        if (!confirm(`Excluir o padrão “${p.nome}”?`)) return;
        Store.excluirPadrao(p.id).then(() => { estado.padroes = estado.padroes.filter((x) => x.id !== p.id); renderPadroes(); }).catch((e) => toast(e.message, true));
        return;
      }
      aplicar();
    });
    b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') aplicar(); });
    const estiloMini = normalizar(p.estilo);
    montarSVG(estiloMini, 'https://qr.studio/padrao', 160).then((r) => {
      $('.mini', b).innerHTML = `<img alt="" src="${urlDeSVG(r.svg)}" style="width:100%;height:100%;object-fit:contain">`;
    });
    return b;
  }

  async function renderLeituras(code) {
    const bl = $('#leiturasBloco');
    bl.hidden = true;
    if (!code || MODO === 'local') return;
    try {
      const dias = await Store.leituras(code);
      if (!ed || ed.qr.code !== code) return;
      const max = Math.max(1, ...dias.map((d) => d.leituras));
      const soma = dias.reduce((a, d) => a + d.leituras, 0);
      $('#leiturasTotal').textContent = soma.toLocaleString('pt-BR');
      $('#barras').innerHTML = dias.map((d) => `<i class="${d.leituras ? '' : 'zero'}" style="height:${Math.max(4, d.leituras / max * 100)}%" title="${d.dia.split('-').reverse().join('/')}: ${d.leituras}"></i>`).join('');
      bl.hidden = false;
    } catch (e) { /* estatística é opcional */ }
  }

  function normalizarUrl(u) {
    u = (u || '').trim();
    if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    return u;
  }

  async function salvarEditor() {
    const erro = (id, msg, aba) => { trocarAba(aba); const el = $('#' + id); el.classList.add('erro'); el.focus(); toast(msg, true); };
    $$('.campo input').forEach((i) => i.classList.remove('erro'));

    const url = normalizarUrl($('#fUrl').value);
    const code = ($('#fCode').value || '').trim().toLowerCase();
    if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url) && !/^https?:\/\/localhost/i.test(url)) return erro('fUrl', 'Informe um link válido (ex.: https://seusite.com.br)', 'link');
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(code)) return erro('fCode', 'Código curto: 2 a 40 caracteres, só letras minúsculas, números e hífen', 'link');
    if (ed.novo && estado.qrs.some((q) => q.code === code)) return erro('fCode', 'Esse código já está em uso', 'link');

    let expiraEm = '', maxLeituras = 0, urlExpirado = '';
    if (ed.tipo === 'temporario') {
      const v = $('#fExpira').value;
      expiraEm = v ? new Date(v).toISOString() : '';
      maxLeituras = Math.max(0, parseInt($('#fMax').value, 10) || 0);
      urlExpirado = normalizarUrl($('#fUrlExp').value);
      if (!expiraEm && !maxLeituras) return erro('fExpira', 'Para um QR Code temporário, defina uma data de expiração ou um limite de leituras', 'validade');
      if (urlExpirado && !/^https?:\/\/\S+$/i.test(urlExpirado)) return erro('fUrlExp', 'Link após expirar inválido', 'validade');
    }

    const qr = {
      novo: ed.novo, code, url, nome: $('#fNome').value.trim(), ativo: $('#fAtivo').checked,
      expiraEm, maxLeituras, urlExpirado, estilo: ed.estilo, zerarLeituras: !ed.novo && $('#fZerar').checked,
    };
    const btn = $('#btnSalvar');
    btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const reg = await Store.salvar(qr);
      reg.estilo = normalizar(reg.estilo);
      const i = estado.qrs.findIndex((q) => q.code === reg.code);
      if (i >= 0) estado.qrs[i] = reg; else estado.qrs.push(reg);
      const eraNovo = ed.novo;
      fecharModais();
      renderLista();
      toast(eraNovo ? 'QR Code criado' : 'Alterações salvas — o QR Code impresso já aponta para o novo link');
    } catch (e) {
      toast(e.message === 'Failed to fetch' ? 'Sem conexão com o servidor' : e.message, true);
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar';
    }
  }

  // ================= Configurações =================
  function abrirConfig() {
    $('#config').hidden = false;
    document.body.style.overflow = 'hidden';
    const st = $('#cfgStatus');
    if (MODO === 'local') {
      st.innerHTML = '<b>Modo demonstração.</b> Os QR Codes ficam só neste navegador e o link curto ainda não redireciona. Para colocar no ar, cole a URL do Apps Script em <code>config.js</code> (veja o LEIAME).';
      $('#cfgChave').closest('.campo').hidden = true;
      $('#cfgSalvar').hidden = true; $('#cfgSair').hidden = true;
    } else {
      st.textContent = lsGet(K_CHAVE) ? 'Conectado ao servidor. Troque a chave se ela mudou no Apps Script.' : 'Digite sua chave de acesso. No primeiro acesso, a chave que você digitar aqui (mín. 8 caracteres) passa a ser a oficial.';
      $('#cfgChave').value = lsGet(K_CHAVE) || '';
      setTimeout(() => $('#cfgChave').focus(), 50);
    }
  }

  async function conectar() {
    const chave = $('#cfgChave').value.trim();
    if (!chave) return toast('Digite a chave', true);
    const antiga = lsGet(K_CHAVE);
    lsSet(K_CHAVE, chave);
    const b = $('#cfgSalvar');
    b.disabled = true; b.textContent = 'Conectando…';
    try {
      const r = await api('ping');
      fecharModais();
      toast(r.chaveCriada ? 'Chave criada — guarde-a: é ela que abre o painel em outros aparelhos' : 'Conectado');
      carregar();
    } catch (e) {
      lsSet(K_CHAVE, antiga);
      toast(e.message === 'Failed to fetch' ? 'Não achei o servidor. Confira API_URL em config.js e se a implantação é “Qualquer pessoa”.' : e.message, true);
    } finally { b.disabled = false; b.textContent = 'Conectar'; }
  }

  function exportar() {
    const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), qrs: estado.qrs, padroes: estado.padroes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qr-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importar(arquivo) {
    try {
      const d = JSON.parse(await arquivo.text());
      let n = 0;
      for (const q of d.qrs || []) {
        const existe = estado.qrs.some((x) => x.code === q.code);
        await Store.salvar(Object.assign({}, q, { novo: !existe }));
        n++;
      }
      for (const p of d.padroes || []) {
        if (!estado.padroes.some((x) => x.id === p.id)) await Store.salvarPadrao({ nome: p.nome, estilo: p.estilo });
      }
      toast(`${n} QR Codes importados`);
      fecharModais();
      carregar();
    } catch (e) { toast('Não consegui importar: ' + e.message, true); }
  }

  // ================= Eventos =================
  function ligar() {
    $('#btnNovo').addEventListener('click', () => abrirEditor(null));
    $('#btnNovoVazio').addEventListener('click', () => abrirEditor(null));
    $('#btnConfig').addEventListener('click', abrirConfig);
    $('#modoTag').addEventListener('click', abrirConfig);
    $$('[data-fechar]').forEach((b) => b.addEventListener('click', fecharModais));
    $$('.painel-fundo').forEach((f) => f.addEventListener('mousedown', (ev) => { if (ev.target === f) fecharModais(); }));
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && (!$('#editor').hidden || !$('#config').hidden)) fecharModais(); });

    $('#filtros').addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      estado.filtro = b.dataset.f;
      $$('#filtros button').forEach((x) => x.classList.toggle('ativo', x === b));
      renderLista();
    });
    $('#busca').addEventListener('input', debounce((ev) => { estado.busca = ev.target.value; renderLista(); }, 150));

    $('#abas').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) trocarAba(b.dataset.aba); });
    $('#fTipo').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) setTipo(b.dataset.v); });
    $('#atalhosExp').addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      const h = +b.dataset.h;
      $('#fExpira').value = h ? paraLocalInput(new Date(Date.now() + h * 3600e3).toISOString()) : '';
    });
    $('#fCode').addEventListener('input', (ev) => { ev.target.value = ev.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); atualizarPrevia(); });
    $('#btnSalvar').addEventListener('click', salvarEditor);
    $('#editor').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) salvarEditor(); });
    $('#btnExcluir').addEventListener('click', async () => {
      const q = ed.qr;
      if (!confirm(`Excluir “${q.nome || q.code}”? Quem escanear o QR Code impresso verá “não encontrado”.`)) return;
      try {
        await Store.excluir(q.code);
        estado.qrs = estado.qrs.filter((x) => x.code !== q.code);
        fecharModais(); renderLista(); toast('QR Code excluído');
      } catch (e) { toast(e.message, true); }
    });

    const cor = (id, campo) => $('#' + id).addEventListener('input', (ev) => { ed.estilo[campo] = ev.target.value; checarContraste(); atualizarPrevia(); });
    cor('cDots', 'dotsColor'); cor('cDots2', 'dotsColor2'); cor('cCSq', 'cSqColor'); cor('cCDot', 'cDotColor'); cor('cBg', 'bg');
    cor('cFrame', 'frameColor'); cor('cFrameTxt', 'frameTextColor');
    $('#cTransp').addEventListener('change', (ev) => { ed.estilo.transp = ev.target.checked; checarContraste(); atualizarPrevia(); });
    $('#oGrad').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { ed.estilo.grad = b.dataset.v; sincronizarEstiloUI(); } });
    $('#oEcl').addEventListener('change', (ev) => { ed.estilo.ecl = ev.target.value; atualizarPrevia(); });
    const faixa = (id, campo, saida, fmt) => $('#' + id).addEventListener('input', (ev) => { ed.estilo[campo] = +ev.target.value; $('#' + saida).textContent = fmt ? fmt(+ev.target.value) : ev.target.value; atualizarPrevia(); });
    faixa('oMargem', 'margin', 'vMargem');
    faixa('oLogoTam', 'logoSize', 'vLogoTam', (v) => Math.round(v * 100) + '%');
    faixa('oLogoMarg', 'logoMargin', 'vLogoMarg');
    $('#oEsconder').addEventListener('change', (ev) => { ed.estilo.hideDots = ev.target.checked; atualizarPrevia(); });
    $('#fFrameTxt').addEventListener('input', (ev) => { ed.estilo.frameText = ev.target.value.toUpperCase(); atualizarPrevia(); });

    // Logo
    const zona = $('#soltarLogo');
    zona.addEventListener('click', () => $('#fLogo').click());
    zona.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); $('#fLogo').click(); } });
    zona.addEventListener('dragover', (ev) => { ev.preventDefault(); zona.classList.add('sobre'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('sobre'));
    zona.addEventListener('drop', (ev) => { ev.preventDefault(); zona.classList.remove('sobre'); if (ev.dataTransfer.files[0]) usarLogo(ev.dataTransfer.files[0]); });
    $('#fLogo').addEventListener('change', (ev) => { if (ev.target.files[0]) usarLogo(ev.target.files[0]); ev.target.value = ''; });
    $('#btnTirarLogo').addEventListener('click', () => { ed.estilo.logo = ''; $('#paletaLogo').innerHTML = ''; sincronizarEstiloUI(); });
    $('#btnCombinar').addEventListener('click', combinarComLogo);

    // Padrões
    $('#btnSalvarPadrao').addEventListener('click', async () => {
      const nome = $('#nomePadrao').value.trim();
      if (!nome) { $('#nomePadrao').focus(); return toast('Dê um nome ao padrão', true); }
      try {
        const p = await Store.salvarPadrao({ nome, estilo: ed.estilo });
        estado.padroes.push(p);
        $('#nomePadrao').value = '';
        renderPadroes();
        toast('Padrão salvo');
      } catch (e) { toast(e.message, true); }
    });

    // Downloads
    $$('[data-dl]').forEach((b) => b.addEventListener('click', () => {
      const code = ($('#fCode').value || '').trim() || 'qr';
      baixar(ed.estilo, linkDe(code), b.dataset.dl, +$('#dlTam').value, `qr-${code}`).catch((e) => toast(e.message, true));
    }));

    // Configurações
    $('#cfgSalvar').addEventListener('click', conectar);
    $('#cfgChave').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') conectar(); });
    $('#cfgSair').addEventListener('click', () => { lsSet(K_CHAVE, null); $('#cfgChave').value = ''; estado.qrs = []; renderLista(); toast('Chave esquecida neste navegador'); });
    $('#cfgExportar').addEventListener('click', exportar);
    $('#cfgImportar').addEventListener('click', () => $('#cfgArquivo').click());
    $('#cfgArquivo').addEventListener('change', (ev) => { if (ev.target.files[0]) importar(ev.target.files[0]); ev.target.value = ''; });
  }

  async function usarLogo(arquivo) {
    if (!/^image\//.test(arquivo.type)) return toast('Envie um arquivo de imagem', true);
    try {
      ed.estilo.logo = await prepararLogo(arquivo);
      if (ed.estilo.ecl !== 'H') ed.estilo.ecl = 'H';
      sincronizarEstiloUI();
      await combinarComLogo(true);
    } catch (e) { toast('Não consegui ler essa imagem', true); }
  }

  async function combinarComLogo(soPaleta) {
    const a = await analisarLogo(ed.estilo.logo);
    if (!a) return toast('Não consegui identificar a logo na imagem', true);
    const pal = $('#paletaLogo');
    pal.innerHTML = a.paleta.map((c) => `<button type="button" style="background:${c}" data-c="${c}" title="Usar ${c} nos pontos"></button>`).join('');
    $$('button', pal).forEach((b) => b.addEventListener('click', () => {
      const fundo = ed.estilo.transp ? '#ffffff' : ed.estilo.bg;
      ed.estilo.dotsColor = garantirContraste(b.dataset.c, fundo, 4);
      sincronizarEstiloUI();
    }));
    if (soPaleta === true) {
      $('#notaCombinar').textContent = NOMES_FORMA[a.forma] + ' Clique no botão para aplicar.';
      return;
    }
    ed.estilo = estiloCombinando(ed.estilo, a);
    $('#notaCombinar').textContent = NOMES_FORMA[a.forma] + ' Cores tiradas da logo (escurecidas se preciso para garantir a leitura).';
    sincronizarEstiloUI();
    toast('QR Code combinado com a logo');
  }

  // ================= Início =================
  ligar();
  if (MODO === 'local') $('#modoTag').hidden = false;
  if (MODO === 'servidor' && !lsGet(K_CHAVE)) { renderLista(); abrirConfig(); } else carregar();
})();
