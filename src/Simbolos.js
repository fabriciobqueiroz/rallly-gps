// Banco de imagens (marcos) desenhado por nós: cada símbolo cabe numa caixa local de -20 a 20.
// Formato das peças: l = linha, g = polígono, c = círculo, t = texto (mesmo de Desenho.js).
const onda = (x0, x1, y, amp, n) => { const o = []; for (let i = 0; i <= n; i++) o.push(Math.round((x0 + ((x1 - x0) * i) / n) * 10) / 10, Math.round((y + (i % 2 ? amp : -amp)) * 10) / 10); return o; };
const L = (p, w = 2.5, extra) => ({ t: 'l', p, w, ...(extra || {}) });
const G = (p, w = 2.5, f = '#fff') => ({ t: 'g', p, w, f });
const C = (x, y, r, w = 2.5, f = 'none') => ({ t: 'c', x, y, r, w, f });
const T = (x, y, s, tx) => ({ t: 't', x, y, s, tx });
const placa = (conteudo, circ) => [L([0, 8, 0, 19], 3), circ ? C(0, -3, 12, 2.5, '#fff') : G([-12, -15, 12, -15, 12, 9, -12, 9], 2.5), ...conteudo];

export const EXTRA = {
  // ---- placas ----
  vel40: { cat: 'placa', nome: 'Limite 40', p: placa([T(0, 1.5, 10, '40')], true) },
  vel60: { cat: 'placa', nome: 'Limite 60', p: placa([T(0, 1.5, 10, '60')], true) },
  vel80: { cat: 'placa', nome: 'Limite 80', p: placa([T(0, 1.5, 10, '80')], true) },
  estac: { cat: 'placa', nome: 'Estacionamento', p: placa([T(0, -4, 14, 'P')]) },
  radar: { cat: 'placa', nome: 'Radar', p: placa([T(0, -3, 7, 'RADAR')]) },
  ceda: { cat: 'placa', nome: 'Dê a preferência', p: [L([0, 6, 0, 19], 3), G([-13, -14, 13, -14, 0, 8], 2.5)] },
  setaplaca: { cat: 'placa', nome: 'Placa de seta', p: placa([L([-8, -3, 7, -3], 2.5, { ar: true })]) },
  norte: { cat: 'placa', nome: 'Norte', p: [C(0, 0, 13, 2.5, '#fff'), T(0, 5, 14, 'N')] },
  // ---- casas e construções ----
  casa: { cat: 'casa', nome: 'Casa', p: [G([-11, -2, 11, -2, 11, 14, -11, 14], 2.5), G([-14, -2, 0, -14, 14, -2], 2.5), L([0, 14, 0, 6], 2)] },
  escola: { cat: 'casa', nome: 'Escola', p: [G([-12, -8, 12, -8, 12, 14, -12, 14], 2.5), T(0, 7, 14, 'E')] },
  galpao: { cat: 'casa', nome: 'Galpão', p: [G([-14, 14, -14, -2, 0, -10, 14, -2, 14, 14], 2.5), L([-6, 14, -6, 4, 6, 4, 6, 14], 2)] },
  hospital: { cat: 'casa', nome: 'Hospital', p: [C(0, 0, 14, 2.5, '#fff'), T(0, 6, 17, 'H')] },
  estadio: { cat: 'casa', nome: 'Estádio', p: [G([-16, -10, 16, -10, 16, 10, -16, 10], 2.5), L([0, -10, 0, 10], 1.5), C(0, 0, 4, 1.5)] },
  posto: { cat: 'casa', nome: 'Posto', p: [G([-12, -10, 12, -10, 12, 10, -12, 10], 2.5), T(0, 5, 14, 'P')] },
  capela: { cat: 'casa', nome: 'Capela', p: [G([-8, -2, 8, -2, 8, 14, -8, 14], 2.5), G([-10, -2, 0, -12, 10, -2], 2.5), L([0, -12, 0, -19], 2), L([-4, -16, 4, -16], 2)] },
  // ---- árvores ----
  palmeira: { cat: 'arvore', nome: 'Palmeira', p: [L([0, 18, 0, -2], 3), L([0, -2, -12, -8], 2.5), L([0, -2, 12, -8], 2.5), L([0, -2, -8, -14], 2.5), L([0, -2, 8, -14], 2.5), L([0, -2, 0, -16], 2.5)] },
  cacto: { cat: 'arvore', nome: 'Cacto', p: [L([0, 18, 0, -14], 4), L([0, 4, -10, 4, -10, -6], 3), L([0, 0, 10, 0, 10, -10], 3)] },
  arbusto: { cat: 'arvore', nome: 'Arbusto', p: [C(-8, 4, 8, 2.5, '#fff'), C(8, 4, 8, 2.5, '#fff'), C(0, -5, 8, 2.5, '#fff')] },
  mata: { cat: 'arvore', nome: 'Mata', p: [C(-9, -6, 7, 2, '#fff'), C(8, -8, 7, 2, '#fff'), C(-2, 6, 7, 2, '#fff'), C(12, 8, 6, 2, '#fff')] },
  // ---- postes e torres ----
  torre: { cat: 'poste', nome: 'Torre de energia', p: [L([-10, 18, 0, -16, 10, 18], 2.5), L([-6, 6, 6, 6], 2), L([-3, -6, 3, -6], 2), L([-12, -10, 12, -10], 2.5)] },
  poste2: { cat: 'poste', nome: 'Poste duplo', p: [L([0, -18, 0, 18], 3), L([-10, -14, 10, -14], 3), L([-10, -8, 10, -8], 2)] },
  antena: { cat: 'poste', nome: 'Antena', p: [L([0, 18, 0, -12], 3), L([-8, -4, 0, -12, 8, -4], 2.5), C(0, -15, 3, 2, '#000')] },
  eolica: { cat: 'poste', nome: 'Eólica', p: [L([0, 18, 0, 0], 3), L([0, 0, 0, -16], 2.5), L([0, 0, -13, 7], 2.5), L([0, 0, 13, 7], 2.5)] },
  // ---- cercas e linhas ----
  cerca: { cat: 'cerca', nome: 'Cerca', p: [L([-18, -4, 18, -4], 2), L([-18, 4, 18, 4], 2), L([-12, -9, -12, 9], 2.5), L([0, -9, 0, 9], 2.5), L([12, -9, 12, 9], 2.5)] },
  arame: { cat: 'cerca', nome: 'Arame', p: [L([-18, 0, 18, 0], 1.5), L([-14, -5, -10, 5], 1.5), L([-2, -5, 2, 5], 1.5), L([10, -5, 14, 5], 1.5)] },
  paralelas: { cat: 'cerca', nome: 'Linhas paralelas', p: [L([-18, -8, 18, -8], 2), L([-18, 0, 18, 0], 2), L([-18, 8, 18, 8], 2)] },
  mataburro: { cat: 'cerca', nome: 'Mata-burro', p: [G([-14, -10, 14, -10, 14, 10, -14, 10], 2.5), L([-8, -10, -8, 10], 2), L([-2, -10, -2, 10], 2), L([4, -10, 4, 10], 2), L([10, -10, 10, 10], 2)] },
  trilho: { cat: 'cerca', nome: 'Trilho de trem', p: [L([-6, -18, -6, 18], 2.5), L([6, -18, 6, 18], 2.5), L([-10, -12, 10, -12], 2), L([-10, -4, 10, -4], 2), L([-10, 4, 10, 4], 2), L([-10, 12, 10, 12], 2)] },
  faixa: { cat: 'cerca', nome: 'Faixa de pedestre', p: [L([-14, -12, 14, -12], 3), L([-14, -6, 14, -6], 3), L([-14, 0, 14, 0], 3), L([-14, 6, 14, 6], 3), L([-14, 12, 14, 12], 3)] },
  // ---- água e relevo ----
  rio: { cat: 'agua', nome: 'Rio', p: [L(onda(-18, 18, -7, 3, 8), 2), L(onda(-18, 18, 0, 3, 8), 2), L(onda(-18, 18, 7, 3, 8), 2)] },
  lago: { cat: 'agua', nome: 'Lago', p: [G([-16, 2, -10, -8, 2, -12, 14, -6, 16, 6, 6, 12, -8, 10], 2.5)] },
  valeta: { cat: 'agua', nome: 'Valeta', p: [L([-16, -8, -12, 4, -6, 10, 6, 10, 12, 4, 16, -8], 3)] },
  buraco: { cat: 'agua', nome: 'Buraco', p: [C(0, 0, 11, 3, '#ddd'), C(0, 0, 5, 2, '#999')] },
  pedras: { cat: 'agua', nome: 'Pedras', p: [C(-8, 6, 5, 2, '#eee'), C(6, 8, 6, 2, '#eee'), C(0, -6, 5, 2, '#eee'), C(12, -4, 4, 2, '#eee')] },
};

export const CATEGORIAS = [
  ['placa', '▭', 'Placas'], ['casa', '⌂', 'Casas'], ['arvore', '♣', 'Árvores'], ['poste', '⊤', 'Postes e torres'],
  ['cerca', '≡', 'Cercas e linhas'], ['agua', '≈', 'Água e relevo'], ['via', '⟳', 'Vias e obstáculos'],
];
