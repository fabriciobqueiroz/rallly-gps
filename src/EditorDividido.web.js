// Editor de planilha no navegador do computador, no estilo do Kraken:
// roadbook de um lado, mapa do outro, divisória que se arrasta (ou ◀ ▶) e as duas partes ligadas.
import { useEffect, useMemo, useRef, useState } from 'react';
import MapaWeb from './MapaWeb';
import { Entrada } from './Tulipa';
import { comContinuacao } from './rally';

const rad = (x) => (x * Math.PI) / 180;
const hav = (a, b) => {
  const dLa = rad(b[0] - a[0]), dLo = rad(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLo / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Posição (lat, lon) de uma distância d (m) ao longo do traçado.
function pontoEm(coords, cum, totalM, d) {
  if (!coords.length) return null;
  const alvo = totalM > 0 ? (d / totalM) * cum[cum.length - 1] : d;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < alvo) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = Math.max(0, Math.min(1, (alvo - cum[i - 1]) / seg));
  const a = coords[i - 1], b = coords[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

const BT = { background: '#262b32', color: '#fff', border: '1px solid #3a414b', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 };
const ALTURA = 640;

export default function EditorDividido({ st, tul, coords, wps, totalM, grupos, editable, onTap, onDesfazer, onLimpar }) {
  const [frac, setFrac] = useState(0.5);
  const [sel, setSel] = useState(-1);
  const [focn, setFocn] = useState(0);
  const cont = useRef(null);
  const esq = useRef(null);
  const linhas = useRef({});
  const arrasta = useRef(false);

  const lista = comContinuacao(tul);
  const sig = tul.map((e) => e.t + e.d).join(',');
  const cum = useMemo(() => {
    const c = [0];
    for (let i = 1; i < coords.length; i++) c.push(c[i - 1] + hav(coords[i - 1], coords[i]));
    return c;
  }, [coords]);
  const pos = useMemo(() => lista.map((e) => (e.cont ? null : pontoEm(coords, cum, totalM, e.d))), [sig, cum, totalM]);
  const marks = useMemo(() => lista.map((e, i) => {
    if (!pos[i]) return null;
    const cls = i === sel ? 'r' : e.t === 'L' ? 'l' : e.t === 'C' ? 'c' : e.t === 'P' ? 's' : 'k';
    return { id: i, lat: pos[i][0], lon: pos[i][1], txt: String(i + 1), cls };
  }).filter(Boolean), [sig, pos, sel]);
  const foc = sel >= 0 && pos[sel] ? pos[sel] : null;

  const escolher = (i, rolar, centrar) => {
    setSel(i);
    if (centrar) setFocn((n) => n + 1);
    if (rolar) {
      const el = linhas.current[i], box = esq.current;
      if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
    }
  };
  // Se a lista encolher (desfazer ponto), a seleção não pode apontar para uma linha que sumiu.
  useEffect(() => { if (sel >= lista.length) setSel(-1); }, [lista.length]);

  const mover = (ev) => {
    if (!arrasta.current || !cont.current) return;
    const r = cont.current.getBoundingClientRect();
    setFrac(Math.max(0.12, Math.min(0.88, (ev.clientX - r.left) / r.width)));
  };
  const total = (totalM / 1000).toFixed(3).replace('.', ',');

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <button style={BT} onClick={onDesfazer}>Desfazer ponto</button>
        <button style={BT} onClick={onLimpar}>Limpar tudo</button>
        <span style={{ color: '#a8a8a8', fontSize: 13 }}>{lista.length ? `${lista.length} linhas · ${total} km` : 'Clique no mapa para marcar a largada, os pontos e a chegada.'}</span>
      </div>
      <div ref={cont} style={{ display: 'flex', height: ALTURA, border: '1px solid #3a414b', borderRadius: 10, overflow: 'hidden', background: '#12161b' }}>
        <div ref={esq} style={{ width: `${frac * 100}%`, overflowY: 'auto', overflowX: 'hidden', position: 'relative', minWidth: 0 }}>
          {lista.length === 0 && <div style={{ color: '#a8a8a8', padding: 14, fontSize: 14 }}>O roadbook aparece aqui quando houver largada e chegada no mapa.</div>}
          {lista.map((e, i) => (
            <div key={i} ref={(el) => { linhas.current[i] = el; }} onClick={() => escolher(i, false, true)}
              style={{ cursor: 'pointer', background: i === sel ? '#12304f' : 'transparent', paddingLeft: 4 }}>
              <Entrada e={e} st={st} org grupos={grupos} destaque={i === sel} />
            </div>
          ))}
        </div>
        <div style={{ width: 22, background: '#262b32', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, cursor: 'col-resize', touchAction: 'none', userSelect: 'none', flexShrink: 0 }}
          onPointerDown={(ev) => { arrasta.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); }}
          onPointerMove={mover}
          onPointerUp={(ev) => { arrasta.current = false; try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch {} }}>
          <span title="Aumentar o mapa" style={{ color: '#fff', cursor: 'pointer', fontSize: 16 }} onPointerDown={(ev) => ev.stopPropagation()} onClick={() => setFrac((f) => Math.max(0.12, f - 0.2))}>◀</span>
          <span style={{ width: 4, height: 40, background: '#6b7380', borderRadius: 2 }} />
          <span title="Aumentar o roadbook" style={{ color: '#fff', cursor: 'pointer', fontSize: 16 }} onPointerDown={(ev) => ev.stopPropagation()} onClick={() => setFrac((f) => Math.min(0.88, f + 0.2))}>▶</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <MapaWeb wps={wps} coords={coords} marks={marks} editable={editable} onTap={onTap} onMark={(id) => escolher(id, true, false)} foc={foc} focn={focn} height={ALTURA} />
        </div>
      </div>
    </div>
  );
}
