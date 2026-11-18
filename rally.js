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

// Estado do trecho: começa vazio. Distâncias em metros já calibradas.
export const newStage = () => ({ active: false, t0: 0, d0: 0, adjust: 0, targetKmh: 0, km: 0, idx: -1, pcs: [] });

// Roteiro: uma linha por trecho, "distância_km média_kmh" (ex.: "4,2 30" ou "4.2; 30").
// Linhas vazias e que começam com # são ignoradas.
export function parseRoteiro(text) {
  const trechos = [];
  const erros = [];
  (text || '').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const nums = line.split(/[;\s]+/).map((x) => parseFloat(x.replace(',', '.')));
    if (nums.length >= 2 && nums[0] > 0 && nums[1] > 0) trechos.push({ km: nums[0], kmh: nums[1] });
    else erros.push(i + 1);
  });
  return { trechos, erros };
}

// Inicia (ou zera) o trecho no ponto mais recente.
// extra: { keepPcs, targetKmh, km, idx } para iniciar um trecho do roteiro.
export function startStage(stage, points, cum, factor, extra = {}) {
  const n = points.length;
  const { keepPcs, ...rest } = extra;
  return {
    ...stage,
    active: n > 0,
    t0: n ? points[n - 1].t : 0,
    d0: n ? cum[n - 1] * factor : 0,
    adjust: 0,
    pcs: keepPcs ? stage.pcs : [],
    ...rest,
  };
}

// Situação atual do trecho. Retorna null se não houver trecho ativo.
export function status(stage, points, cum, factor) {
  const n = points.length;
  if (!stage.active || !n) return null;
  const elapsed = (points[n - 1].t - stage.t0) / 1000; // s
  const dist = cum[n - 1] * factor - stage.d0 + stage.adjust; // m
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
  const idealTime = v > 0 ? s.dist / v : null; // tempo que seria o ideal para essa distância
  const diff = idealTime != null ? s.elapsed - idealTime : null; // positivo = demorou mais (atrasado)
  const pc = { n: stage.pcs.length + 1, trecho: stage.idx >= 0 ? stage.idx + 1 : null, elapsed: s.elapsed, dist: s.dist, avgKmh: s.avgKmh, idealTime, diff };
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
      (p.diff != null ? ` | ideal ${fmtDur(p.idealTime)} | ${p.diff > 0 ? 'atrasado' : 'adiantado'} ${Math.abs(p.diff).toFixed(1)} s` : '')
  );
  return [head, ...rows].join('\n');
}
