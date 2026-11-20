// Lógica do odômetro de rally e do cronômetro de PC (sem tela, fácil de testar).
import { haversine } from './store.js';

const MAX_ACC = 25;

// Distância acumulada (metros, sem calibração) até cada ponto.
export function cumulative(points) {
  const cum = new Array(points.length).fill(0);
  let dist = 0;
  let last = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!(p.acc != null && p.acc > MAX_ACC)) {
      if (last) {
        const d = haversine(last, p);
        if (d > 1) dist += d;
      }
      last = p;
    }
    cum[i] = dist;
  }
  return cum;
}

// Resolve um trecho publicado pelo organizador para a classe do competidor.
// V = média por classe (Graduado e Moto usam a mesma; Amador tem a sua), D = deslocamento (tempo limite, sem pontos).
// nt = segundos de neutro no fim do trecho (parada obrigatória no PC).
export const GRUPOS_PADRAO = [{ nome: 'A', cats: ['TURISMO LIGHT', 'TURISMO', 'GRADUADO', 'MASTER'] }];
// categorias = [{nome, g}] (g = índice do grupo de média). Sem categorias, usa o padrão: as 4 categorias no grupo A.
export function gruposDe(cats) {
  if (!cats || !cats.length) return GRUPOS_PADRAO;
  const n = Math.max(...cats.map((c) => c.g || 0)) + 1;
  return Array.from({ length: n }, (_, i) => ({ nome: String.fromCharCode(65 + i), cats: cats.filter((c) => (c.g || 0) === i).map((c) => c.nome) }));
}
export function grupoIdx(classe, grupos) {
  const g = grupos && grupos.length ? grupos : GRUPOS_PADRAO;
  const i = g.findIndex((x) => x.cats.includes(classe));
  return i < 0 ? 0 : i;
}
export function resolverTrecho(t, classe, grupos) {
  if (t.t === 'D') return { tipo: 'D', km: t.km, kmh: t.min > 0 ? t.km / (t.min / 60) : 0, min: t.min, nt: t.nt || 0 };
  const idx = grupoIdx(classe, grupos);
  const kmh = Array.isArray(t.v) ? (t.v[idx] ?? t.v[0]) : classe === 'AMADOR' ? t.ka : t.kg;
  return { tipo: 'V', km: t.km, kmh, nt: t.nt || 0 };
}

// Estado do trecho: começa vazio. Distâncias em metros já calibradas.
export const newStage = () => ({ active: false, t0: 0, d0: 0, adjust: 0, targetKmh: 0, km: 0, idx: -1, tipo: 'V', min: 0, pcs: [] });

// Roteiro: uma linha por trecho, "distância_km média_kmh" (ex.: "4,2 30" ou "4.2; 30").
// Linhas vazias e que começam com # são ignoradas.
export function parseRoteiro(text) {
  const trechos = [];
  const erros = [];
  (text || '').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const nums = line.split(/[;\s]+/).map((x) => parseFloat(x.replace(',', '.')));
    if (nums.length >= 2 && nums[0] > 0 && nums[1] > 0) trechos.push({ tipo: 'V', km: nums[0], kmh: nums[1], nt: 0 });
    else erros.push(i + 1);
  });
  return { trechos, erros };
}

// Inicia (ou zera) o trecho no ponto mais recente.
// extra: { keepPcs, targetKmh, km, idx } para iniciar um trecho do roteiro.
// Distância acumulada (m) no instante t, interpolando entre os dois pontos vizinhos.
export function distAt(points, cum, t) {
  const n = points.length;
  if (!n) return 0;
  if (t <= points[0].t) return cum[0];
  if (t >= points[n - 1].t) return cum[n - 1];
  let i = 0;
  while (i < n - 2 && points[i + 1].t <= t) i++;
  const a = points[i], b = points[i + 1];
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  return cum[i] + (cum[i + 1] - cum[i]) * f;
}

export function startStage(stage, points, cum, factor, extra = {}) {
  const n = points.length;
  const { keepPcs, tAt, ...rest } = extra;
  return {
    ...stage,
    active: n > 0,
    t0: tAt != null ? tAt : n ? points[n - 1].t : 0,
    d0: n ? (tAt != null ? distAt(points, cum, tAt) : cum[n - 1]) * factor : 0,
    adjust: 0,
    pcs: keepPcs ? stage.pcs : [],
    ...rest,
  };
}

// Situação atual do trecho. Retorna null se não houver trecho ativo.
export function status(stage, points, cum, factor) {
  const n = points.length;
  if (!stage.active || !n) return null;
  const fin = (x, pad = 0) => (Number.isFinite(x) ? x : pad);
  const elapsed = fin((points[n - 1].t - stage.t0) / 1000); // s
  const dist = fin(fin(cum[n - 1]) * fin(factor, 1) - fin(stage.d0) + fin(stage.adjust)); // m
  const v = stage.targetKmh / 3.6; // m/s
  const avgKmh = elapsed > 0 ? (dist / elapsed) * 3.6 : 0;
  let idealDist = null;
  let aheadSec = null; // positivo = adiantado, negativo = atrasado
  if (v > 0) {
    idealDist = v * elapsed;
    aheadSec = (dist - idealDist) / v;
  }
  const remain = stage.km > 0 ? stage.km * 1000 - dist : null; // m até o fim do trecho
  return { elapsed, dist, avgKmh, idealDist, aheadSec, remain };
}

// Marca um PC no momento atual.
export function markPc(stage, points, cum, factor) {
  const s = status(stage, points, cum, factor);
  if (!s) return stage;
  const v = stage.targetKmh / 3.6;
  // Com roteiro, o ideal é o tempo da distância planejada do trecho; sem roteiro, usa a distância medida.
  const refDist = stage.km > 0 ? stage.km * 1000 : s.dist;
  const idealTime = stage.tipo === 'D' && stage.min > 0 ? stage.min * 60 : v > 0 ? refDist / v : null;
  const diff = idealTime != null ? s.elapsed - idealTime : null; // positivo = demorou mais (atrasado)
  const pc = { t: points[points.length - 1].t, t0: stage.t0, n: stage.pcs.length + 1, tipo: stage.tipo || 'V', trecho: stage.idx >= 0 ? stage.idx + 1 : null, elapsed: s.elapsed, dist: s.dist, avgKmh: s.avgKmh, idealTime, diff };
  return { ...stage, pcs: [...stage.pcs, pc] };
}

export const fmtDur = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const p = (x) => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 60))}:${p(s % 60)}`;
};

export const fmtSigned = (sec) => `${sec >= 0 ? '+' : '−'}${Math.abs(sec).toFixed(1)} s`;

export function pcsToText(stage, factor) {
  const head = `Trecho | alvo ${stage.targetKmh || '—'} km/h | calibração x${factor.toFixed(4)}`;
  const rows = stage.pcs.map(
    (p) =>
      `PC${p.n}${p.trecho ? ` (trecho ${p.trecho})` : ''}: ${(p.dist / 1000).toFixed(3)} km em ${fmtDur(p.elapsed)} (${p.avgKmh.toFixed(1)} km/h)` +
      (p.tipo === 'D' ? ` | deslocamento (sem pontos)` : p.diff != null ? ` | ideal ${fmtDur(p.idealTime)} | ${p.diff > 0 ? 'atrasado' : 'adiantado'} ${Math.abs(p.diff).toFixed(1)} s` : '')
  );
  return [head, ...rows].join('\n');
}

// Pontuação: 1 ponto por segundo de diferença (adiantado ou atrasado) em cada PC.
export const pontos = (pcs) => pcs.reduce((a, p) => a + (p.diff != null && p.tipo !== 'D' ? Math.abs(p.diff) : 0), 0);

// Ordena o ranking: mais PCs feitos primeiro, depois menos pontos.
export function rank(results) {
  return [...results].sort((a, b) => (b.npcs - a.npcs) || (a.pontos - b.pontos));
}


// ---- Resultado oficial a partir do datalogger (trilha completa enviada pelo competidor) ----
// Instante em que a trilha passa mais perto do ponto (PC), a partir de fromT. null se não passou a menos de maxD metros.
export function crossingTime(points, wp, fromT, maxD = 60) {
  let best = null, inside = false;
  for (const p of points) {
    if (p.t < fromT) continue;
    const d = haversine({ lat: wp[0], lon: wp[1] }, p);
    if (d <= maxD) { inside = true; if (!best || d < best.d) best = { d, t: p.t }; }
    else if (inside) break;
  }
  return best ? best.t : null;
}

// Instante em que a trilha cruza a linha do PC [la1,lo1,la2,lo2] (interpolado entre dois pontos), depois de fromT.
export function crossingLine(points, line, fromT) {
  const [la1, lo1, la2, lo2] = line;
  const la0 = (la1 + la2) / 2, lo0 = (lo1 + lo2) / 2, kx = Math.cos((la0 * Math.PI) / 180) * 111320, ky = 110540;
  const X = (lo) => (lo - lo0) * kx, Y = (la) => (la - la0) * ky;
  const ax = X(lo1), ay = Y(la1), bx = X(lo2), by = Y(la2);
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], q = points[i];
    if (q.t < fromT) continue;
    const px = X(p.lon), py = Y(p.lat), qx = X(q.lon), qy = Y(q.lat);
    const d1x = qx - px, d1y = qy - py, d2x = bx - ax, d2y = by - ay;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-9) continue;
    const u = ((ax - px) * d2y - (ay - py) * d2x) / den; // posição no segmento da trilha
    const w = ((ax - px) * d1y - (ay - py) * d1x) / den; // posição na linha do PC
    if (u >= 0 && u <= 1 && w >= 0 && w <= 1) {
      const t = p.t + u * (q.t - p.t);
      if (t >= fromT) return t;
    }
  }
  return null;
}

// Refaz os PCs oficiais: cada PC vale o instante em que o carro passou pelo ponto do mapa.
// wps = [largada, PC1, ..., chegada]; trechos = trechos publicados; t0 = instante da largada.
export function oficialDeTrilha(points, wps, trechos, classe, grupos, t0, pcl = []) {
  const cum = cumulative(points);
  const pcs = [];
  let tIni = t0;
  for (let i = 0; i < trechos.length; i++) {
    const wp = wps[i + 1];
    if (!wp) break;
    const tr = resolverTrecho(trechos[i], classe, grupos);
    const ln = pcl.slice((i + 1) * 4, (i + 1) * 4 + 4);
    const tc = ln.length === 4 && ln.some((x) => x) ? crossingLine(points, ln, tIni) : crossingTime(points, wp, tIni);
    if (tc == null) break;
    const elapsed = (tc - tIni) / 1000;
    const dist = distAt(points, cum, tc) - distAt(points, cum, tIni);
    const v = tr.kmh / 3.6;
    const idealTime = tr.tipo === 'D' ? tr.min * 60 : v > 0 ? (tr.km * 1000) / v : null;
    pcs.push({ n: i + 1, tipo: tr.tipo, trecho: i + 1, elapsed, dist, avgKmh: elapsed > 0 ? (dist / elapsed) * 3.6 : 0, idealTime, diff: idealTime != null ? elapsed - idealTime : null, t0: tIni, t: tc });
    tIni = tr.nt > 0 ? tc + tr.nt * 1000 : tc;
  }
  return pcs;
}

export function pcsDoLogger(dl) {
  const t0 = dl.t0 || 0;
  return dl.t.map((dt, i) => ({ t: t0 + dt * 1000, lat: dl.la[i] / 1e5, lon: dl.lo[i] / 1e5, acc: null }));
}
