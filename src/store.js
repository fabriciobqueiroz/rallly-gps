// Armazena os pontos de GPS em memória e avisa a tela quando chegam novos.
// O processo continua vivo enquanto o serviço em primeiro plano estiver ativo.
const state = { points: [], startedAt: null, listeners: new Set() };

export const getState = () => state;
export const subscribe = (fn) => {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
};
const emit = () => state.listeners.forEach((fn) => fn());

// Persistência opcional (arquivo no celular). Configurada em src/persist.js.
let persist = null;
export function setPersistence(p) {
  persist = p;
  try {
    const saved = p.load();
    if (saved.length && !state.points.length) {
      state.points = saved;
      state.startedAt = saved[0].t;
    }
  } catch {}
}

const toPoint = (l) => ({
  t: l.timestamp,
  lat: l.coords.latitude,
  lon: l.coords.longitude,
  acc: l.coords.accuracy,
  spd: l.coords.speed, // m/s, pode ser null
  hdg: l.coords.heading, // graus, pode ser null
  mocked: !!l.mocked,
});

export function addLocations(locations) {
  for (const l of locations) state.points.push(toPoint(l));
  try { persist && persist.append(locations.map(toPoint)); } catch {}
  emit();
}

export function begin() {
  state.startedAt = Date.now();
  emit();
}

export function clear() {
  state.points = [];
  state.startedAt = null;
  try { persist && persist.reset(); } catch {}
  emit();
}

// Distância entre dois pontos (metros), fórmula de haversine.
export function haversine(a, b) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Só soma trechos com precisão aceitável, para o ruído do GPS não inflar a distância.
const MAX_ACC = 25;
export function summarize(points) {
  let dist = 0;
  let last = null;
  let maxGap = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0) maxGap = Math.max(maxGap, p.t - points[i - 1].t);
    if (p.acc != null && p.acc > MAX_ACC) continue;
    if (last) {
      const d = haversine(last, p);
      if (d > 1) dist += d; // ignora tremor abaixo de 1 m
    }
    last = p;
  }
  const n = points.length;
  const span = n > 1 ? points[n - 1].t - points[0].t : 0;
  return {
    n,
    dist,
    span,
    avgInterval: n > 1 ? span / (n - 1) : 0,
    maxGap,
    avgKmh: span > 0 ? (dist / (span / 1000)) * 3.6 : 0,
  };
}

export const CSV_HEAD = 'timestamp_iso,lat,lon,precisao_m,velocidade_ms,simulado';
export const csvRow = (p) =>
  `${new Date(p.t).toISOString()},${p.lat},${p.lon},${p.acc ?? ''},${p.spd ?? ''},${p.mocked}`;
export function toCsv(points) {
  return [CSV_HEAD, ...points.map(csvRow)].join('\n');
}
