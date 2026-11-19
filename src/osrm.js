// Calcula a rota pelas ruas (OSRM, gratuito) e monta o roadbook de tulipas.
const TURN_TYPES = ['turn', 'end of road', 'fork', 'roundabout', 'rotary', 'roundabout turn', 'continue', 'on ramp', 'off ramp', 'merge'];

export async function calcularRota(wps, kmh = []) {
  if (wps.length < 2) return { coords: [], legs: [], tul: [] };
  const path = wps.map((w) => `${w[1].toFixed(6)},${w[0].toFixed(6)}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.code !== 'Ok' || !j.routes?.length) throw new Error('Rota não encontrada');
  const rt = j.routes[0];
  let coords = rt.geometry.coordinates.map((c) => [c[1], c[0]]);
  const step = Math.ceil(coords.length / 700);
  if (step > 1) coords = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);

  // Roadbook: largada, tulipas (curvas, rotatórias, bifurcações), PCs e chegada, com distâncias.
  const tul = [{ t: 'L', d: 0, p: 0, kmh: kmh[0] || 30 }];
  let acc = 0;
  let prev = 0;
  rt.legs.forEach((leg, li) => {
    leg.steps.forEach((s) => {
      const m = s.maneuver;
      const it = s.intersections && s.intersections[0];
      const isEnd = m.type === 'depart' || m.type === 'arrive';
      const straight = m.type === 'continue' && (!m.modifier || m.modifier === 'straight');
      if (!isEnd && !straight && TURN_TYPES.includes(m.type) && it && it.bearings) {
        const d = Math.round(acc);
        tul.push({
          t: 'T', d, p: d - prev, ty: m.type, mo: m.modifier || '',
          b: it.bearings.map((x) => Math.round(x)), i: it.in ?? -1, o: it.out ?? -1,
          ex: m.exit || 0, nm: s.name || '',
        });
        prev = d;
      }
      acc += s.distance;
    });
    const d = Math.round(acc);
    const last = li === rt.legs.length - 1;
    tul.push({ t: last ? 'C' : 'P', n: li + 1, d, p: d - prev, kmh: last ? 0 : kmh[li + 1] || 30 });
    prev = d;
  });
  return { coords, legs: rt.legs.map((l) => l.distance / 1000), tul };
}
