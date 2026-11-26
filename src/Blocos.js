// Blocos visuais da tela de prova. Usados na prova (dados reais) e no editor de layout (dados de exemplo).
import { useEffect, useRef } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Tulipa, rotuloNx } from './Tulipa';
import { DesenhoSvg } from './Desenho';
import { fmtDur, grupoIdx } from './rally';

const fgDe = (bg) => (['#f5e50f', '#fb8c00', '#ffffff', '#43a047'].includes(bg) ? '#000' : '#fff');
export function fmtDist(m, c) {
  const v = Math.max(0, m);
  if (c.un === 'km') return (v / 1000).toFixed(c.dec).replace('.', ',');
  const r = c.step === 10 ? Math.round(v / 10) * 10 : v;
  return r.toFixed(c.dec).replace('.', ',');
}
// Formatos do Kraken: k3 = 0.001 (1 m com ponto), k2 = 0.01 (10 m com ponto), m1 = 1 m sem ponto, m10 = 10 m sem ponto.
export const FMT_DIST = { k3: { un: 'km', dec: 3 }, k2: { un: 'km', dec: 2 }, m1: { un: 'm', dec: 0 }, m10: { un: 'm', dec: 0, step: 10 } };
export const fmtCodigo = (c) => (c.un === 'km' ? (c.dec >= 3 ? 'k3' : 'k2') : c.step === 10 ? 'm10' : 'm1');
// Odômetro nas linhas do roadbook: "ocultar 3ª casa" corta (não arredonda) para 2 casas.
export function fmtRefKm(m, refs) {
  if (refs && refs.ocultar3) { const v = Math.floor(Math.max(0, m) / 10) / 100; return v.toFixed(2).replace('.', ','); }
  return fmtDist(m, { un: 'km', dec: 3 });
}
export const fmtParcial = (m, refs) => fmtDist(m, FMT_DIST[(refs && refs.fmtP) || 'k3']);

// Convenção do Kraken: valor negativo = adiantado, positivo = atrasado.
// Formatos: 'dec' décimos (10 s = +100), 's' segundos (+10), 'sd' segundos com decimal (+10,0), 'cm' centésimo de minuto (3 s = +5).
export function fmtTnav(sec, dec, fmt) {
  let n; let txt;
  if (fmt === 'dec') { n = Math.round(sec * 10); txt = String(Math.abs(n)); }
  else if (fmt === 's') { n = Math.round(sec); txt = String(Math.abs(n)); }
  else if (fmt === 'cm') { n = Math.round(sec / 0.6); txt = String(Math.abs(n)); }
  else { n = sec; txt = Math.abs(sec).toFixed(dec).replace('.', ','); }
  return (n < 0 ? '−' : '+') + txt;
}
export function faixaDe(sec, cfg) {
  const t = cfg.tn;
  const e = sec <= -t.limAdi ? t.adi : sec >= t.limAtr ? t.atr : t.no;
  return { bg: e.bg, fg: e.fg || fgDe(e.bg) };
}
const p2 = (x) => String(x).padStart(2, '0');
const hms = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };

// Média (ou deslocamento) do trecho que começa nesta linha, para o grupo do competidor.
function velDoTrecho(e, trs, classe, grupos) {
  if (e.cont && e.nx && e.nx.t !== 'D') { const gi0 = classe ? grupoIdx(classe, grupos) : 0; const v0 = Array.isArray(e.nx.v) ? (e.nx.v[gi0] ?? e.nx.v[0]) : e.nx.kg; return v0 ? { a: 'V', b: String(Math.round(v0)), c: 'Km/h' } : null; }
  if (!trs || !trs.length) return null;
  const i = e.t === 'L' ? 0 : e.ptr != null && e.ptr > 0 ? e.ptr : -1;
  const t = i >= 0 ? trs[i] : null;
  if (!t) return null;
  if (t.t === 'D') return { a: 'D', b: `${t.min}'`, c: 'desloc.' };
  const gi = classe ? grupoIdx(classe, grupos) : 0;
  const v = (t.v && (t.v[gi] ?? t.v[0])) || 0;
  return v ? { a: 'V', b: String(Math.round(v)), c: 'Km/h' } : null;
}

export function LinhaRb({ e, pct, atual, w, hh, classe, grupos, trs, refs }) {
  const neuDw = e.t === 'P' && e.nt > 0 && !!((e.dw && e.dw.length) || Array.isArray(e.b));
  const h = hh != null ? Math.max(20, Math.floor(hh)) : Math.round((w * 0.46 * pct) / 100), k = Math.max(0.6, Math.min(1.6, hh != null ? hh / (w * 0.46) : pct / 100));
  const bg = atual ? '#f5e50f' : neuDw ? '#e1bee7' : '#fff';
  const vel = velDoTrecho(e, trs, classe, grupos);
  const lcDw = (e.t === 'L' || e.t === 'C') && !!(e.dw && e.dw.length); // largada/chegada com tulipa desenhada: mostra a tulipa
  if (e.t !== 'T' && !neuDw && !lcDw) {
    const mm = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
    const txt = e.t === 'P' ? (e.nt > 0 ? `NEUTRO · PARE ${mm(e.nt)}` : `PC ${e.pn ?? e.n}`) : e.t === 'L' ? 'LARGADA' : 'CHEGADA';
    const nx = rotuloNx(e.nx, classe, grupos);
    return (
      <View style={{ backgroundColor: e.t === 'C' ? '#c0392b' : e.t === 'P' && e.nt > 0 ? '#6a1b9a' : '#37474f', height: hh != null ? h : undefined, paddingVertical: hh != null ? 0 : 6 * k, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 * k }} numberOfLines={1}>{txt}  {fmtRefKm(e.d, refs)}{vel ? `  ·  ${vel.a} ${vel.b} ${vel.c}` : ''}{e.afer ? '  ·  AFER' : ''}{e.nm ? `  ·  ${e.nm}` : ''}</Text>
        {nx ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 * k }}>{nx.txt}</Text> : null}
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: bg, flexDirection: 'row', height: h, borderBottomWidth: 1, borderBottomColor: '#999' }}>
      <View style={{ flex: 1, paddingHorizontal: 4, paddingVertical: 2 }}>
        {lcDw ? <Text style={{ color: '#fff', backgroundColor: e.t === 'C' ? '#c0392b' : '#37474f', fontSize: 13 * k, fontWeight: '900', paddingHorizontal: 6, alignSelf: 'flex-start', borderRadius: 4 }}>{e.t === 'C' ? 'CHEGADA' : 'LARGADA'}</Text> : null}
        {refs && refs.parcial === false ? null : <Text style={{ color: '#000', fontSize: 12 * k, textAlign: 'right' }}>{fmtParcial(e.p, refs)}</Text>}
        <Text style={{ color: '#000', fontSize: 26 * k, fontWeight: '800' }}>{fmtRefKm(e.d, refs)}</Text>
        {e.afer ? <Text style={{ color: '#fff', backgroundColor: '#000', fontSize: 16 * k, fontWeight: '900', fontStyle: 'italic', paddingHorizontal: 8, alignSelf: 'flex-start' }}>AFER</Text> : null}
        {neuDw ? <Text style={{ color: '#fff', backgroundColor: '#6a1b9a', fontSize: 15 * k, fontWeight: '900', paddingHorizontal: 8, alignSelf: 'flex-start', borderRadius: 4 }}>N · {e.nt < 60 ? Math.round(e.nt) + ' Seg' : Math.floor(e.nt / 60) + ':' + String(Math.round(e.nt % 60)).padStart(2, '0')}</Text> : null}
        {e.nm ? <Text style={{ color: '#000', fontSize: 11 * k }} numberOfLines={2}>{e.nm}</Text> : null}
      </View>
      {vel ? (
        <View style={{ width: Math.min(h * 0.7, w * 0.2), alignSelf: 'center', borderWidth: 3, borderColor: '#000', alignItems: 'center', justifyContent: 'center', paddingVertical: 2, marginRight: 2 }}>
          <Text style={{ color: '#000', fontSize: 15 * k, fontWeight: '900' }}>{vel.a}</Text>
          <Text style={{ color: '#000', fontSize: 24 * k, fontWeight: '900' }}>{vel.b}</Text>
          <Text style={{ color: '#000', fontSize: 11 * k, fontWeight: '900' }}>{vel.c}</Text>
        </View>
      ) : null}
      <View style={{ width: Math.min(h, w * 0.5), height: h, alignItems: 'center', justifyContent: 'center' }}>
        {e.dw && e.dw.length ? <DesenhoSvg items={e.dw} size={Math.min(h, w * 0.5)} /> : <Tulipa e={e} size={Math.min(h, w * 0.5)} />}
        {e.rn != null ? <Text style={{ position: 'absolute', right: 2, bottom: 0, color: '#000', fontSize: 10 * k }}>{e.rn}</Text> : null}
      </View>
    </View>
  );
}

function Placa({ tipo, pl, w, h }) {
  if (!pl) return <Text style={{ color: '#fff', fontSize: 22 }}>—</Text>;
  const s = Math.max(20, Math.min(w - 8, h - 18));
  if (pl.d) return <View style={{ backgroundColor: '#f5e50f', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: '#000', fontSize: s * 0.45, fontWeight: '800' }}>{pl.tx}</Text></View>;
  if (tipo === 'atual') {
    return <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: '#fff', borderWidth: s * 0.1, borderColor: '#2f3df0', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#222', fontSize: s * 0.42, fontWeight: '800' }}>{pl.tx}</Text></View>;
  }
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Polygon points="4,4 96,4 96,66 50,97 4,66" fill="#fff" stroke="#f4511e" strokeWidth="9" />
      </Svg>
      <Text style={{ color: '#222', fontSize: s * 0.38, fontWeight: '800', marginTop: -s * 0.06 }}>{pl.tx}</Text>
    </View>
  );
}


// Botão de correção do odômetro: age no instante em que o dedo encosta (como no roadbook) e repete enquanto segura.
function BtnAj({ tx, bg, w, h, edit, on }) {
  const t1 = useRef(null), t2 = useRef(null), onR = useRef(on);
  onR.current = on;
  const para = () => { clearTimeout(t1.current); clearInterval(t2.current); t1.current = null; t2.current = null; };
  useEffect(() => para, []);
  const ini = () => {
    if (edit) return;
    para();
    onR.current();
    t1.current = setTimeout(() => { t2.current = setInterval(() => onR.current(), 110); }, 450);
  };
  return (
    <Pressable onPressIn={ini} onPressOut={para} disabled={edit} hitSlop={6} android_disableSound style={({ pressed }) => ({ width: w, height: h, backgroundColor: pressed ? '#cfcfcf' : bg, borderRadius: 8, alignItems: 'center', justifyContent: 'center' })}>
      <Text style={{ color: '#000', fontSize: Math.max(12, Math.min(h * 0.5, w * 0.4)), fontWeight: '800' }}>{tx}</Text>
    </Pressable>
  );
}

export function Bloco({ tipo, d, w, h }) {
  const cfg = d.cfg;
  // Barra regressiva: a janela enche da esquerda para a direita a partir de 'ini' metros e fica cheia em zero.
  const barra = (m, k = 'barraRef') => { const b = cfg[k]; return b && b.on && m != null ? Math.min(1, Math.max(0, 1 - m / Math.max(1, b.ini))) : null; };
  const Cx = ({ label, bg = '#000', fg = '#fff', v, children, fill, fillCor }) => {
    const lh = label ? Math.min(12, h * 0.22) : 0;
    const fs = Math.max(10, Math.min((h - lh) * 0.68, w * 0.4, 140));
    return (
      <View style={{ width: w, height: h, backgroundColor: bg, borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {fill != null ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(fill * 100)}%`, backgroundColor: fillCor }} /> : null}
        {label ? <Text style={{ position: 'absolute', top: 1, color: fg, fontSize: lh }} numberOfLines={1}>{label}</Text> : null}
        <View style={{ width: '94%', alignItems: 'center', marginTop: lh }}>
          {v != null ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.3} style={{ color: fg, fontWeight: '800', fontSize: fs, textAlign: 'center' }}>{v}</Text> : children}
        </View>
      </View>
    );
  };
  const Btn = ({ tx, bg, fg = '#000', on }) => (
    <TouchableOpacity activeOpacity={0.7} disabled={d.edit} onPress={on} style={{ width: w, height: h, backgroundColor: bg, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontSize: Math.max(12, Math.min(h * 0.5, w * 0.4)), fontWeight: '800' }}>{tx}</Text>
    </TouchableOpacity>
  );
  switch (tipo) {
    case 'tnav': return <Cx label="T.NAV" bg={d.fx.bg} fg={d.fx.fg} v={Number.isFinite(d.tnav) ? fmtTnav(-d.tnav, cfg.tnavDec, cfg.tn && cfg.tn.fmt) : '—'} />;
    case 'regref': return <Cx label="REG REF" fill={barra(d.regRef)} fillCor={cfg.barraRef.cor} v={Number.isFinite(d.regRef) ? fmtDist(d.regRef, cfg.ref) : '—'} />;
    case 'regref2': return <Cx label="PRÓXIMA REF" fill={barra(d.regRef2)} fillCor={cfg.barraRef.cor} v={Number.isFinite(d.regRef2) ? fmtDist(d.regRef2, cfg.ref) : '—'} />;
    case 'regtrc': return <Cx label="PRÓX. TRECHO" fill={barra(d.regTrc, 'barraTrc')} fillCor={cfg.barraTrc.cor} v={Number.isFinite(d.regTrc) ? fmtDist(d.regTrc, cfg.trc) : '—'} />;
    case 'vel': return <Cx label="VELOCIDADE (GPS)" v={Number.isFinite(d.spd) ? Math.round(d.spd * 3.6) : '—'} />;
    case 'odo': return <Cx label="ODÔMETRO (GPS)" bg={(d.cfg && d.cfg.odoCor && d.cfg.odoCor.bg) || '#000'} fg={(d.cfg && d.cfg.odoCor && d.cfg.odoCor.fg) || '#fff'} v={fmtDist(Number.isFinite(d.odoM) ? d.odoM : 0, (d.cfg && d.cfg.odo) || { un: 'km', dec: 3 })} />;
    case 'relogio': return <Cx label="RELÓGIO GPS" v={hms(d.clock)} />;
    case 'prec': return <Cx label="PRECISÃO GPS" v={d.acc != null ? `${Math.round(d.acc)} m` : '—'} />;
    case 'trcn': return <Cx label="TRECHO" v={d.trN || '—'} />;
    case 'refn': return <Cx label="REFERÊNCIA" v={d.refN || '—'} />;
    case 'kmac': return <Cx label="KM ACUMULADO" v={((Number.isFinite(d.kmAcum) ? d.kmAcum : 0) / 1000).toFixed(3)} />;
    case 'cron': return <Cx label="TEMPO DO TRECHO" v={Number.isFinite(d.elapsed) ? fmtDur(d.elapsed) : '—'} />;
    case 'atual': return <Cx label="ATUAL"><Placa tipo="atual" pl={d.pa} w={w} h={h} /></Cx>;
    case 'prox': return <Cx label="PRÓXIMO"><View style={{ alignItems: 'center' }}><Placa tipo="prox" pl={d.pp} w={w} h={d.ntProx ? h * 0.78 : h} />{d.ntProx ? <Text style={{ color: '#fff', backgroundColor: '#b3261e', fontWeight: '900', fontSize: Math.max(12, Math.min(18, h * 0.2)), borderRadius: 6, paddingHorizontal: 8, marginTop: 2 }}>N {d.ntProx >= 60 && d.ntProx % 60 === 0 ? d.ntProx / 60 + 'min' : d.ntProx + 's'}</Text> : null}</View></Cx>;
    case 'bat': return (
      <View style={{ width: w, height: h, borderWidth: 2, borderColor: '#fff', borderRadius: 6, justifyContent: 'center', backgroundColor: '#000' }}>
        {d.bat >= 0 ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(d.bat * 100)}%`, backgroundColor: d.bat > 0.3 ? '#1b9e57' : '#e53935' }} /> : null}
        <Text style={{ color: '#fff', fontSize: Math.max(11, Math.min(h * 0.6, 28)), fontWeight: '800', textAlign: 'center' }}>{d.bat >= 0 ? Math.round(d.bat * 100) + '%' : '—'}</Text>
      </View>
    );
    case 'wpct': return <Cx label="W%" v={Number.isFinite(d.factor) ? (d.factor * 1000).toFixed(2).replace('.', ',') : '1000,00'} />;
    case 'afer': return d.aferRef
      ? <Btn tx={`AFER ${d.aferRef.n}`} bg="#f5e50f" on={d.onAfer} />
      : <Btn tx="AFER" bg="#555" fg="#aaa" on={() => {}} />;
    case 'p10': return <BtnAj tx="+10" bg="#9e9e9e" w={w} h={h} edit={d.edit} on={() => d.onAdj(10)} />;
    case 'm10': return <BtnAj tx="−10" bg="#9e9e9e" w={w} h={h} edit={d.edit} on={() => d.onAdj(-10)} />;
    case 'p1': return <BtnAj tx="+1" bg="#9e9e9e" w={w} h={h} edit={d.edit} on={() => d.onAdj(1)} />;
    case 'm1': return <BtnAj tx="−1" bg="#9e9e9e" w={w} h={h} edit={d.edit} on={() => d.onAdj(-1)} />;
    case 'odosel': return <Cx label="ODÔMETRO" v="GPS" />;
    case 'odoaj': { const a = Number.isFinite(d.adj) ? d.adj : 0; return <Cx label="AJUSTE DO ODÔMETRO" fg={Math.abs(a) < 0.5 ? '#fff' : '#f5e50f'} v={`${a > 0.5 ? '+' : a < -0.5 ? '−' : ''}${Math.abs(Math.round(a))} m`} />; }
    case 'aferv': return <Btn tx={d.aferRef ? `👁 AFER ${d.aferRef.n}` : '👁 AFER'} bg="#263238" fg="#fff" on={d.aferRef ? d.onAfer : () => {}} />;
    case 'derrap': return <Cx label="DERRAPAGEM" v="--" />;
    case 'pc': return null;
    case 'rb': return (
      <TouchableOpacity activeOpacity={1} disabled={d.edit || !d.onRbTap || d.rbBr} onPress={d.onRbTap} style={{ width: w, height: h, overflow: 'hidden', backgroundColor: '#000' }}>
        {d.fim ? <View style={{ backgroundColor: '#c0392b', paddingVertical: 6, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>FIM DA PROVA</Text></View> : null}
        {d.rbLinhas ? (() => {
          const ehTul = (e) => e.t === 'T' || (e.t === 'P' && e.nt > 0 && e.dw && e.dw.length);
          const avail = Math.max(40, h - (d.fim ? 36 : 0));
          const wt = d.rbLinhas.map((l) => (ehTul(l.e) ? l.pct : l.pct * 0.3));
          const soma = wt.reduce((a, b) => a + b, 0) || 1;
          return d.rbLinhas.map((l, i) => <LinhaRb key={l.key} e={l.e} pct={l.pct} atual={l.atual} w={w} hh={(avail * wt[i]) / soma} classe={d.classe} grupos={d.grupos} trs={d.trs} refs={cfg.refs} />);
        })()
          : <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#999' }}><Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>ROADBOOK</Text><Text style={{ color: '#555', fontSize: 12 }}>as tulipas aparecem aqui</Text></View>}
        {d.rbBr ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.85)', padding: 4, gap: 4 }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#9e9e9e', borderRadius: 6, paddingVertical: 12, alignItems: 'center' }} onPress={d.onRbPrev}><Text style={{ fontWeight: '900', fontSize: 16 }}>▲ ANT</Text></TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#9e9e9e', borderRadius: 6, paddingVertical: 12, alignItems: 'center' }} onPress={d.onRbNext}><Text style={{ fontWeight: '900', fontSize: 16 }}>▼ PRÓX</Text></TouchableOpacity>
            <TouchableOpacity style={{ flex: 1.6, backgroundColor: '#1b9e57', borderRadius: 6, paddingVertical: 12, alignItems: 'center' }} onPress={d.onRbAqui}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>ESTOU AQUI</Text></TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: '#c0392b', borderRadius: 6, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' }} onPress={d.onRbSair}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
    default: return <Cx label={(tipo || '').toUpperCase()} v="em breve" fg="#9e9e9e" />;
  }
}
