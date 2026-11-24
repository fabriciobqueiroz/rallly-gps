// Editor de planilha no navegador do computador, em tela cheia e travado (só o roadbook rola), no estilo do Kraken:
// roadbook à esquerda, mapa à direita, divisória que se arrasta, botões REF/TRC/PC/REG embaixo do mapa.
import { useEffect, useMemo, useRef, useState } from 'react';
import MapaWeb from './MapaWeb';
import { Tulipa } from './Tulipa';
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
const km3 = (m) => (m / 1000).toFixed(3);
const hms = (sec) => { const x = Math.max(0, sec); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), r = x - h * 3600 - m * 60; return `${h}:${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`; };
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const CREME = '#f6f2e8', BORDA = '1px solid #000';
const GAL = 34; // altura de cada categoria dentro da linha

// Linha do roadbook no padrão do Kraken: km | velocidade (verde) | tempos | tulipa | instrução.
function Linha({ e, num, sel, grupos, onKm, onTul, onSel, refEl }) {
  const nTm = Math.max(1, e.tm ? e.tm.length : (grupos || []).length);
  const alt = Math.max(nTm * GAL, 96);
  const ehPc = e.t === 'P' && !(e.nt > 0 && e.pn == null) && !e.cont;
  const ehN = e.t === 'P' && e.nt > 0 && !e.cont;
  const temTul = e.t === 'T' || (ehN && !!((e.dw && e.dw.length) || Array.isArray(e.b)));
  const bg = sel ? '#ffee00' : ehN ? '#e1bee7' : e.nm ? '#aadaff' : CREME;
  const brd = e.t === 'P' && !e.cont ? '3px solid #e53935' : BORDA;
  const v = e.nx && Array.isArray(e.nx.v) ? e.nx.v : null;
  const txtN = e.t === 'L' ? 'LARGADA' : e.t === 'C' ? 'CHEGADA' : null;
  const celula = { borderRight: BORDA, boxSizing: 'border-box', height: '100%' };
  return (
    <div ref={refEl} onClick={onSel} style={{ display: 'flex', height: alt, background: bg, borderTop: brd, borderBottom: brd, color: '#111', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>
      <div title="Editar referência" onClick={(ev) => { ev.stopPropagation(); onKm(); }} style={{ ...celula, width: 104, padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', minHeight: 14 }}>
          <span>{e.t === 'T' ? (e.p / 1000).toFixed(2) : ''}</span><span>{e.tl ? e.tl.replace(' ', '') : ''}</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{km3(e.dz ?? e.d)}</div>
        {e.zero ? <div style={{ background: '#111', color: '#ffe600', fontSize: 11, fontWeight: 800, padding: '1px 4px', marginTop: 2, alignSelf: 'flex-start' }}>0.000 · ZERE</div> : null}
        {e.afer ? <div style={{ background: '#111', color: '#fff', fontSize: 11, fontWeight: 800, padding: '1px 5px', marginTop: 2, alignSelf: 'flex-start' }}>AFER</div> : null}
      </div>
      <div style={{ ...celula, width: 100, display: 'flex' }}>
        {ehPc ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, lineHeight: 1.1, background: sel ? '#ffee00' : '#fff' }}><span>PC</span><span>{e.pn ?? e.n}</span></div>
        ) : ehN ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#6a1b9a', color: '#fff', fontWeight: 800 }}><span style={{ fontSize: 20 }}>N</span><span style={{ fontSize: 22 }}>{e.nt < 60 ? Math.round(e.nt) : mmss(e.nt)}</span><span style={{ fontSize: 11 }}>{e.nt < 60 ? 'Seg' : 'min'}</span></div>
        ) : e.nx && e.nx.t === 'D' ? (
          <div style={{ flex: 1, background: '#ffe600', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}><span style={{ fontSize: 22 }}>D</span><span style={{ fontSize: 18 }}>{e.nx.min}'</span></div>
        ) : v ? (
          <>
            <div style={{ width: 30, background: '#2ecc71', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, borderRight: BORDA }}>V</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: nTm }, (_, g) => (
                <div key={g} style={{ flex: 1, background: '#2ecc71', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, borderBottom: g < nTm - 1 ? BORDA : 0 }}>{v[g] ?? v[0]}</div>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div style={{ ...celula, width: 104, display: 'flex', flexDirection: 'column', background: sel ? '#ffee00' : '#fff' }}>
        {Array.from({ length: nTm }, (_, g) => (
          <div key={g} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, borderBottom: g < nTm - 1 ? BORDA : 0 }}>{e.tm ? hms(e.tm[g] ?? e.tm[0]) : ''}</div>
        ))}
      </div>
      <div title="Editar tulipa" onClick={(ev) => { ev.stopPropagation(); onTul(); }} style={{ ...celula, width: 124, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {temTul ? <Tulipa e={e} size={Math.min(100, alt - 6)} /> : null}
        {temTul && num ? <span style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 12, fontWeight: 700 }}>{num}</span> : null}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6, textAlign: 'center' }}>
        {txtN ? <div style={{ fontWeight: 800, fontSize: 20 }}>{txtN}</div> : null}
        {e.nm ? <div style={{ fontWeight: e.nb === false ? 500 : 800, fontSize: 16, whiteSpace: 'pre-line', ...(e.ni ? { background: '#111', color: '#fff', padding: '2px 8px' } : null) }}>{e.nm}</div> : null}
        {e.cu > 0 ? <div style={{ fontSize: 22, marginTop: 4 }}>{'☠'.repeat(e.cu)}</div> : null}
        {ehPc && !e.nm ? <div style={{ fontSize: 13, color: '#555' }}>Raio: 15 m</div> : null}
      </div>
    </div>
  );
}

function Campo({ rot, children }) {
  return <label style={{ display: 'block', marginBottom: 10 }}><div style={{ color: '#666', fontSize: 12, marginBottom: 3 }}>{rot}</div>{children}</label>;
}
const INP = { width: '100%', boxSizing: 'border-box', border: '1px solid #bbb', borderRadius: 4, padding: '8px 10px', fontSize: 15, fontFamily: 'inherit' };
const BTAB = (on) => ({ padding: '6px 14px', border: '1px solid ' + (on ? '#1a7f37' : '#bbb'), background: on ? '#1a7f37' : '#fff', color: on ? '#fff' : '#333', borderRadius: 4, cursor: 'pointer', fontSize: 13 });

// Janela "Referência", como a do Kraken.
function Referencia({ e, n, onFechar, onSalvar, onNav }) {
  const [nm, setNm] = useState(e.nm || '');
  const [nb, setNb] = useState(e.nb !== false);
  const [ni, setNi] = useState(!!e.ni);
  const [cu, setCu] = useState(e.cu || 0);
  const [nt, setNt] = useState(String(e.nt || 0));
  const [afer, setAfer] = useState(!!e.afer);
  const [conf, setConf] = useState(null);
  const ehP = e.t === 'P';
  const sujo = nm !== (e.nm || '') || nb !== (e.nb !== false) || ni !== !!e.ni || cu !== (e.cu || 0) || afer !== !!e.afer || (ehP && Number(nt || 0) !== (e.nt || 0));
  const salvar = () => onSalvar({ key: chave(e), n: e.n, nt: ehP ? Number(nt) || 0 : null, patch: { nm: nm.trim() || undefined, nb: nb ? undefined : false, ni: ni || undefined, cu: cu || undefined, afer } });
  const tentar = (acao) => { if (sujo) setConf(acao); else acao(); };
  const ref = useRef({});
  ref.current = { tentar, salvar, onFechar };
  useEffect(() => {
    const k = (ev) => {
      if (ev.key === 'Escape') ref.current.tentar(ref.current.onFechar);
      else if (ev.key === 'Enter' && ev.target.tagName !== 'TEXTAREA') { ref.current.salvar(); ref.current.onFechar(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const v = e.nx && Array.isArray(e.nx.v) ? e.nx.v : null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', color: '#111', borderRadius: 8, width: 760, maxWidth: '96vw', maxHeight: '96vh', overflow: 'auto', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid #ddd' }}>
          <span style={{ fontSize: 20, fontWeight: 600 }}>Referência {n}</span>
          <span style={{ background: '#2ecc71', color: '#fff', fontSize: 12, borderRadius: 10, padding: '2px 10px' }}>{TIPO[e.t] || e.t}</span>
          <span style={{ flex: 1 }} />
          <span style={{ cursor: 'pointer', fontSize: 22 }} title="Anterior" onClick={() => tentar(() => onNav(-1))}>‹</span>
          <span style={{ cursor: 'pointer', fontSize: 22 }} title="Próxima" onClick={() => tentar(() => onNav(1))}>›</span>
          <span style={{ cursor: 'pointer', fontSize: 20, marginLeft: 8 }} onClick={() => tentar(onFechar)}>✕</span>
        </div>
        <div style={{ display: 'flex', gap: 18, padding: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><Campo rot="Km da referência"><div style={{ ...INP, background: '#eaf6ff', fontWeight: 700, borderColor: '#2fb6d3' }}>{km3(e.dz ?? e.d)}</div></Campo></div>
              <div style={{ flex: 1 }}><Campo rot="Km atual"><div style={{ ...INP, background: '#f3f3f3', color: '#888' }}>{km3(e.d)}</div></Campo></div>
            </div>
            <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Trecho</div>
            <div style={{ border: '1px solid #ddd', background: '#fafafa', borderRadius: 4, padding: '8px 10px', fontSize: 13, color: '#555', marginBottom: 12 }}>
              {e.tl ? <b>{e.tl}</b> : null}{v ? ` · ${(grupoNomes(e, v))}` : ' · sem mudança de trecho nesta referência'}
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Para criar um trecho novo aqui, feche a janela e use o botão TRC.</div>
            </div>
            {ehP && <Campo rot="Neutro: segundos parado neste ponto (0 = sem)"><input style={INP} inputMode="numeric" value={nt} onChange={(ev) => setNt(ev.target.value.replace(/[^0-9]/g, ''))} /></Campo>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#666', fontSize: 12, marginBottom: 3 }}>
              <span style={{ flex: 1 }}>Observações</span>
              <label style={{ cursor: 'pointer' }}><input type="checkbox" checked={nb} onChange={(ev) => setNb(ev.target.checked)} /> Negrito</label>
              <label style={{ cursor: 'pointer' }}><input type="checkbox" checked={ni} onChange={(ev) => setNi(ev.target.checked)} /> Invertido</label>
            </div>
            <textarea style={{ ...INP, height: 64, resize: 'none', textTransform: 'uppercase' }} maxLength={60} value={nm} onChange={(ev) => setNm(ev.target.value)} placeholder="EX.: VIRE P/ DIR" autoFocus />
            <div style={{ fontSize: 11, color: '#999', textAlign: 'right' }}>{nm.length}/60 · Enter na caixa = nova linha</div>
          </div>
          <div style={{ width: 210, flexShrink: 0 }}>
            <button style={{ ...INP, background: '#1565c0', color: '#fff', border: 0, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }} onClick={() => { salvar(); onFechar(); }}>SALVAR <span style={{ fontWeight: 400, fontSize: 11 }}>Enter</span></button>
            <button style={{ ...INP, background: '#fff', color: '#1565c0', fontWeight: 700, cursor: 'pointer', marginBottom: 14 }} onClick={() => tentar(onFechar)}>CANCELAR <span style={{ fontWeight: 400, fontSize: 11 }}>Esc</span></button>
            <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}><input type="checkbox" checked={afer} onChange={(ev) => setAfer(ev.target.checked)} />Afer</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#aaa' }} title="Use a opção do trecho no levantamento"><input type="checkbox" disabled checked={!!e.zero} />Zera km (0.000)</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#aaa' }}><input type="checkbox" disabled />Nova prova</label>
              <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Curvas</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3].map((k) => (
                  <span key={k} onClick={() => setCu(k)} style={{ width: 36, height: 30, border: '1px solid ' + (cu === k ? '#1565c0' : '#ccc'), background: cu === k ? '#e3f0ff' : '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: k > 1 ? 11 : 15 }}>{k === 0 ? '⊘' : '☠'.repeat(k)}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {conf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 20, width: 320, color: '#111', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Salvar alterações?</div>
            <div style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>Há alterações não salvas nesta referência.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, fontWeight: 700, fontSize: 14 }}>
              <span style={{ color: '#1565c0', cursor: 'pointer' }} onClick={() => setConf(null)}>CANCELAR</span>
              <span style={{ color: '#e53935', cursor: 'pointer' }} onClick={() => { const a = conf; setConf(null); a(); }}>DESCARTAR</span>
              <span style={{ color: '#1565c0', cursor: 'pointer' }} onClick={() => { const a = conf; setConf(null); salvar(); a(); }}>SALVAR</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const grupoNomes = (e, v) => v.map((x, i) => `${String.fromCharCode(65 + i)} ${x}`).join(' · ') + ' km/h';

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

  const numT = (() => { let c = 0; return lista.map((e) => (e.t === 'T' && !e.cont ? ++c : 0)); })();
  const nTul = lista.filter((e) => e.t === 'T' && !e.cont).length;
  const nPc = lista.filter((e) => e.t === 'P' && !e.cont && !(e.nt > 0 && e.pn == null)).length;
  const selecionada = sel >= 0 ? lista[sel] : null;
  const abrirRef = (i) => { const e = lista[i]; if (!e || e.cont) return avisar('Esta é a continuação do neutro: edite a linha do neutro.'); setDlg(i); };

  const navRef = (d) => { let j = dlg + d; while (j >= 0 && j < lista.length && lista[j].cont) j += d; if (j >= 0 && j < lista.length) { setDlg(j); escolher(j, true, true); } };
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
        <div ref={esq} style={{ width: `${frac * 100}%`, overflowY: 'auto', overflowX: 'auto', position: 'relative', minWidth: 0, background: '#fff' }}>
          {lista.length === 0 && <div style={{ color: '#a8a8a8', padding: 16, fontSize: 15 }}>Toque em PC (embaixo do mapa) e clique no mapa para marcar a largada, os PCs e a chegada. O roadbook aparece aqui.</div>}
          {lista.map((e, i) => (
            <Linha key={i} e={e} num={numT[i]} sel={i === sel} grupos={grupos} refEl={(el) => { linhas.current[i] = el; }}
              onSel={() => escolher(i, false, true)}
              onKm={() => { escolher(i, false, true); abrirRef(i); }}
              onTul={() => { escolher(i, false, true); avisar('O editor de tulipa (Desenho, Tulipas e Imagens) chega no próximo passo.'); }} />
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
      {dlg >= 0 && lista[dlg] && <Referencia key={dlg} e={lista[dlg]} n={dlg + 1} onFechar={() => setDlg(-1)} onSalvar={onSalvarRef} onNav={navRef} />}
    </div>
  );
}
