// Modelo e desenho de tulipas montadas à mão: peças (cruzamentos, marcos), caneta e texto num quadro de 100 x 100.
// Cada item vira "primitivas" (linhas, polígonos, círculos, textos) que servem para a tela e para o PDF.
import { EXTRA } from './Simbolos';
import Svg, { Circle, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

const rad = (d) => (d * Math.PI) / 180;
const r1 = (n) => Math.round(n * 10) / 10;

// ---- Cruzamentos: ruas em graus (0 = em frente, 90 = direita, 270 = esquerda); você chega por baixo ----
export const CRUZAMENTOS = [
  [[90, 270], 90], [[90, 270], 270], [[45, 315], 45], [[45, 315], 315],
  [[0, 90], 0], [[0, 270], 0], [[0, 90], 90], [[0, 270], 270],
  [[0, 90, 270], 0], [[0, 90, 270], 90], [[0, 90, 270], 270], [[0, 45], 45],
  [[0, 315], 315], [[45], 45], [[315], 315], [[90], 90], [[270], 270],
].map(([arms, out]) => ({ arms, out }));

// Peças em caixa local de -20 a 20. l = linha, g = polígono, c = círculo, t = texto.
export const SIMBOLOS = {
  arvore: { nome: 'Árvore', p: [{ t: 'c', x: 0, y: -6, r: 11, f: '#fff', w: 2.5 }, { t: 'l', p: [0, 5, 0, 17], w: 4 }] },
  predio: { nome: 'Prédio', p: [{ t: 'g', p: [-11, -16, 11, -16, 11, 16, -11, 16], f: '#fff', w: 2.5 }, { t: 'l', p: [-6, -8, 6, -8], w: 2 }, { t: 'l', p: [-6, 0, 6, 0], w: 2 }, { t: 'l', p: [0, 8, 0, 16], w: 3 }] },
  placa: { nome: 'Placa', p: [{ t: 'l', p: [0, -2, 0, 18], w: 3 }, { t: 'g', p: [-13, -18, 13, -18, 13, -2, -13, -2], f: '#fff', w: 2.5 }] },
  semaforo: { nome: 'Semáforo', p: [{ t: 'g', p: [-6, -17, 6, -17, 6, 17, -6, 17], f: '#fff', w: 2.5 }, { t: 'c', x: 0, y: -9, r: 3, f: '#000', w: 1 }, { t: 'c', x: 0, y: 0, r: 3, f: '#000', w: 1 }, { t: 'c', x: 0, y: 9, r: 3, f: '#000', w: 1 }] },
  igreja: { nome: 'Igreja', p: [{ t: 'g', p: [-10, -4, 10, -4, 10, 16, -10, 16], f: '#fff', w: 2.5 }, { t: 'g', p: [-12, -4, 0, -14, 12, -4], f: '#fff', w: 2.5 }, { t: 'l', p: [0, -14, 0, -22], w: 2.5 }, { t: 'l', p: [-4, -18, 4, -18], w: 2.5 }] },
  ponte: { nome: 'Ponte', p: [{ t: 'l', p: [-18, 8, -10, -2, 10, -2, 18, 8], w: 3 }, { t: 'l', p: [-18, 14, 18, 14], w: 3 }] },
  muro: { nome: 'Muro', p: [{ t: 'l', p: [-18, 0, 18, 0], w: 5 }, { t: 'l', p: [-12, -6, -12, 6], w: 2 }, { t: 'l', p: [0, -6, 0, 6], w: 2 }, { t: 'l', p: [12, -6, 12, 6], w: 2 }] },
  pare: { nome: 'Pare', p: [{ t: 'g', p: [-5, -12, 5, -12, 12, -5, 12, 5, 5, 12, -5, 12, -12, 5, -12, -5], f: '#fff', w: 2.5 }, { t: 't', x: 0, y: 4, s: 11, tx: 'PARE' }] },
  rotatoria: { nome: 'Rotatória', p: [{ t: 'c', x: 0, y: 0, r: 14, f: 'none', w: 4 }, { t: 'c', x: 0, y: 0, r: 3, f: '#000', w: 1 }] },
  lombada: { nome: 'Lombada', p: [{ t: 'l', p: [-18, 8, -8, 8, -4, 0, 4, 0, 8, 8, 18, 8], w: 3 }] },
  porteira: { nome: 'Porteira', p: [{ t: 'l', p: [-16, -14, -16, 14], w: 4 }, { t: 'l', p: [16, -14, 16, 14], w: 4 }, { t: 'l', p: [-16, -6, 16, -6], w: 2.5 }, { t: 'l', p: [-16, 4, 16, 4], w: 2.5 }, { t: 'l', p: [-16, 4, 16, -6], w: 2 }] },
  entrada: { nome: 'Entrada', p: [{ t: 'l', p: [-18, 8, -4, 8, 6, -6], w: 2.5, ar: true }, { t: 'l', p: [-18, 14, -4, 14], w: 1.5 }] },
  poste: { nome: 'Poste', p: [{ t: 'l', p: [0, -18, 0, 18], w: 3 }, { t: 'l', p: [0, -18, 10, -18], w: 3 }, { t: 'c', x: 12, y: -16, r: 3, f: '#000', w: 1 }] },
};

// Categoria dos marcos antigos e junção com o banco novo (Simbolos.js).
const CAT_ANT = { arvore: 'arvore', predio: 'casa', placa: 'placa', semaforo: 'via', igreja: 'casa', ponte: 'agua', muro: 'cerca', pare: 'placa', rotatoria: 'via', lombada: 'via', porteira: 'cerca', entrada: 'via', poste: 'poste' };
Object.keys(CAT_ANT).forEach((k) => { SIMBOLOS[k].cat = CAT_ANT[k]; });
Object.assign(SIMBOLOS, EXTRA);

// Ruas -> linhas locais (caixa de -50 a 50): rua de chegada embaixo, ruas laterais e seta na saída.
function localCruzamento(arms, out) {
  const P = [{ t: 'l', p: [0, 40, 0, 0], w: 6 }, { t: 'c', x: 0, y: 44, r: 5, f: '#000', w: 1 }];
  (arms || []).forEach((a) => {
    const x = Math.sin(rad(a)), y = -Math.cos(rad(a));
    const isOut = a === out, len = isOut ? 42 : 36;
    P.push({ t: 'l', p: [0, 0, r1(x * len), r1(y * len)], w: isOut ? 6 : 2, ar: isOut });
  });
  return P;
}

// Transformação local -> quadro (escala, giro em graus, posição).
const tf = (it) => {
  const c = Math.cos(rad(it.r || 0)), s = Math.sin(rad(it.r || 0)), k = it.s || 1;
  return (x, y) => [r1(it.x + k * (x * c - y * s)), r1(it.y + k * (x * s + y * c))];
};
const seta = (p, w, k) => {
  const n = p.length;
  const [x1, y1, x2, y2] = [p[n - 4], p[n - 3], p[n - 2], p[n - 1]];
  const a = Math.atan2(y2 - y1, x2 - x1), L = 12 * k, W = 7 * k;
  const bx = x2 - Math.cos(a) * L, by = y2 - Math.sin(a) * L;
  return [x2 + Math.cos(a) * 3, y2 + Math.sin(a) * 3, bx - Math.sin(a) * W, by + Math.cos(a) * W, bx + Math.sin(a) * W, by - Math.cos(a) * W].map(r1);
};

// Expande um item em primitivas no quadro 100 x 100.
export function expandir(it) {
  if (it.k === 'pen') {
    const w = it.w || 2.5, o = [{ t: 'l', p: it.p, w, d: it.d || '' }];
    const n = it.p.length;
    if (n >= 4 && (it.ar === 'f' || it.ar === 'b')) o.push({ t: 'g', p: seta(it.p, w, Math.max(0.8, w / 3)), f: '#000', w: 0 });
    if (n >= 4 && (it.ar === 'i' || it.ar === 'b')) o.push({ t: 'g', p: seta([it.p[2], it.p[3], it.p[0], it.p[1]], w, Math.max(0.8, w / 3)), f: '#000', w: 0 });
    return o;
  }
  if (it.k === 'txt') return [{ t: 't', x: it.x, y: it.y, s: 12 * (it.s || 1), tx: it.tx }];
  const T = tf(it);
  const loc = it.k === 'tpl' ? localCruzamento(it.arms, it.out) : (SIMBOLOS[it.n] || { p: [] }).p;
  const k = it.s || 1;
  const pts = (p) => { const o = []; for (let i = 0; i + 1 < p.length; i += 2) o.push(...T(p[i], p[i + 1])); return o; };
  const out = [];
  loc.forEach((q) => {
    if (q.t === 'l') {
      const p = pts(q.p);
      out.push({ t: 'l', p, w: r1(q.w * k) });
      if (q.ar) out.push({ t: 'g', p: seta(p, q.w, k * 1.1), f: '#000', w: 0 });
    } else if (q.t === 'g') out.push({ t: 'g', p: pts(q.p), f: q.f || '#fff', w: r1((q.w || 2) * k) });
    else if (q.t === 'c') { const [x, y] = T(q.x, q.y); out.push({ t: 'c', x, y, r: r1(q.r * k), f: q.f || 'none', w: r1((q.w || 2) * k) }); }
    else if (q.t === 't') { const [x, y] = T(q.x, q.y); out.push({ t: 't', x, y, s: r1(q.s * k), tx: q.tx }); }
  });
  return out;
}

const dash = (q) => { const w = Math.max(1, q.w || 2); return q.d === 'd' ? `${w * 3},${w * 2}` : q.d === 'p' ? `${w * 0.1},${w * 2}` : q.d === 'dp' ? `${w * 4},${w * 1.5},${w * 0.1},${w * 1.5}` : q.d === 'l' ? `${w * 6},${w * 3}` : undefined; };
const pairs = (p) => { const o = []; for (let i = 0; i + 1 < p.length; i += 2) o.push(`${p[i]},${p[i + 1]}`); return o.join(' '); };

// Desenho na tela (react-native-svg). Fundo branco, borda cinza como as tulipas automáticas.
export function DesenhoSvg({ items, size = 96, fundo = true, children }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {fundo && <Rect width="100" height="100" fill="#fff" stroke="#999" />}
      {children}
      {(items || []).flatMap((it, i) => expandir(it).map((q, j) => {
        const key = `${i}_${j}`;
        if (q.t === 'l') return <Polyline key={key} points={pairs(q.p)} fill="none" stroke="#000" strokeWidth={q.w} strokeLinecap={q.d ? 'butt' : 'round'} strokeLinejoin="round" strokeDasharray={dash(q)} />;
        if (q.t === 'g') return <Polygon key={key} points={pairs(q.p)} fill={q.f} stroke="#000" strokeWidth={q.w} strokeLinejoin="round" />;
        if (q.t === 'c') return <Circle key={key} cx={q.x} cy={q.y} r={q.r} fill={q.f} stroke="#000" strokeWidth={q.w} />;
        return <SvgText key={key} x={q.x} y={q.y} fontSize={q.s} fontWeight="bold" textAnchor="middle" fill="#000">{q.tx}</SvgText>;
      }))}
    </Svg>
  );
}

// Mesmo desenho como texto SVG (para o PDF).
export function desenhoSvgStr(items, size = 90) {
  const body = (items || []).flatMap((it) => expandir(it).map((q) => {
    if (q.t === 'l') return `<polyline points="${pairs(q.p)}" fill="none" stroke="#000" stroke-width="${q.w}" stroke-linecap="round" stroke-linejoin="round"${dash(q) ? ` stroke-dasharray="${dash(q)}"` : ''}/>`;
    if (q.t === 'g') return `<polygon points="${pairs(q.p)}" fill="${q.f}" stroke="#000" stroke-width="${q.w}"/>`;
    if (q.t === 'c') return `<circle cx="${q.x}" cy="${q.y}" r="${q.r}" fill="${q.f}" stroke="#000" stroke-width="${q.w}"/>`;
    return `<text x="${q.x}" y="${q.y}" font-size="${q.s}" font-weight="bold" text-anchor="middle">${String(q.tx).replace(/</g, '&lt;')}</text>`;
  })).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff" stroke="#999"/>${body}</svg>`;
}

// Centro aproximado de um item (para selecionar com o toque).
export function centro(it) {
  if (it.k === 'pen') {
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i + 1 < it.p.length; i += 2) { sx += it.p[i]; sy += it.p[i + 1]; n++; }
    return n ? [sx / n, sy / n] : [50, 50];
  }
  return [it.x, it.y];
}
export function mover(it, dx, dy) {
  if (it.k === 'pen') return { ...it, p: it.p.map((v, i) => r1(v + (i % 2 ? dy : dx))) };
  return { ...it, x: r1(it.x + dx), y: r1(it.y + dy) };
}
