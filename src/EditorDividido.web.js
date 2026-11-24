// Editor de planilha no navegador do computador, em tela cheia e travado (só o roadbook rola), no estilo do Kraken:
// roadbook à esquerda, mapa à direita, divisória que se arrasta, botões REF/TRC/PC/REG embaixo do mapa.
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

const AZUL = '#2fb6d3';
const TIPO = { L: 'Largada', T: 'Tulipa', P: 'PC', C: 'Chegada' };
const chave = (e) => e.t + Math.round(e.d || 0);
const km3 = (m) => (m / 1000).toFixed(3).replace('.', ',');

function Campo({ rot, children }) {
  return <label style={{ display: 'block', marginBottom: 10 }}><div style={{ color: '#666', fontSize: 12, marginBottom: 3 }}>{rot}</div>{children}</label>;
}
const INP = { width: '100%', boxSizing: 'border-box', border: '1px solid #bbb', borderRadius: 4, padding: '8px 10px', fontSize: 15 };

function Referencia({ e, n, onFechar, onSalvar }) {
  const [nm, setNm] = useState(e.nm || '');
  const [nt, setNt] = useState(String(e.nt || 0));
  const [afer, setAfer] = useState(!!e.afer);
  const ehP = e.t === 'P';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onFechar}>
      <div style={{ background: '#fff', color: '#111', borderRadius: 10, width: 420, maxWidth: '92vw', overflow: 'hidden' }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ background: AZUL, color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Referência {n}</span><span style={{ cursor: 'pointer' }} onClick={onFechar}>✕</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Campo rot="Odômetro (km)"><div style={{ ...INP, background: '#f3f3f3', fontWeight: 700 }}>{km3(e.dz ?? e.d)}</div></Campo></div>
            <div style={{ flex: 1 }}><Campo rot="Tipo"><div style={{ ...INP, background: '#f3f3f3' }}>{TIPO[e.t] || e.t}</div></Campo></div>
          </div>
          <Campo rot="Texto da instrução (aparece em amarelo no roadbook)"><input style={INP} value={nm} onChange={(ev) => setNm(ev.target.value)} placeholder="Ex.: PELA ESQ" /></Campo>
          {ehP && <Campo rot="Neutro: segundos parado neste ponto (0 = sem)"><input style={INP} inputMode="numeric" value={nt} onChange={(ev) => setNt(ev.target.value.replace(/[^0-9]/g, ''))} /></Campo>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}><input type="checkbox" checked={afer} onChange={(ev) => setAfer(ev.target.checked)} />Ponto de aferição (AFER)</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderTop: '1px solid #ddd' }}>
          <button style={{ padding: '8px 16px', border: 0, borderRadius: 4, background: '#eee', cursor: 'pointer' }} onClick={onFechar}>Cancelar</button>
          <button style={{ padding: '8px 16px', border: 0, borderRadius: 4, background: AZUL, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => { onSalvar({ key: chave(e), nm: nm.trim(), afer, nt: ehP ? Number(nt) || 0 : null, n: e.n }); onFechar(); }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function EditorDividido({ st, nome, tul, coords, wps, totalM, nTrechos, grupos, editable, busy, onTap, onDesfazer, onLimpar, onNovoTrecho, onSalvarRef, onPublicar, onSimular, onPdf, onAtualizar, onLista, onVoltar }) {
  const [frac, setFrac] = useState(0.5);
  const [sel, setSel] = useState(-1);
  const [focn, setFocn] = useState(0);
  const [modoPc, setModoPc] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dlg, setDlg] = useState(-1);
  const [aviso, setAviso] = useState('');
  const cont = useRef(null);
  const esq = useRef(null);
  const linhas = useRef({});
  const arrasta = useRef(false);

  // Tela travada: a página de trás não rola.
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = o; };
  }, []);

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

  const avisar = (m) => { setAviso(m); setTimeout(() => setAviso(''), 4500); };
  const escolher = (i, rolar, centrar) => {
    setSel(i);
    if (centrar) setFocn((n) => n + 1);
    if (rolar) {
      const el = linhas.current[i], box = esq.current;
      if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
    }
  };
  useEffect(() => { if (sel >= lista.length) setSel(-1); }, [lista.length]);

  const mover = (ev) => {
    if (!arrasta.current || !cont.current) return;
    const r = cont.current.getBoundingClientRect();
    setFrac(Math.max(0.12, Math.min(0.88, (ev.clientX - r.left) / r.width)));
  };

  const nTul = lista.filter((e) => e.t === 'T' && !e.cont).length;
  const nPc = lista.filter((e) => e.t === 'P' && !e.cont && !(e.nt > 0 && e.pn == null)).length;
  const selecionada = sel >= 0 ? lista[sel] : null;
  const abrirRef = (i) => { const e = lista[i]; if (!e || e.cont) return avisar('Esta é a continuação do neutro: edite a linha do neutro.'); setDlg(i); };

  const BTN = (cor, txt, on, extra) => (
    <button onClick={on} style={{ border: 0, background: cor, fontWeight: 700, fontSize: 18, cursor: 'pointer', color: '#111', ...extra }}>{txt}</button>
  );
  const item = (txt, fn) => <div style={{ padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => { setMenu(false); fn(); }}>{txt}</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', background: '#12161b' }}>
      <div style={{ height: 56, background: AZUL, color: '#fff', display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', flexShrink: 0 }}>
        <span style={{ fontSize: 24, cursor: 'pointer' }} title="Voltar" onClick={onVoltar}>←</span>
        <span style={{ fontSize: 20, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}</span>
        <span style={{ fontSize: 13 }}>{aviso || busy || ''}</span>
        <div style={{ position: 'relative' }}>
          <span style={{ fontSize: 24, cursor: 'pointer', padding: '0 6px' }} onClick={() => setMenu((m) => !m)}>⋮</span>
          {menu && (
            <div style={{ position: 'absolute', right: 0, top: 36, background: '#fff', color: '#111', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.35)', zIndex: 70, fontSize: 15 }}>
              {item('Publicar prova para os celulares', onPublicar)}
              {item('Simular a prova', onSimular)}
              {item('Gerar PDF do roadbook', onPdf)}
              {item('Buscar atualização da nuvem', onAtualizar)}
              {item('Desfazer último ponto', onDesfazer)}
              {item('Limpar tudo', onLimpar)}
              {item('Trechos e médias (lista)', onLista)}
            </div>
          )}
        </div>
      </div>
      <div style={{ background: '#3a3a3a', color: '#fff', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', textAlign: 'center', padding: '6px 0', flexShrink: 0 }}>
        {[[km3(totalM), 'Km total'], [nTul, 'Tulipas'], [nPc, 'PCs'], [nTrechos, 'Trechos']].map(([v, r]) => (
          <div key={r}><div style={{ fontSize: 24, fontWeight: 600 }}>{v}</div><div style={{ fontSize: 12, color: '#bbb' }}>{r}</div></div>
        ))}
      </div>
      <div ref={cont} style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div ref={esq} style={{ width: `${frac * 100}%`, overflowY: 'auto', overflowX: 'hidden', position: 'relative', minWidth: 0 }}>
          {lista.length === 0 && <div style={{ color: '#a8a8a8', padding: 16, fontSize: 15 }}>Toque em PC (embaixo do mapa) e clique no mapa para marcar a largada, os PCs e a chegada. O roadbook aparece aqui.</div>}
          {lista.map((e, i) => (
            <div key={i} ref={(el) => { linhas.current[i] = el; }} onClick={() => escolher(i, false, true)}
              style={{ position: 'relative', cursor: 'pointer', background: i === sel ? '#12304f' : 'transparent', paddingLeft: 4 }}>
              <Entrada e={e} st={st} org grupos={grupos} destaque={i === sel} />
              <div title="Editar referência" onClick={(ev) => { ev.stopPropagation(); escolher(i, false, true); abrirRef(i); }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 74, cursor: 'pointer' }} />
            </div>
          ))}
        </div>
        <div style={{ width: 22, background: AZUL, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, cursor: 'col-resize', touchAction: 'none', userSelect: 'none', flexShrink: 0, color: '#fff' }}
          onPointerDown={(ev) => { arrasta.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); }}
          onPointerMove={mover}
          onPointerUp={(ev) => { arrasta.current = false; try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch {} }}>
          <span title="Aumentar o mapa" style={{ cursor: 'pointer', fontSize: 16 }} onPointerDown={(ev) => ev.stopPropagation()} onClick={() => setFrac((f) => Math.max(0.12, f - 0.2))}>◀</span>
          <span style={{ width: 4, height: 40, background: 'rgba(255,255,255,.6)', borderRadius: 2 }} />
          <span title="Aumentar o roadbook" style={{ cursor: 'pointer', fontSize: 16 }} onPointerDown={(ev) => ev.stopPropagation()} onClick={() => setFrac((f) => Math.min(0.88, f + 0.2))}>▶</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <MapaWeb wps={wps} coords={coords} marks={marks} sat editable={editable && modoPc} onTap={onTap} onMark={(id) => escolher(id, true, false)} foc={foc} focn={focn} height="100%" mb={0} />
            </div>
            {modoPc && <div style={{ position: 'absolute', left: 50, top: 10, background: '#ef5350', color: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 14, zIndex: 5 }}>Marcando PCs: clique no mapa</div>}
          </div>
          <div style={{ height: 56, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', flexShrink: 0 }}>
            {BTN('#ffee00', 'REF', () => (selecionada ? abrirRef(sel) : avisar('Clique numa linha do roadbook (ou num ponto do mapa) e toque em REF.')))}
            {BTN('#00d56b', 'TRC', () => { if (!selecionada) return avisar('Escolha a linha onde o novo trecho começa e toque em TRC.'); const m = onNovoTrecho(selecionada.d); avisar(m || 'Trecho criado: ajuste a média em "Trechos e médias".'); })}
            {BTN('#ef5350', 'PC', () => { if (!editable) return avisar('Percurso do levantamento: para editar pelo mapa volte ao automático (menu ⋮ > Trechos e médias).'); setModoPc((m) => !m); }, modoPc ? { outline: '4px solid #fff', outlineOffset: -4 } : null)}
            {BTN('#ff6d00', 'REG', () => avisar('REG ainda não está disponível.'), { opacity: 0.45 })}
          </div>
        </div>
      </div>
      {dlg >= 0 && lista[dlg] && <Referencia key={dlg} e={lista[dlg]} n={dlg + 1} onFechar={() => setDlg(-1)} onSalvar={onSalvarRef} />}
    </div>
  );
}
