// Editor de planilha no navegador do computador, em tela cheia e travado (só o roadbook rola), no estilo do Kraken:
// roadbook à esquerda, mapa à direita, divisória que se arrasta, botões REF/TRC/PC/REG embaixo do mapa.
import { useEffect, useMemo, useRef, useState } from 'react';
import MapaWeb from './MapaWeb';
import { Tulipa } from './Tulipa';
import EditorDesenho from './EditorDesenho';
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
const FONTE = 'Montserrat, Arial, sans-serif';
const TIPO = { L: 'Largada', T: 'Tulipa', P: 'PC', C: 'Chegada' };
const km3 = (m) => (m / 1000).toFixed(3);
const hms = (sec) => { const x = Math.max(0, sec); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), r = x - h * 3600 - m * 60; return `${h}:${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`; };
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const CREME = '#f6f2e8', BORDA = '1px solid #000', CIANO = '#19e8f0';
const GAL = 34;

const linhasObs = (e) => (e.ob && e.ob.length ? e.ob.filter((o) => o.t) : e.nm ? String(e.nm).split('\n').map((t) => ({ t, n: true })) : []);

// Linha do roadbook no padrão do Kraken: km | velocidade (verde) | tempos | tulipa | instrução.
function Linha({ e, num, atual, sel, grupos, onKm, onTul, onSel, refEl }) {
  const nTm = Math.max(1, e.tm ? e.tm.length : (grupos || []).length);
  const alt = Math.max(nTm * GAL, 96);
  const ehPc = e.t === 'P' && !(e.nt > 0 && e.pn == null) && !e.cont;
  const ehN = e.t === 'P' && e.nt > 0 && !e.cont;
  const temTul = e.t === 'T' || !!(e.dw && e.dw.length) || (ehN && !!((e.dw && e.dw.length) || Array.isArray(e.b)));
  const obs = linhasObs(e);
  const bg = atual ? '#ffee00' : sel ? CIANO : ehN ? '#e1bee7' : obs.length ? '#aadaff' : CREME;
  const brd = e.t === 'P' && !e.cont ? '3px solid #e53935' : BORDA;
  const v = e.nx && Array.isArray(e.nx.v) ? e.nx.v : null;
  const txtN = e.t === 'L' ? 'LARGADA' : e.t === 'C' ? 'CHEGADA' : null;
  const celula = { borderRight: BORDA, boxSizing: 'border-box', height: '100%' };
  return (
    <div ref={refEl} onClick={onSel} style={{ display: 'flex', height: alt, background: bg, borderTop: brd, borderBottom: brd, color: '#111', cursor: 'pointer', fontFamily: FONTE }}>
      <div title="Editar referência" onClick={(ev) => { ev.stopPropagation(); onKm(); }} style={{ ...celula, width: 104, padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', minHeight: 14 }}>
          <span>{e.t === 'T' ? (e.p / 1000).toFixed(2) : ''}</span><span>{e.tl ? e.tl.replace(' ', '') : ''}</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{km3(e.dz ?? e.d)}</div>
        {e.zero ? <div style={{ background: '#111', color: '#ffe600', fontSize: 11, fontWeight: 800, padding: '1px 4px', marginTop: 2, alignSelf: 'flex-start' }}>0.000 · ZERE</div> : null}
        {e.afer || e.zk ? <div style={{ background: '#111', color: '#fff', fontSize: 11, fontWeight: 800, padding: '1px 5px', marginTop: 2, alignSelf: 'flex-start' }}>AFER</div> : null}
        {e.np ? <div style={{ background: '#111', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 5px', marginTop: 2, alignSelf: 'flex-start' }}>NOVA PROVA</div> : null}
      </div>
      <div style={{ ...celula, width: 100, display: 'flex' }}>
        {ehPc ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, lineHeight: 1.1, background: atual ? '#ffee00' : '#fff' }}><span>PC</span><span>{e.pn ?? e.n}</span></div>
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
      <div style={{ ...celula, width: 104, display: 'flex', flexDirection: 'column', background: atual ? '#ffee00' : sel ? CIANO : '#fff' }}>
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
        {obs.map((o, i) => <div key={i} style={{ fontWeight: o.n === false ? 500 : 800, fontSize: 15, ...(o.i ? { background: '#111', color: '#fff', padding: '1px 8px', width: '100%', boxSizing: 'border-box' } : null) }}>{o.t}</div>)}
        {e.cu > 0 ? <div style={{ fontSize: 22, marginTop: 4 }}>{'☠'.repeat(e.cu)}</div> : null}
        {ehPc && !obs.length ? <div style={{ fontSize: 13, color: '#555' }}>Raio: 15 m</div> : null}
      </div>
    </div>
  );
}

const INP = { width: '100%', boxSizing: 'border-box', border: '1px solid #bbb', borderRadius: 4, padding: '8px 10px', fontSize: 15, fontFamily: 'inherit', background: '#fff' };
const ROT = { color: '#777', fontSize: 11, marginBottom: 3 };
const abaTr = (on) => ({ padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4, border: '1px solid ' + (on ? '#1a9d5a' : '#ccc'), background: on ? '#1a9d5a' : '#fff', color: on ? '#fff' : '#333' });
const BT = (bg, cor, extra) => ({ width: '100%', boxSizing: 'border-box', border: bg === '#fff' ? '1px solid #bbb' : 0, background: bg, color: cor, fontWeight: 700, fontSize: 13, padding: '10px 6px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, ...extra });

// Janela "Referência", como a do Kraken.
function Referencia({ e, n, grupos, bi, manual, tr, atualKm, onFechar, onSalvar, onNav, onNovoTrecho, onSalvarTr, onLimparTr, onExcluir, onEstouAqui, onMostrar, onAddPc }) {
  const ng = Math.max(1, grupos.length);
  const novo = !!e.novo;
  const [km, setKm] = useState(km3(novo ? Math.round(atualKm * 1000) : e.d));
  const [shift, setShift] = useState(false);
  const [obs, setObs] = useState(() => { const a = linhasObs(e); return Array.from({ length: 4 }, (_, k) => a[k] ? { t: a[k].t, n: a[k].n !== false, i: !!a[k].i } : { t: '', n: true, i: false }); });
  const [cu, setCu] = useState(e.cu || 0);
  const [nt, setNt] = useState(String(e.nt || 0));
  const [afer, setAfer] = useState(!!e.afer);
  const [zk, setZk] = useState(!!e.zk);
  const [np, setNp] = useState(!!e.np);
  const [nr, setNr] = useState(e.nr || '');
  const [tipoT, setTipoT] = useState(tr ? tr.t : 'V');
  const [vals, setVals] = useState(() => Array.from({ length: ng }, (_, g) => String(tr && tr.v ? tr.v[g] ?? tr.v[0] ?? '' : '')));
  const [minT, setMinT] = useState(tr ? String(tr.min || 15) : '15');
  const [fx, setFx] = useState(!!(tr && tr.fx));
  const [tocouTr, setTocouTr] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [conf, setConf] = useState(null);
  const trK = tr ? tr.d0 : null;
  useEffect(() => {
    if (!tr) return;
    setTipoT(tr.t); setVals(Array.from({ length: ng }, (_, g) => String(tr.v ? tr.v[g] ?? tr.v[0] ?? '' : ''))); setMinT(String(tr.min || 15)); setFx(!!tr.fx); setTocouTr(false);
  }, [trK]);
  const ehP = e.t === 'P' && !e.cont;
  const ehT = e.t === 'T';
  const [aba, setAba] = useState(ehP && e.nt > 0 ? 'N' : null);
  const tab = aba || tipoT;
  const m = (fn) => (...a) => { setSujo(true); fn(...a); };
  const parseKm = () => { const x = parseFloat(String(km).replace(',', '.')); return Number.isNaN(x) ? null : Math.round(x * 1000); };

  const salvar = () => {
    const linhas = obs.map((o) => ({ t: o.t.trim(), n: o.n, i: o.i }));
    const txt = linhas.filter((o) => o.t);
    const dNovo = ehT || novo ? parseKm() : null;
    const patch = {
      nm: txt.map((o) => o.t).join('\n') || undefined, ob: txt.length ? linhas : undefined,
      cu: cu || undefined, afer: afer || undefined, np: np || undefined, nr: nr.trim() || undefined, zk: zk || undefined,
      d: dNovo != null && (novo || Math.abs(dNovo - e.d) >= 1) ? dNovo : undefined,
    };
    onSalvar({ e, patch, nt: ehP ? Number(nt) || 0 : null, shift: shift && patch.d != null });
    if (tr && tocouTr && tab !== 'N') onSalvarTr(tr.d0, { t: tipoT === 'D' ? 'D' : 'V', v: vals, bs: vals[bi] || vals[0], min: minT, fx });
  };
  const ref = useRef({});
  ref.current = { salvar, onFechar, sujo, setConf };
  useEffect(() => {
    const k = (ev) => {
      const r = ref.current;
      if (ev.key === 'Escape') { if (r.sujo) r.setConf(() => r.onFechar); else r.onFechar(); }
      else if (ev.key === 'Enter' && ev.target.tagName !== 'TEXTAREA') { r.salvar(); r.onFechar(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const tentar = (acao) => { if (sujo) setConf(() => acao); else acao(); };
  const nomeG = (g) => (grupos[g] && grupos[g].nome ? String(grupos[g].nome).slice(0, 8) : String.fromCharCode(65 + g));
  const cx = (rot, val, on, dis, note) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, color: dis ? '#aaa' : '#222', fontSize: 13, cursor: dis ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={val} disabled={dis} onChange={(ev) => on(ev.target.checked)} style={{ marginTop: 2 }} />
      <span>{rot}{note ? <div style={{ fontSize: 10, color: '#999' }}>{note}</div> : null}</span>
    </label>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', color: '#111', borderRadius: 6, width: 920, maxWidth: '97vw', maxHeight: '97vh', overflow: 'auto', fontFamily: FONTE }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid #e3e3e3' }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{novo ? 'Nova referência' : `Referência ${n}`}</span>
          {!novo && e.nx ? <span style={{ background: '#2ecc71', color: '#fff', fontSize: 11, borderRadius: 10, padding: '2px 10px' }}>{e.nx.t === 'D' ? 'Deslocamento' : 'Velocidade'}</span> : null}
          <span style={{ flex: 1 }} />
          {!novo && <><span style={{ cursor: 'pointer', fontSize: 22 }} title="Anterior" onClick={() => tentar(() => onNav(-1))}>‹</span>
          <span style={{ cursor: 'pointer', fontSize: 22 }} title="Próxima" onClick={() => tentar(() => onNav(1))}>›</span></>}
          <span style={{ cursor: 'pointer', fontSize: 20, marginLeft: 8 }} onClick={() => tentar(onFechar)}>✕</span>
        </div>
        <div style={{ display: 'flex', gap: 18, padding: '14px 18px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={ROT}>Km da referência</div>
                <input style={{ ...INP, border: '1px solid #2fb6d3', fontWeight: 700, background: ehT || novo ? '#fff' : '#f3f3f3' }} value={km} disabled={!(ehT || novo)} onChange={m((ev) => setKm(ev.target.value))} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={ROT}>Km atual</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ ...INP, background: '#eef3f6', color: '#555' }}>{atualKm.toFixed(3)}</div>
                  <button style={{ ...BT(AZUL, '#fff'), width: 100, marginBottom: 0, fontSize: 11 }} disabled={!(ehT || novo)} onClick={() => { setSujo(true); setKm(atualKm.toFixed(3)); }}>USAR ATUAL</button>
                </div>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px', fontSize: 12, color: ehT || novo ? '#444' : '#aaa' }}><input type="checkbox" disabled={!(ehT || novo)} checked={shift} onChange={(ev) => setShift(ev.target.checked)} />Recalcular referências seguintes</label>
            {!novo && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#555', flex: 1 }}>{tr ? `Trecho ${(tr.d0 === 0 ? 1 : '')}`.trim() : 'Trecho'}</span>
                  {tr && tr.d0 > 0 && <span style={{ color: '#e53935', fontSize: 11, cursor: 'pointer' }} onClick={() => { const r = onLimparTr(tr.d0); if (r) window.alert(r); }}>Limpar trecho</span>}
                </div>
                {tr ? (
                  <div style={{ border: '1px solid #e3e3e3', borderRadius: 4, padding: 10 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <span style={abaTr(tab === 'V')} onClick={() => { setAba(null); setSujo(true); setTocouTr(true); setTipoT('V'); }}>Velocidade</span>
                      <span style={abaTr(tab === 'D')} onClick={() => { setAba(null); setSujo(true); setTocouTr(true); setTipoT('D'); }}>Deslocamento</span>
                      <span style={{ ...abaTr(tab === 'N'), opacity: ehP ? 1 : 0.4 }} onClick={() => { if (ehP) setAba('N'); }}>Neutro</span>
                    </div>
                    {tab === 'V' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#666' }}>km/h</span>
                        {vals.map((x, g) => (
                          <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>{nomeG(g)}<input style={{ ...INP, width: 64, padding: '6px 8px' }} inputMode="decimal" value={x} onChange={(ev) => { setSujo(true); setTocouTr(true); setVals((o) => o.map((y, i) => (i === g ? ev.target.value.replace(',', '.') : y))); }} /></label>
                        ))}
                      </div>
                    )}
                    {tab === 'D' && <label style={{ fontSize: 12 }}>Tempo (min) <input style={{ ...INP, width: 80, padding: '6px 8px' }} inputMode="decimal" value={minT} onChange={(ev) => { setSujo(true); setTocouTr(true); setMinT(ev.target.value.replace(',', '.')); }} /></label>}
                    {tab === 'N' && <label style={{ fontSize: 12 }}>Segundos parado neste PC <input style={{ ...INP, width: 80, padding: '6px 8px' }} inputMode="numeric" value={nt} onChange={m((ev) => setNt(ev.target.value.replace(/[^0-9]/g, '')))} /></label>}
                    {tab === 'V' && <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#666', marginTop: 10 }}><input type="checkbox" checked={fx} onChange={(ev) => { setSujo(true); setTocouTr(true); setFx(ev.target.checked); }} /><span>Fixar média<div style={{ fontSize: 10, color: '#999' }}>Não é alterada por "Alterar médias"</div></span></label>}
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e3e3e3', borderRadius: 4, padding: '10px 12px', fontSize: 12, color: '#777', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ flex: 1 }}>Sem trecho nesta referência</span>
                    <span style={{ color: AZUL, fontWeight: 700, cursor: 'pointer' }} onClick={() => { const r = onNovoTrecho(e.d); if (r && r !== 'Cancelado.') window.alert(r); }}>+ Adicionar trecho</span>
                  </div>
                )}
                {ehP && !tr && (
                  <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Neutro: segundos parado neste PC (0 = sem) <input style={{ ...INP, width: 90, padding: '6px 8px', marginLeft: 6 }} inputMode="numeric" value={nt} onChange={m((ev) => setNt(ev.target.value.replace(/[^0-9]/g, '')))} /></label>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: '#777', marginBottom: 4 }}>
              <span style={{ flex: 1 }}>Observações</span><span style={{ width: 150, textAlign: 'center' }}>Ctrl+N Negrito · Ctrl+I Invertido</span>
            </div>
            {obs.map((o, k) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input style={{ ...INP, flex: 1, fontWeight: o.n ? 700 : 400, textTransform: 'uppercase', ...(o.i ? { background: '#111', color: '#fff' } : null) }} maxLength={25} value={o.t} autoFocus={k === 0}
                  onKeyDown={(ev) => { if (ev.ctrlKey && (ev.key === 'n' || ev.key === 'N')) { ev.preventDefault(); setSujo(true); setObs((a) => a.map((x, i) => (i === k ? { ...x, n: !x.n } : x))); } else if (ev.ctrlKey && (ev.key === 'i' || ev.key === 'I')) { ev.preventDefault(); setSujo(true); setObs((a) => a.map((x, i) => (i === k ? { ...x, i: !x.i } : x))); } }}
                  onChange={(ev) => { setSujo(true); setObs((a) => a.map((x, i) => (i === k ? { ...x, t: ev.target.value } : x))); }} />
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}><input type="checkbox" checked={o.n} onChange={(ev) => { setSujo(true); setObs((a) => a.map((x, i) => (i === k ? { ...x, n: ev.target.checked } : x))); }} />N</label>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}><input type="checkbox" checked={o.i} onChange={(ev) => { setSujo(true); setObs((a) => a.map((x, i) => (i === k ? { ...x, i: ev.target.checked } : x))); }} />Inv</label>
              </div>
            ))}
            <div style={{ fontSize: 10, color: '#aaa', textAlign: 'right' }}>até 25 caracteres por linha</div>
          </div>
          <div style={{ width: 250, flexShrink: 0 }}>
            <button style={BT('#2aa6b8', '#fff')} onClick={() => { salvar(); onFechar(); }}>SALVAR <span style={{ fontWeight: 400, fontSize: 10 }}>Enter</span></button>
            <button style={BT('#fff', '#2aa6b8', { marginBottom: 12 })} onClick={() => tentar(onFechar)}>CANCELAR <span style={{ fontWeight: 400, fontSize: 10 }}>Esc</span></button>
            <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Aplicar na hora</div>
            <button style={BT(AZUL, '#fff', { opacity: novo ? 0.4 : 1 })} disabled={novo} onClick={() => { onEstouAqui(); onFechar(); }}>◉ ESTOU AQUI</button>
            <button style={BT('#fff', '#2aa6b8', { opacity: novo ? 0.4 : 1 })} disabled={novo} onClick={() => { onMostrar(); onFechar(); }}>MOSTRAR NO MAPA</button>
            <button style={BT('#1fb35e', '#fff', { opacity: novo || manual ? 0.4 : 1 })} disabled={novo || manual} title={manual ? 'Percurso congelado' : ''} onClick={() => { onAddPc(); onFechar(); }}>+ ADD PC NA REFERÊNCIA</button>
            <div style={{ border: '1px solid #e3e3e3', borderRadius: 4, padding: 10, margin: '6px 0 10px' }}>
              {cx('Afer', afer || zk, m(setAfer), zk, zk ? 'Ligado pelo zera km' : null)}
              {cx('Zera km (0.000)', zk, m((v) => { setZk(v); }), !(ehT || novo))}
              {cx('Nova prova', np, m(setNp), false)}
              <div style={{ fontSize: 11, color: '#777', margin: '6px 0 4px' }}>Curvas</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3].map((k) => (
                  <span key={k} onClick={() => { setSujo(true); setCu(k); }} style={{ width: 40, height: 30, border: '1px solid ' + (cu === k ? '#2aa6b8' : '#ccc'), background: cu === k ? '#e3f6f9' : '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: k > 1 ? 10 : 14 }}>{k === 0 ? '⊘' : '☠'.repeat(k)}</span>
                ))}
              </div>
            </div>
            <div style={ROT}>Nome da referência</div>
            <input style={{ ...INP, marginBottom: 12 }} value={nr} onChange={m((ev) => setNr(ev.target.value))} />
            {!novo && ehT && <button style={BT('#e53935', '#fff')} onClick={() => { if (window.confirm('Deletar esta referência?')) { onExcluir(); onFechar(); } }}>🗑 DELETAR REFERÊNCIA</button>}
          </div>
        </div>
      </div>
      {conf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 6, padding: 20, width: 340, color: '#111', fontFamily: FONTE }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Salvar alterações?</div>
            <div style={{ color: '#777', fontSize: 13, marginBottom: 16 }}>Há alterações não salvas nesta referência.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, fontWeight: 700, fontSize: 13 }}>
              <span style={{ color: '#2aa6b8', cursor: 'pointer' }} onClick={() => setConf(null)}>CANCELAR</span>
              <span style={{ color: '#e53935', cursor: 'pointer' }} onClick={() => { const a = conf; setConf(null); a(); }}>DESCARTAR</span>
              <span style={{ color: '#2aa6b8', cursor: 'pointer' }} onClick={() => { const a = conf; setConf(null); salvar(); a(); }}>SALVAR</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditorDividido({ st, nome, tul, coords, wps, totalM, grupos, bi, trs, manual, editable, busy, onTap, onDesfazer, onLimpar, onNovoTrecho, onSalvarRef, onSalvarDw, onExcluirRef, onSalvarTr, onLimparTr, onAddPc, onAuto, trAqui, onPublicar, onSimular, onPdf, onAtualizar, onLista, onVoltar }) {
  const [frac, setFrac] = useState(0.5);
  const [sel, setSel] = useState(-1);
  const [tulEd, setTulEd] = useState(null);
  const [atual, setAtual] = useState(-1);
  const [focI, setFocI] = useState(-1);
  const [focn, setFocn] = useState(0);
  const [modoPc, setModoPc] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dlg, setDlg] = useState(-1);
  const [novoD, setNovoD] = useState(null);
  const [aviso, setAviso] = useState('');
  const [eu, setEu] = useState(null);
  const [ctr, setCtr] = useState(0);
  const [gps, setGps] = useState(null);
  const cont = useRef(null);
  const esq = useRef(null);
  const linhas = useRef({});
  const arrasta = useRef(false);

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
    const cls = i === focI ? 'r' : e.t === 'L' ? 'l' : e.t === 'C' ? 'c' : e.t === 'P' ? 's' : 'k';
    return { id: i, lat: pos[i][0], lon: pos[i][1], txt: e.t === 'P' ? 'PC' + (e.pn ?? e.n) : String(i + 1), cls };
  }).filter(Boolean), [sig, pos, focI]);
  const foc = focI >= 0 && pos[focI] ? pos[focI] : null;

  const avisar = (m) => { setAviso(m); setTimeout(() => setAviso(''), 5000); };
  const rolarPara = (i) => {
    const el = linhas.current[i], box = esq.current;
    if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  };
  useEffect(() => { if (sel >= lista.length) setSel(-1); if (atual >= lista.length) setAtual(-1); if (focI >= lista.length) setFocI(-1); }, [lista.length]);

  const mover = (ev) => {
    if (!arrasta.current || !cont.current) return;
    const r = cont.current.getBoundingClientRect();
    setFrac(Math.max(0.12, Math.min(0.88, (ev.clientX - r.left) / r.width)));
  };
  const localizar = () => {
    if (!navigator.geolocation) return avisar('Este navegador não tem localização.');
    navigator.geolocation.getCurrentPosition(
      (p) => { setEu([p.coords.latitude, p.coords.longitude]); setCtr((c) => c + 1); setGps({ acc: p.coords.accuracy, spd: p.coords.speed }); },
      (er) => avisar('Não consegui a localização do computador (' + (er && er.message ? er.message : 'sem permissão') + ').'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  // O número da tulipa é o mesmo do marcador no mapa (a Largada é a nº 1).
  const numT = lista.map((e, i) => ((e.t === 'T' || e.t === 'L') && !e.cont ? i + 1 : 0));
  const abrirRef = (i) => { const e = lista[i]; if (!e || e.cont) return avisar('Esta é a continuação do neutro: edite a linha do neutro.'); setNovoD(null); setDlg(i); };
  const navRef = (d) => { let j = dlg + d; while (j >= 0 && j < lista.length && lista[j].cont) j += d; if (j >= 0 && j < lista.length) { setDlg(j); setSel(j); setFocI(j); setFocn((n) => n + 1); rolarPara(j); } };
  const atualKm = atual >= 0 && lista[atual] ? (lista[atual].dz ?? lista[atual].d) / 1000 : 0;
  const dE = dlg >= 0 ? lista[dlg] : null;
  const kmTotal = (totalM / 1000).toFixed(3);

  const BTN = (cor, txt, on, extra) => (
    <button onClick={on} style={{ border: 0, background: cor, fontWeight: 700, fontSize: 18, cursor: 'pointer', color: '#111', fontFamily: FONTE, ...extra }}>{txt}</button>
  );
  const item = (txt, fn) => <div style={{ padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => { setMenu(false); fn(); }}>{txt}</div>;
  const cel = (v, r) => <div style={{ textAlign: 'center', borderRight: '1px solid #666' }}><div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>{v}</div><div style={{ fontSize: 11, color: '#ccc' }}>{r}</div></div>;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', background: '#12161b', fontFamily: FONTE }}>
      <div style={{ height: 56, background: AZUL, color: '#fff', display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', flexShrink: 0 }}>
        <span style={{ fontSize: 24, cursor: 'pointer' }} title="Voltar" onClick={onVoltar}>←</span>
        <span style={{ fontSize: 19, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}</span>
        <span style={{ fontSize: 13 }}>{aviso || busy || ''}</span>
        <span title="Planilha na nuvem" style={{ fontSize: 18 }}>☁✓</span>
        <div style={{ position: 'relative' }}>
          <span style={{ fontSize: 24, cursor: 'pointer', padding: '0 6px' }} onClick={() => setMenu((x) => !x)}>⋮</span>
          {menu && (
            <div style={{ position: 'absolute', right: 0, top: 36, background: '#fff', color: '#111', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.35)', zIndex: 70, fontSize: 14 }}>
              {item('Publicar prova para os celulares', onPublicar)}
              {item('Simular a prova', onSimular)}
              {item('Gerar PDF do roadbook', onPdf)}
              {item('Buscar atualização da nuvem', onAtualizar)}
              {item('Desfazer último PC', onDesfazer)}
              {item('Limpar tudo', onLimpar)}
              {manual ? item('Voltar ao percurso automático', onAuto) : null}
              {item('Tela antiga (lista de trechos)', onLista)}
            </div>
          )}
        </div>
      </div>
      <div style={{ background: '#2b2b2b', color: '#fff', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '4px 0', flexShrink: 0 }}>
        {cel(atualKm.toFixed(3), 'Odômetro (GPS)')}{cel(kmTotal, 'Odôm. total')}{cel(gps && gps.spd != null ? Math.round(gps.spd * 3.6) : '-', 'Velocidade')}{cel(gps ? '±' + Math.round(gps.acc) + ' m' : '-', 'GPS')}
      </div>
      <div ref={cont} style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div ref={esq} style={{ width: `${frac * 100}%`, overflowY: 'auto', overflowX: 'auto', position: 'relative', minWidth: 0, background: '#fff' }}>
          {lista.length === 0 && <div style={{ color: '#666', padding: 16, fontSize: 15 }}>Toque em PC (embaixo do mapa) e clique no mapa para marcar a largada, os PCs e a chegada. O roadbook aparece aqui.</div>}
          {lista.map((e, i) => (
            <Linha key={i} e={e} num={numT[i]} atual={i === atual} sel={i === sel} grupos={grupos} refEl={(el) => { linhas.current[i] = el; }}
              onSel={() => { setAtual(i); setFocI(i); setFocn((n) => n + 1); }}
              onKm={() => { setSel(i); setFocI(i); setFocn((n) => n + 1); abrirRef(i); }}
              onTul={() => { setSel(i); setTulEd(lista[i]); }} />
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
              <MapaWeb wps={wps} coords={coords} marks={marks} sat editable={editable && modoPc} onTap={onTap} onMark={(id) => { setSel(id); setFocI(id); rolarPara(id); }} foc={foc} focn={focn} me={eu} ctr={ctr} height="100%" mb={0} />
            </div>
            <div title="Localizar (precisa do GPS do computador)" onClick={localizar} style={{ position: 'absolute', right: 10, top: 110, width: 40, height: 40, borderRadius: 20, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 800, boxShadow: '0 1px 4px rgba(0,0,0,.4)', fontSize: 22 }}>◎</div>
            {modoPc && <div style={{ position: 'absolute', left: 50, top: 10, background: '#ef5350', color: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 14, zIndex: 800 }}>Marcando PCs: clique no mapa</div>}
          </div>
          <div style={{ height: 56, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', flexShrink: 0 }}>
            {BTN('#ffee00', 'REF', () => { if (!totalM) return avisar('Marque o percurso primeiro (botão PC e cliques no mapa).'); setNovoD(Math.round(atualKm * 1000)); setDlg(-1); })}
            {BTN('#00d56b', 'TRC', () => {
              const i = atual >= 0 ? atual : sel;
              if (i < 0 || !lista[i]) return avisar('Clique numa linha do roadbook (posição atual) e toque em TRC.');
              const m = onNovoTrecho(lista[i].d);
              if (m) return m === 'Cancelado.' ? null : avisar(m);
              setSel(i); setTimeout(() => abrirRef(i), 60);
            })}
            {BTN('#ef5350', 'PC', () => { if (!editable) return avisar(manual ? 'Percurso congelado: no menu ⋮ use "Voltar ao percurso automático" para marcar PCs.' : 'Não dá para editar o percurso agora.'); setModoPc((x) => !x); }, modoPc ? { outline: '4px solid #fff', outlineOffset: -4 } : null)}
            {BTN('#ff6d00', 'REG', () => avisar('REG ainda não está disponível.'), { opacity: 0.45 })}
          </div>
        </div>
      </div>
      {(dlg >= 0 && dE) || novoD != null ? (
        <Referencia key={novoD != null ? 'novo' : dlg} e={novoD != null ? { t: 'T', d: novoD, novo: true } : dE} n={dlg + 1} grupos={grupos} bi={bi} manual={manual} atualKm={atualKm}
          tr={novoD != null ? null : (trAqui ? trAqui(dE.d) : null)}
          onFechar={() => { setDlg(-1); setNovoD(null); }} onSalvar={onSalvarRef} onNav={navRef}
          onNovoTrecho={onNovoTrecho} onSalvarTr={onSalvarTr} onLimparTr={onLimparTr}
          onExcluir={() => onExcluirRef(dE)}
          onEstouAqui={() => { setAtual(dlg); setFocI(dlg); setFocn((n) => n + 1); }}
          onMostrar={() => { setFocI(dlg); setFocn((n) => n + 1); }}
          onAddPc={() => {
            const idx = lista.slice(0, dlg).filter((x) => (x.t === 'L' || x.t === 'P') && !x.cont).length;
            const p = pos[dlg];
            if (!p) return;
            const r = onAddPc(p[0], p[1], idx);
            if (r) avisar(r);
          }} />
      ) : null}
      {tulEd && <EditorDesenho visible km={(tulEd.d || 0) / 1000} inicial={tulEd.dw || []} onCancel={() => setTulEd(null)} onSave={(it) => { onSalvarDw && onSalvarDw(tulEd, it); setTulEd(null); }} />}
</div>
  );
}
