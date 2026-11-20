// Detecta o cruzamento pelo OpenStreetMap (Overpass) e monta o fundo de satélite (Esri) para decalcar a tulipa.
const R = 6371000, rad = (d) => (d * Math.PI) / 180;
export const dist = (a, b) => { const dl = rad(b[0] - a[0]), dn = rad(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
export const rumo = (a, b) => { const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0])); const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1])); return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360; };
const ANGS = [0, 45, 90, 135, 225, 270, 315];
const snap = (a) => ANGS.reduce((b, x) => (Math.abs(((a - x + 540) % 360) - 180) < Math.abs(((a - b + 540) % 360) - 180) ? x : b), 0);
const dif = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// Imagem de satélite (≈90 m de lado) centrada no ponto. Use rotação -hdg para a direção de viagem ficar para cima.
export function satUrl(lat, lon, metros = 45) {
  const k = 20037508.34 / 180;
  const x = lon * k, y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * k;
  const h = metros / Math.cos(rad(lat));
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${x - h},${y - h},${x + h},${y + h}&bboxSR=3857&imageSR=3857&size=640,640&format=jpg&f=image`;
}

// m: {lat,lon,hdg}; saidaRumo: rumo (graus) do trecho depois do ponto, se já houver rastro. Devolve {arms,out,rot,ex}.
export async function detectarCruzamento(m, saidaRumo) {
  if (m.hdg == null) throw new Error('Sem direção do veículo nesta marca. Marque as ruas manualmente.');
  const q = `[out:json][timeout:12];way(around:40,${m.lat},${m.lon})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];out geom tags;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!r.ok) throw new Error('Servidor de mapas indisponível (' + r.status + ').');
  const ways = ((await r.json()).elements || []).filter((w) => w.geometry && w.geometry.length > 1);
  if (!ways.length) throw new Error('Nenhuma rua encontrada aqui no mapa.');
  const key = (p) => p.lat.toFixed(6) + ',' + p.lon.toFixed(6);
  const cnt = {}, pos = {};
  ways.forEach((w) => w.geometry.forEach((p) => { const k = key(p); cnt[k] = (cnt[k] || 0) + 1; pos[k] = [p.lat, p.lon]; }));
  // nó do cruzamento: o mais próximo da marca entre os nós com 2+ ruas (ou pontas); se não houver, o mais próximo.
  const me = [m.lat, m.lon];
  const nos = Object.keys(cnt).filter((k) => cnt[k] >= 2);
  const lista = (nos.length ? nos : Object.keys(cnt)).sort((a, b) => dist(me, pos[a]) - dist(me, pos[b]));
  const no = lista[0], nopos = pos[no];
  const brs = []; let rot = false;
  ways.forEach((w) => {
    const g = w.geometry, i = g.findIndex((p) => key(p) === no);
    if (i < 0) return;
    if (w.tags && w.tags.junction === 'roundabout') rot = true;
    [-1, 1].forEach((s) => {
      for (let j = i + s; j >= 0 && j < g.length; j += s) {
        const pj = [g[j].lat, g[j].lon];
        if (dist(nopos, pj) >= 10 || j === 0 || j === g.length - 1) { if (dist(nopos, pj) > 2) brs.push(rumo(nopos, pj)); break; }
      }
    });
  });
  // une braços quase iguais
  const braços = [];
  brs.forEach((b) => { if (!braços.some((x) => dif(x, b) < 20)) braços.push(b); });
  // rua de chegada: o braço mais próximo de onde o carro veio
  const veio = (m.hdg + 180) % 360;
  const ent = braços.reduce((a, b) => (dif(b, veio) < dif(a, veio) ? b : a), braços[0]);
  const viagem = (ent + 180) % 360;
  const arms = [...new Set(braços.filter((b) => b !== ent).map((b) => snap((b - viagem + 360) % 360)))].sort((a, b) => a - b);
  let out = null;
  if (saidaRumo != null) { const rel = snap((saidaRumo - viagem + 360) % 360); if (arms.includes(rel)) out = rel; }
  let ex = 1;
  if (rot && out != null) { const ord = [...arms].sort((a, b) => a - b); ex = ord.indexOf(out) + 1; }
  return { arms, out, rot, ex };
}

// Ponto a 'm' metros do ponto (lat,lon) no rumo 'brg' (graus).
export function destino(lat, lon, brg, m) {
  const d = m / R, b = rad(brg), la1 = rad(lat), lo1 = rad(lon);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [(la2 * 180) / Math.PI, (lo2 * 180) / Math.PI];
}
// Linha do PC perpendicular ao rumo de viagem: [la1,lo1,la2,lo2]; w = largura total (m), rot = giro extra (graus).
export function linhaPc(m) {
  const brg = (m.hdg ?? 0) + 90 + (m.lrot || 0), h = (m.lw || 30) / 2;
  const a = destino(m.lat, m.lon, brg, h), b = destino(m.lat, m.lon, brg + 180, h);
  return [a[0], a[1], b[0], b[1]].map((x) => Math.round(x * 1e6) / 1e6);
}
